import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { refreshInterceptor } from './refresh.interceptor';
import { jwtInterceptor } from './jwt.interceptor';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { SessionStorageService } from './session-storage.service';
import type { FullAuthResponse } from '../models/auth.models';

const FULL_AUTH: FullAuthResponse = {
  playerId: 'player-abc',
  accessToken: 'old-access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

describe('refreshInterceptor — flujo end-to-end', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let store: InstanceType<typeof AuthStore>;
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
      refresh: vi.fn().mockReturnValue(new Subject<string>().asObservable()),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor, refreshInterceptor])),
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
    store.setSession(FULL_AUTH);
  });

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
  });

  it('request original → 401 → refresh → retry con nuevo token → 200 transparente', () => {
    const refreshSubject = new Subject<string>();
    authServiceMock.refresh = vi.fn().mockReturnValue(refreshSubject.asObservable());

    let finalResult: unknown;

    http.get('http://localhost:8080/api/lobby').subscribe((v) => {
      finalResult = v;
    });

    // Primera request con token viejo
    const first = httpMock.expectOne('http://localhost:8080/api/lobby');
    expect(first.request.headers.get('Authorization')).toBe('Bearer old-access-token');
    first.flush({ errorCode: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Resolver el refresh
    refreshSubject.next('new-access-token');
    refreshSubject.complete();

    // Retry después del refresh con nuevo token
    const retry = httpMock.expectOne('http://localhost:8080/api/lobby');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retry.flush({ data: 'lobby-data' });

    expect(authServiceMock.refresh).toHaveBeenCalledTimes(1);
    expect(finalResult).toEqual({ data: 'lobby-data' });
  });

  it('múltiples 401 simultáneas disparan UN SOLO refresh', () => {
    // Usar Subject para que el refresh sea asíncrono — ambas requests fallan
    // antes de que el refresh complete, garantizando que comparten el mismo vuelo.
    const refreshSubject = new Subject<string>();
    authServiceMock.refresh = vi.fn().mockReturnValue(refreshSubject.asObservable());

    http.get('http://localhost:8080/api/partidas').subscribe();
    http.get('http://localhost:8080/api/lobby').subscribe();

    const req1 = httpMock.expectOne('http://localhost:8080/api/partidas');
    const req2 = httpMock.expectOne('http://localhost:8080/api/lobby');

    // Ambas requests fallan con 401
    req1.flush({ errorCode: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    // req1 dispara el refresh; isRefreshing = true
    // req2 también falla → debe esperar al Subject
    req2.flush({ errorCode: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Solo UN refresh debe haberse iniciado (req2 entra en la cola)
    expect(authServiceMock.refresh).toHaveBeenCalledTimes(1);

    // Resolver el refresh → ambas requests se reintentarán
    refreshSubject.next('new-access-token');
    refreshSubject.complete();

    const retries = httpMock.match(() => true);
    retries.forEach((r) => r.flush({}));
  });
});
