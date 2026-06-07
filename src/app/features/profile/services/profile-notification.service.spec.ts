import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { SessionStorageService } from '../../../core/auth/session-storage.service';
import type { ProfileWsEvent } from '../../../core/models/profile.models';
import { AudioPlaybackService } from '../../../core/services/audio-playback.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ProfileNotificationService } from './profile-notification.service';

const EVENT: ProfileWsEvent = {
  eventType: 'ACHIEVEMENT_UNLOCKED',
  timestamp: 1,
  payload: {
    achievementCode: 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO',
    unlockedAt: 1,
    matchId: 'match-1',
    gameNumber: 1,
  },
};

function setupWithSession(isGuest = false) {
  const events$ = new Subject<ProfileWsEvent>();
  const wsMock = {
    connect: vi.fn(),
    subscribe: vi.fn().mockReturnValue(events$.asObservable()),
  };
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
      SessionStorageService,
      AuthStore,
      ProfileNotificationService,
      { provide: WebSocketService, useValue: wsMock },
      { provide: AudioPlaybackService, useValue: { preload: vi.fn(), play: vi.fn() } },
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
  const service = TestBed.inject(ProfileNotificationService);
  return { service, events$, wsMock };
}

describe('ProfileNotificationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('se suscribe a /user/queue/profile para usuarios registrados', () => {
    const { service, wsMock } = setupWithSession();

    service.start();

    expect(wsMock.connect).toHaveBeenCalledTimes(1);
    expect(wsMock.subscribe).toHaveBeenCalledWith('/user/queue/profile');
  });

  it('no se suscribe para invitados', () => {
    const { service, wsMock } = setupWithSession(true);

    service.start();

    expect(wsMock.connect).not.toHaveBeenCalled();
    expect(wsMock.subscribe).not.toHaveBeenCalled();
  });

  it('publica notificacion visible y deduplica por codigo', () => {
    const { service, events$ } = setupWithSession();
    const unlocked: string[] = [];
    service.achievementUnlocked$.subscribe((achievement) =>
      unlocked.push(achievement.achievementCode),
    );

    service.start();
    events$.next(EVENT);
    events$.next(EVENT);

    expect(service.current()?.name).toBe('One Shot I');
    expect(unlocked).toEqual(['WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO']);
  });
});
