import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  provideHttpClient,
  withInterceptors,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { refreshInterceptor } from './refresh.interceptor';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { SessionStorageService } from './session-storage.service';
import type { FullAuthResponse } from '../models/auth.models';
import { of, throwError } from 'rxjs';

const FULL_AUTH: FullAuthResponse = {
  playerId: 'player-abc',
  username: 'juancho',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

describe('refreshInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let store: InstanceType<typeof AuthStore>;
  let router: Router;
  let authServiceMock: Partial<AuthService>;

  beforeEach(() => {
    const fakeStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => fakeStorage[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    authServiceMock = {
      refresh: vi.fn().mockReturnValue(of('nuevo-access-token')),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([refreshInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        SessionStorageService,
        AuthStore,
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    store.setSession(FULL_AUTH);
  });

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
  });

  it('pasa respuestas no-401 sin tocarlas', () => {
    let received: unknown;
    http.get('http://localhost:8080/api/lobby').subscribe((v) => {
      received = v;
    });

    const req = httpMock.expectOne('http://localhost:8080/api/lobby');
    req.flush([{ id: '1' }]);
    expect(received).toEqual([{ id: '1' }]);
  });

  it('ante 401 en ruta protegida, dispara refresh y reintenta con nuevo token', () => {
    let response: unknown;

    http.get('http://localhost:8080/api/lobby').subscribe((v) => {
      response = v;
    });

    // Primera request → 401
    const firstReq = httpMock.expectOne('http://localhost:8080/api/lobby');
    firstReq.flush({ errorCode: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Retry con nuevo token
    const retryReq = httpMock.expectOne('http://localhost:8080/api/lobby');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer nuevo-access-token');
    retryReq.flush([{ id: 'retried' }]);

    expect(authServiceMock.refresh).toHaveBeenCalledTimes(1);
    expect(response).toEqual([{ id: 'retried' }]);
  });

  it('NO intercepta 401 en paths de /api/auth/*', () => {
    let errored = false;

    http.post('http://localhost:8080/api/auth/login', {}).subscribe({
      error: () => {
        errored = true;
      },
    });

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush({ errorCode: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // No debe haber intentado refresh
    expect(authServiceMock.refresh).not.toHaveBeenCalled();
    expect(errored).toBe(true);
  });

  it('cuando refresh falla, llama clearSession y navega a /login?returnUrl', () => {
    authServiceMock.refresh = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    const navigateSpy = vi.spyOn(router, 'navigate');
    let finalError: HttpErrorResponse | undefined;

    http.get('http://localhost:8080/api/lobby').subscribe({
      error: (err: HttpErrorResponse) => {
        finalError = err;
      },
    });

    const req = httpMock.expectOne('http://localhost:8080/api/lobby');
    req.flush({ errorCode: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(store.isAuthenticated()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({ queryParams: expect.any(Object) }),
    );
    expect(finalError?.status).toBe(401);
  });
});
