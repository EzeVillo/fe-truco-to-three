import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { SessionStorageService } from './session-storage.service';
import type { FullAuthResponse, GuestAuthResponse, AuthSession } from '../models/auth.models';
import { AUTH_STORAGE_KEY } from './auth.tokens';

const FULL_AUTH_RESPONSE: FullAuthResponse = {
  playerId: 'player-uuid-123',
  username: 'juancho',
  accessToken: 'access-jwt-abc',
  refreshToken: 'refresh-opaque-xyz',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

const GUEST_AUTH_RESPONSE: GuestAuthResponse = {
  playerId: 'guest-uuid-456',
  accessToken: 'guest-jwt-abc',
  accessTokenExpiresIn: 604800,
};

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;
  let fakeStorage: Record<string, string>;
  let sessionStorageService: SessionStorageService;

  beforeEach(() => {
    fakeStorage = {};

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return fakeStorage[key] ?? null;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    TestBed.configureTestingModule({
      providers: [SessionStorageService, AuthStore],
    });

    sessionStorageService = TestBed.inject(SessionStorageService);
    store = TestBed.inject(AuthStore);
  });

  describe('estado inicial ANON', () => {
    it('empieza con todos los campos nulos y no autenticado', () => {
      expect(store.playerId()).toBeNull();
      expect(store.username()).toBeNull();
      expect(store.accessToken()).toBeNull();
      expect(store.refreshToken()).toBeNull();
      expect(store.isGuest()).toBe(false);
      expect(store.isAuthenticated()).toBe(false);
    });
  });

  describe('setSession() con FullAuthResponse', () => {
    it('deriva isGuest=false y popula todos los campos', () => {
      store.setSession(FULL_AUTH_RESPONSE);

      expect(store.playerId()).toBe('player-uuid-123');
      expect(store.username()).toBe('juancho');
      expect(store.accessToken()).toBe('access-jwt-abc');
      expect(store.refreshToken()).toBe('refresh-opaque-xyz');
      expect(store.isGuest()).toBe(false);
      expect(store.isAuthenticated()).toBe(true);
    });

    it('persiste la sesión en localStorage antes de actualizar el estado', () => {
      store.setSession(FULL_AUTH_RESPONSE);
      expect(fakeStorage[AUTH_STORAGE_KEY]).toBeDefined();
      const saved = JSON.parse(fakeStorage[AUTH_STORAGE_KEY]) as AuthSession;
      expect(saved.playerId).toBe('player-uuid-123');
      expect(saved.username).toBe('juancho');
      expect(saved.isGuest).toBe(false);
    });
  });

  describe('setSession() con GuestAuthResponse', () => {
    it('deriva isGuest=true y refreshToken=null', () => {
      store.setSession(GUEST_AUTH_RESPONSE);

      expect(store.playerId()).toBe('guest-uuid-456');
      expect(store.username()).toBeNull();
      expect(store.accessToken()).toBe('guest-jwt-abc');
      expect(store.refreshToken()).toBeNull();
      expect(store.isGuest()).toBe(true);
      expect(store.isAuthenticated()).toBe(true);
    });
  });

  describe('updateAccessToken()', () => {
    it('rota el accessToken manteniendo el resto del estado', () => {
      store.setSession(FULL_AUTH_RESPONSE);
      store.updateAccessToken('nuevo-token', 900, 'nuevo-refresh');

      expect(store.accessToken()).toBe('nuevo-token');
      expect(store.refreshToken()).toBe('nuevo-refresh');
      expect(store.playerId()).toBe('player-uuid-123');
      expect(store.username()).toBe('juancho');
    });

    it('funciona sin refreshToken opcional', () => {
      store.setSession(FULL_AUTH_RESPONSE);
      store.updateAccessToken('nuevo-token-2', 900);

      expect(store.accessToken()).toBe('nuevo-token-2');
      expect(store.refreshToken()).toBe('refresh-opaque-xyz'); // sin cambios
    });
  });

  describe('clearSession()', () => {
    it('vuelve al estado ANON y borra localStorage', () => {
      store.setSession(FULL_AUTH_RESPONSE);
      store.clearSession();

      expect(store.playerId()).toBeNull();
      expect(store.username()).toBeNull();
      expect(store.accessToken()).toBeNull();
      expect(store.refreshToken()).toBeNull();
      expect(store.isGuest()).toBe(false);
      expect(store.isAuthenticated()).toBe(false);
      expect(fakeStorage[AUTH_STORAGE_KEY]).toBeUndefined();
    });
  });

  describe('onInit — hidratación desde storage', () => {
    it('hidrata el estado desde una sesión válida en storage', () => {
      const validSession = {
        playerId: 'hydrated-player',
        username: 'HydratedUser',
        accessToken: 'hydrated-token',
        refreshToken: 'hydrated-refresh',
        isGuest: false,
      };
      fakeStorage[AUTH_STORAGE_KEY] = JSON.stringify(validSession);

      // Re-crear el store para que dispare onInit
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [SessionStorageService, AuthStore],
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
        return fakeStorage[key] ?? null;
      });
      const freshStore = TestBed.inject(AuthStore);

      expect(freshStore.playerId()).toBe('hydrated-player');
      expect(freshStore.username()).toBe('HydratedUser');
      expect(freshStore.accessToken()).toBe('hydrated-token');
      expect(freshStore.isAuthenticated()).toBe(true);
    });

    it('descarta un blob inválido y arranca en ANON', () => {
      fakeStorage[AUTH_STORAGE_KEY] = '{"invalid": true}'; // shape incorrecto

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [SessionStorageService, AuthStore],
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
        return fakeStorage[key] ?? null;
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
        delete fakeStorage[key];
      });
      const freshStore = TestBed.inject(AuthStore);

      expect(freshStore.playerId()).toBeNull();
      expect(freshStore.isAuthenticated()).toBe(false);
      expect(fakeStorage[AUTH_STORAGE_KEY]).toBeUndefined();
    });
    it('hidrata una sesion legacy sin username para permitir rehidratacion posterior', () => {
      fakeStorage[AUTH_STORAGE_KEY] = JSON.stringify({
        playerId: 'legacy-player',
        accessToken: 'legacy-token',
        refreshToken: 'legacy-refresh',
        isGuest: false,
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [SessionStorageService, AuthStore],
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
        return fakeStorage[key] ?? null;
      });
      const freshStore = TestBed.inject(AuthStore);

      expect(freshStore.playerId()).toBe('legacy-player');
      expect(freshStore.username()).toBeNull();
      expect(freshStore.isGuest()).toBe(false);
      expect(freshStore.isAuthenticated()).toBe(true);
    });

    it('actualiza identidad registrada y la persiste', () => {
      store.setSession(GUEST_AUTH_RESPONSE);
      store.updateIdentity('player-registered', 'martina', 'user');

      expect(store.playerId()).toBe('player-registered');
      expect(store.username()).toBe('martina');
      expect(store.isGuest()).toBe(false);
      const saved = JSON.parse(fakeStorage[AUTH_STORAGE_KEY]) as AuthSession;
      expect(saved.username).toBe('martina');
    });
  });
});
