import { TestBed } from '@angular/core/testing';
import { Client } from '@stomp/stompjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../auth/auth.store';
import { SessionStorageService } from '../auth/session-storage.service';
import { WebSocketService } from './websocket.service';

describe('WebSocketService', () => {
  let store: InstanceType<typeof AuthStore>;
  let service: WebSocketService;

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

    TestBed.configureTestingModule({
      providers: [SessionStorageService, AuthStore, WebSocketService],
    });

    store = TestBed.inject(AuthStore);
    service = TestBed.inject(WebSocketService);
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
});
