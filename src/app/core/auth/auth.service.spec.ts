import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { SessionStorageService } from './session-storage.service';
import { WebSocketService } from '../services/websocket.service';
import type {
  FullAuthResponse,
  GuestAuthResponse,
  LoginRequest,
  RegisterRequest,
} from '../models/auth.models';

const FULL_RESPONSE: FullAuthResponse = {
  playerId: 'player-123',
  accessToken: 'access-jwt',
  refreshToken: 'refresh-opaque',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

const GUEST_RESPONSE: GuestAuthResponse = {
  playerId: 'guest-456',
  accessToken: 'guest-jwt',
  accessTokenExpiresIn: 604800,
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let store: InstanceType<typeof AuthStore>;
  let wsDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const fakeStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => fakeStorage[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    wsDisconnect = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SessionStorageService,
        AuthStore,
        AuthService,
        { provide: WebSocketService, useValue: { disconnect: wsDisconnect } },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('register()', () => {
    it('hace POST al endpoint correcto y llama setSession antes de emitir', () => {
      const req: RegisterRequest = { username: 'juancho', password: 'Clave1!' };
      let emitted = false;

      service.register(req).subscribe((res) => {
        emitted = true;
        expect(store.accessToken()).toBe('access-jwt');
        expect(store.isAuthenticated()).toBe(true);
        expect(res.accessToken).toBe('access-jwt');
      });

      const httpReq = httpMock.expectOne('http://localhost:8080/api/auth/register');
      expect(httpReq.request.method).toBe('POST');
      expect(httpReq.request.body).toEqual(req);
      httpReq.flush(FULL_RESPONSE);
      expect(emitted).toBe(true);
    });
  });

  describe('login()', () => {
    it('hace POST al endpoint correcto y llama setSession antes de emitir', () => {
      const req: LoginRequest = { username: 'juancho', password: 'Clave1!' };
      let emitted = false;

      service.login(req).subscribe((res) => {
        emitted = true;
        expect(store.accessToken()).toBe('access-jwt');
        expect(store.isGuest()).toBe(false);
        expect(res.playerId).toBe('player-123');
      });

      const httpReq = httpMock.expectOne('http://localhost:8080/api/auth/login');
      expect(httpReq.request.method).toBe('POST');
      httpReq.flush(FULL_RESPONSE);
      expect(emitted).toBe(true);
    });
  });

  describe('guest()', () => {
    it('hace POST sin body y setSession con isGuest=true', () => {
      let emitted = false;

      service.guest().subscribe((res) => {
        emitted = true;
        expect(store.isGuest()).toBe(true);
        expect(store.refreshToken()).toBeNull();
        expect(res.playerId).toBe('guest-456');
      });

      const httpReq = httpMock.expectOne('http://localhost:8080/api/auth/guest');
      expect(httpReq.request.method).toBe('POST');
      expect(httpReq.request.body).toBeNull();
      httpReq.flush(GUEST_RESPONSE);
      expect(emitted).toBe(true);
    });
  });

  describe('refresh()', () => {
    it('emite EMPTY y llama clearSession si refreshToken es null', () => {
      let emitted = false;
      let completed = false;

      // Estado inicial: sin sesión → refreshToken es null
      service.refresh().subscribe({
        next: () => {
          emitted = true;
        },
        complete: () => {
          completed = true;
        },
      });

      httpMock.expectNone('http://localhost:8080/api/auth/refresh');
      expect(emitted).toBe(false);
      expect(completed).toBe(true);
    });

    it('refresca correctamente con refreshToken del store y actualiza tokens', () => {
      store.setSession(FULL_RESPONSE);

      const rotatedResponse: FullAuthResponse = {
        ...FULL_RESPONSE,
        accessToken: 'nuevo-access',
        refreshToken: 'nuevo-refresh',
      };

      let emittedToken = '';

      service.refresh().subscribe((token) => {
        emittedToken = token;
      });

      const httpReq = httpMock.expectOne('http://localhost:8080/api/auth/refresh');
      expect(httpReq.request.method).toBe('POST');
      expect(httpReq.request.body).toEqual({ refreshToken: 'refresh-opaque' });
      httpReq.flush(rotatedResponse);

      expect(emittedToken).toBe('nuevo-access');
      expect(store.accessToken()).toBe('nuevo-access');
    });

    it('es single-flight: dos subscribers comparten la misma request', () => {
      store.setSession(FULL_RESPONSE);

      let count = 0;
      service.refresh().subscribe(() => count++);
      service.refresh().subscribe(() => count++);

      // Solo debe haber UNA request HTTP, no dos
      const requests = httpMock.match('http://localhost:8080/api/auth/refresh');
      expect(requests.length).toBe(1);
      requests[0].flush({ ...FULL_RESPONSE, accessToken: 'shared-token' });

      expect(count).toBe(2); // ambos subscribers reciben el resultado
    });
  });

  describe('logout()', () => {
    it('llama DELETE con refreshToken y luego clearSession', () => {
      store.setSession(FULL_RESPONSE);

      service.logout().subscribe();

      const httpReq = httpMock.expectOne('http://localhost:8080/api/auth/logout');
      expect(httpReq.request.method).toBe('DELETE');
      expect(httpReq.request.body).toEqual({ refreshToken: 'refresh-opaque' });
      httpReq.flush(null, { status: 204, statusText: 'No Content' });

      expect(store.isAuthenticated()).toBe(false);
    });

    it('solo llama clearSession sin backend si no hay refreshToken (guest)', () => {
      store.setSession(GUEST_RESPONSE);

      service.logout().subscribe();

      httpMock.expectNone('http://localhost:8080/api/auth/logout');
      expect(store.isAuthenticated()).toBe(false);
    });

    it('cierra la conexión WebSocket al cerrar sesión', () => {
      store.setSession(FULL_RESPONSE);

      service.logout().subscribe();
      httpMock.expectOne('http://localhost:8080/api/auth/logout').flush(null, {
        status: 204,
        statusText: 'No Content',
      });

      expect(wsDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
