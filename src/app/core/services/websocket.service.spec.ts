import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Client } from '@stomp/stompjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../auth/auth.store';
import { SessionStorageService } from '../auth/session-storage.service';
import { WebSocketService } from './websocket.service';
import type { FullAuthResponse } from '../models/auth.models';

const REFRESHED_AUTH: FullAuthResponse = {
  playerId: 'player-1',
  username: 'juancho',
  accessToken: 'fresh-token',
  refreshToken: 'refresh-2',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

describe('WebSocketService', () => {
  let store: InstanceType<typeof AuthStore>;
  let service: WebSocketService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.restoreAllMocks();

    const fakeStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => fakeStorage[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });
    vi.spyOn(Client.prototype, 'activate').mockImplementation(() => undefined);
    vi.spyOn(Client.prototype, 'deactivate').mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SessionStorageService,
        AuthStore,
        WebSocketService,
      ],
    });

    store = TestBed.inject(AuthStore);
    service = TestBed.inject(WebSocketService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('subscribe pasa headers nativos al frame SUBSCRIBE de STOMP', () => {
    service.connect();
    const client = (service as unknown as { client: Client }).client;
    const subscribeSpy = vi.spyOn(client, 'subscribe').mockReturnValue({
      id: 'sub-1',
      unsubscribe: () => undefined,
    });

    const headers = { matchId: 'match-abc-123' };
    const sub = service.subscribe<unknown>('/user/queue/match-spectate', headers);
    // Activar la suscripción simulando que el cliente ya está conectado
    Object.defineProperty(client, 'connected', { value: true, configurable: true });
    sub.subscribe(); // dispara doSubscribe

    expect(subscribeSpy).toHaveBeenCalledWith(
      '/user/queue/match-spectate',
      expect.any(Function),
      headers,
    );
  });

  it('subscribe sin headers no rompe compatibilidad retroactiva', () => {
    service.connect();
    const client = (service as unknown as { client: Client }).client;
    const subscribeSpy = vi.spyOn(client, 'subscribe').mockReturnValue({
      id: 'sub-2',
      unsubscribe: () => undefined,
    });
    Object.defineProperty(client, 'connected', { value: true, configurable: true });
    service.subscribe<unknown>('/user/queue/match').subscribe();

    expect(subscribeSpy).toHaveBeenCalledWith(
      '/user/queue/match',
      expect.any(Function),
      undefined,
    );
  });

  it('vuelve a suscribirse cuando el WebSocket reconecta', () => {
    service.connect();
    const client = (service as unknown as { client: Client }).client;
    const firstUnsubscribe = vi.fn();
    const secondUnsubscribe = vi.fn();
    const subscribeSpy = vi
      .spyOn(client, 'subscribe')
      .mockReturnValueOnce({ id: 'sub-1', unsubscribe: firstUnsubscribe })
      .mockReturnValueOnce({ id: 'sub-2', unsubscribe: secondUnsubscribe });

    const sub = service.subscribe<unknown>('/user/queue/social').subscribe();

    client.onConnect?.({} as never);
    client.onConnect?.({} as never);

    expect(subscribeSpy).toHaveBeenCalledTimes(2);
    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);

    sub.unsubscribe();
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('actualiza el header Authorization antes de reconectar con el accessToken vigente', async () => {
    store.setSession({
      playerId: 'player-1',
      username: 'juancho',
      accessToken: 'old-token',
      refreshToken: 'refresh-1',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 2592000,
    });

    service.connect();

    const client = (service as unknown as { client: Client }).client;
    expect(client.connectHeaders['Authorization']).toBe('Bearer old-token');

    store.replaceSession({
      playerId: 'player-1',
      username: 'juancho',
      accessToken: 'new-token',
      refreshToken: 'refresh-2',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 2592000,
    });

    await client.beforeConnect?.(client);

    expect(client.connectHeaders['Authorization']).toBe('Bearer new-token');
  });

  it('refresca antes del CONNECT cuando el accessToken registrado ya venció', async () => {
    store.setSession({
      playerId: 'player-1',
      username: 'juancho',
      accessToken: 'expired-token',
      refreshToken: 'refresh-1',
      accessTokenExpiresIn: -1,
      refreshTokenExpiresIn: 2592000,
    });

    service.connect();
    const client = (service as unknown as { client: Client }).client;

    const beforeConnect = client.beforeConnect?.(client);
    const refreshReq = httpMock.expectOne('/api/auth/refresh');
    expect(refreshReq.request.headers.has('Authorization')).toBe(false);
    refreshReq.flush(REFRESHED_AUTH);
    await beforeConnect;

    expect(client.connectHeaders['Authorization']).toBe('Bearer fresh-token');
  });

  it('ante error STOMP de autenticación fuerza refresh y reconecta con el token nuevo', async () => {
    store.setSession({
      playerId: 'player-1',
      username: 'juancho',
      accessToken: 'still-local-fresh-token',
      refreshToken: 'refresh-1',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 2592000,
    });

    service.connect();
    const client = (service as unknown as { client: Client }).client;

    client.onStompError?.({
      headers: { message: 'Invalid token' },
      body: '',
    } as never);

    const refreshReq = httpMock.expectOne('/api/auth/refresh');
    refreshReq.flush(REFRESHED_AUTH);
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.deactivate).toHaveBeenCalled();
    expect(client.activate).toHaveBeenCalledTimes(2);
    expect(client.connectHeaders['Authorization']).toBe('Bearer fresh-token');
  });
});
