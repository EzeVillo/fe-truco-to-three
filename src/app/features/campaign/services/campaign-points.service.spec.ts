import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { SessionStorageService } from '../../../core/auth/session-storage.service';
import type { CampaignWsEvent } from '../../../core/models/ws.models';
import { WebSocketService } from '../../../core/services/websocket.service';
import { CampaignPointsService } from './campaign-points.service';

function event(
  matchId: string,
  overrides: Partial<CampaignWsEvent['payload']> = {},
): CampaignWsEvent {
  return {
    eventType: 'CAMPAIGN_MATCH_POINTS',
    timestamp: 1,
    payload: {
      matchId,
      rivalId: 'rival-1',
      won: true,
      pointsAwarded: 300,
      totalPoints: 14230,
      previousPosition: 42,
      newPosition: 39,
      ...overrides,
    },
  };
}

function setupWithSession(isGuest = false) {
  const events$ = new Subject<CampaignWsEvent>();
  const wsMock = {
    connect: vi.fn(),
    subscribe: vi.fn().mockReturnValue(events$.asObservable()),
  };

  TestBed.configureTestingModule({
    providers: [
      SessionStorageService,
      AuthStore,
      CampaignPointsService,
      { provide: WebSocketService, useValue: wsMock },
    ],
  });

  const store = TestBed.inject(AuthStore);
  if (isGuest) {
    store.setSession({ playerId: 'guest', accessToken: 'token', accessTokenExpiresIn: 604800 });
  } else {
    store.setSession({
      playerId: 'player',
      username: 'juancho',
      accessToken: 'token',
      refreshToken: 'refresh',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 2592000,
    });
  }
  const service = TestBed.inject(CampaignPointsService);
  return { service, events$, wsMock };
}

describe('CampaignPointsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('se suscribe a /user/queue/campaign para usuarios registrados', () => {
    const { service, wsMock } = setupWithSession();

    service.start();

    expect(wsMock.connect).toHaveBeenCalledTimes(1);
    expect(wsMock.subscribe).toHaveBeenCalledWith('/user/queue/campaign');
  });

  it('no se suscribe para invitados', () => {
    const { service, wsMock } = setupWithSession(true);

    service.start();

    expect(wsMock.connect).not.toHaveBeenCalled();
    expect(wsMock.subscribe).not.toHaveBeenCalled();
  });

  it('entrega de inmediato los puntos ya recibidos para ese match', async () => {
    const { service, events$ } = setupWithSession();
    service.start();
    events$.next(event('match-1'));

    const payload = await firstValueFrom(service.awaitForMatch('match-1'));

    expect(payload?.pointsAwarded).toBe(300);
    expect(payload?.newPosition).toBe(39);
  });

  it('espera el push si todavía no llegó y resuelve al recibirlo', async () => {
    const { service, events$ } = setupWithSession();
    service.start();

    const pending = firstValueFrom(service.awaitForMatch('match-2'));
    events$.next(event('match-1', { pointsAwarded: 100 }));
    events$.next(event('match-2', { pointsAwarded: 200 }));

    const payload = await pending;
    expect(payload?.matchId).toBe('match-2');
    expect(payload?.pointsAwarded).toBe(200);
  });

  it('emite null si el push no llega antes del timeout', async () => {
    vi.useFakeTimers();
    try {
      const { service } = setupWithSession();
      service.start();

      const pending = firstValueFrom(service.awaitForMatch('match-3', 1000));
      vi.advanceTimersByTime(1001);

      expect(await pending).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
