import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { jwtInterceptor } from './jwt.interceptor';
import { AuthStore } from './auth.store';
import { SessionStorageService } from './session-storage.service';
import type { FullAuthResponse } from '../models/auth.models';

const FULL_AUTH: FullAuthResponse = {
  playerId: 'player-abc',
  username: 'juancho',
  accessToken: 'my-access-token',
  refreshToken: 'my-refresh-token',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

describe('jwtInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    const fakeStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => fakeStorage[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        SessionStorageService,
        AuthStore,
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('pasa requests a /api/auth/* SIN añadir Authorization header', () => {
    store.setSession(FULL_AUTH);

    http.post('http://localhost:8080/api/auth/login', {}).subscribe();
    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('pasa requests a /api/auth/refresh SIN Authorization header', () => {
    store.setSession(FULL_AUTH);

    http.post('http://localhost:8080/api/auth/refresh', {}).subscribe();
    const req = httpMock.expectOne('http://localhost:8080/api/auth/refresh');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('añade Authorization: Bearer <token> a requests protegidas cuando hay accessToken', () => {
    store.setSession(FULL_AUTH);

    http.get('http://localhost:8080/api/matches').subscribe();
    const req = httpMock.expectOne('http://localhost:8080/api/matches');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-access-token');
    req.flush([]);
  });

  it('NO añade Authorization header a requests protegidas cuando no hay accessToken', () => {
    // Sin sesión → accessToken = null
    http.get('http://localhost:8080/api/lobby').subscribe();
    const req = httpMock.expectOne('http://localhost:8080/api/lobby');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  describe('refresh proactivo', () => {
    const EXPIRED_AUTH: FullAuthResponse = { ...FULL_AUTH, accessTokenExpiresIn: -1 };
    const REFRESHED_AUTH: FullAuthResponse = {
      ...FULL_AUTH,
      accessToken: 'fresh-token',
      accessTokenExpiresIn: 900,
    };

    it('refresca ANTES de mandar la request cuando el token venció y manda el token fresco', () => {
      store.setSession(EXPIRED_AUTH);

      http.get('http://localhost:8080/api/matches').subscribe();

      // Primero sale el refresh, no la request protegida
      const refreshReq = httpMock.expectOne('/api/auth/refresh');
      expect(refreshReq.request.headers.has('Authorization')).toBe(false);
      refreshReq.flush(REFRESHED_AUTH);

      // Recién ahora sale la request original, con el token fresco
      const req = httpMock.expectOne('http://localhost:8080/api/matches');
      expect(req.request.headers.get('Authorization')).toBe('Bearer fresh-token');
      req.flush([]);
    });

    it('NO refresca proactivamente cuando no hay refreshToken (guest)', () => {
      store.setSession({
        playerId: 'guest-1',
        accessToken: 'guest-token',
        accessTokenExpiresIn: -1,
      });

      http.get('http://localhost:8080/api/matches').subscribe();

      httpMock.expectNone('/api/auth/refresh');
      const req = httpMock.expectOne('http://localhost:8080/api/matches');
      expect(req.request.headers.get('Authorization')).toBe('Bearer guest-token');
      req.flush([]);
    });

    it('si el refresh proactivo falla, manda con el token actual (red de seguridad reactiva)', () => {
      store.setSession(EXPIRED_AUTH);

      http.get('http://localhost:8080/api/matches').subscribe();

      const refreshReq = httpMock.expectOne('/api/auth/refresh');
      refreshReq.flush(null, { status: 500, statusText: 'Server Error' });

      const req = httpMock.expectOne('http://localhost:8080/api/matches');
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-access-token');
      req.flush([]);
    });
  });
});
