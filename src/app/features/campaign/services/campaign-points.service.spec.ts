import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { SessionStorageService } from '../../../core/auth/session-storage.service';
import type {
  CampaignBotUnlockedPayload,
  CampaignMatchPointsPayload,
  CampaignWsEvent,
} from '../../../core/models/ws.models';
import { AudioPlaybackService } from '../../../core/services/audio-playback.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { CampaignPointsService } from './campaign-points.service';

function event(
  matchId: string,
  overrides: Partial<CampaignMatchPointsPayload> = {},
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

function botUnlockedEvent(payload: CampaignBotUnlockedPayload): CampaignWsEvent {
  return { eventType: 'CAMPAIGN_BOT_UNLOCKED', timestamp: 1, payload };
}

function setupWithSession(isGuest = false) {
  const events$ = new Subject<CampaignWsEvent>();
  const wsMock = {
    connect: vi.fn(),
    subscribe: vi.fn().mockReturnValue(events$.asObservable()),
  };
  const audioMock = { preload: vi.fn(), play: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      SessionStorageService,
      AuthStore,
      CampaignPointsService,
      { provide: WebSocketService, useValue: wsMock },
      { provide: AudioPlaybackService, useValue: audioMock },
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
  return { service, events$, wsMock, audioMock };
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

  it('CAMPAIGN_BOT_UNLOCKED setea el toast y reproduce el sonido', () => {
    const { service, events$, audioMock } = setupWithSession();
    service.start();

    expect(service.botUnlocked()).toBeNull();
    events$.next(botUnlockedEvent({ botId: 'c42', matchId: 'match-9' }));

    expect(service.botUnlocked()).toEqual({ botId: 'c42', matchId: 'match-9' });
    expect(audioMock.play).toHaveBeenCalledTimes(1);
  });

  it('dismissBotUnlock limpia el toast', () => {
    const { service, events$ } = setupWithSession();
    service.start();
    events$.next(botUnlockedEvent({ botId: 'c42', matchId: 'match-9' }));

    service.dismissBotUnlock();

    expect(service.botUnlocked()).toBeNull();
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
