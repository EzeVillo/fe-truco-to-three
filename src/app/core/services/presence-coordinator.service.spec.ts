import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../auth/auth.store';
import { SessionStorageService } from '../auth/session-storage.service';
import type { PresenceWsEvent, UserPresenceResponse } from '../models/presence.models';
import { PresenceApiService } from './presence-api.service';
import { PresenceCoordinatorService } from './presence-coordinator.service';
import { WebSocketService } from './websocket.service';

function busyMatch(id = 'match-1'): UserPresenceResponse {
  return {
    busy: true,
    match: { id, status: 'IN_PROGRESS' },
    league: null,
    cup: null,
    rematch: null,
    quickMatch: null,
    spectating: null,
  };
}

function freePresence(): UserPresenceResponse {
  return {
    busy: false,
    match: null,
    league: null,
    cup: null,
    rematch: null,
    quickMatch: null,
    spectating: null,
  };
}

function rematchPresence(originMatchId = 'origin-1'): UserPresenceResponse {
  return {
    busy: true,
    match: null,
    league: null,
    cup: null,
    rematch: { id: 'session-1', originMatchId },
    quickMatch: null,
    spectating: null,
  };
}

function spectatingPresence(matchId = 'spectate-1'): UserPresenceResponse {
  return {
    busy: true,
    match: null,
    league: null,
    cup: null,
    rematch: null,
    quickMatch: null,
    spectating: { matchId },
  };
}

function setup(presence: UserPresenceResponse = freePresence(), routerUrl = '/lobby') {
  const presenceEvents$ = new Subject<PresenceWsEvent>();
  const apiMock = {
    getPresence: vi.fn().mockReturnValue(of(presence)),
  };
  const wsMock = {
    connect: vi.fn(),
    subscribe: vi.fn().mockReturnValue(presenceEvents$.asObservable()),
  };
  const routerMock = {
    url: routerUrl,
    navigateByUrl: vi.fn(),
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
      PresenceCoordinatorService,
      { provide: PresenceApiService, useValue: apiMock },
      { provide: WebSocketService, useValue: wsMock },
      { provide: Router, useValue: routerMock },
    ],
  });

  const store = TestBed.inject(AuthStore);
  const service = TestBed.inject(PresenceCoordinatorService);

  return { service, store, apiMock, wsMock, routerMock, presenceEvents$ };
}

function login(store: InstanceType<typeof AuthStore>): void {
  store.setSession({
    playerId: 'player-1',
    username: 'juancho',
    accessToken: 'token',
    refreshToken: 'refresh',
    accessTokenExpiresIn: 900,
    refreshTokenExpiresIn: 2592000,
  });
}

describe('PresenceCoordinatorService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('no arranca si no hay sesion autenticada', () => {
    const { service, apiMock, wsMock } = setup();

    service.start();

    expect(apiMock.getPresence).not.toHaveBeenCalled();
    expect(wsMock.connect).not.toHaveBeenCalled();
  });

  it('bootstrap autenticado navega a /match/:id cuando hay partida activa', () => {
    const { service, store, routerMock } = setup(busyMatch('match-42'));
    login(store);

    service.start();

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/match/match-42');
  });

  it('no navega si ya esta en el destino correcto', () => {
    const { service, store, routerMock } = setup(busyMatch('match-42'), '/match/match-42');
    login(store);

    service.start();

    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it('ignora errores de bootstrap sin mostrar copy crudo', () => {
    const { service, store, apiMock, routerMock } = setup();
    apiMock.getPresence.mockReturnValue(
      throwError(() => ({ status: 500, error: { message: 'raw backend message' } })),
    );
    login(store);

    service.start();

    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it('arranca en idle y no bloquea la app sin sesion', () => {
    const { service } = setup();

    expect(service.bootstrapStatus()).toBe('idle');
    expect(service.bootstrapOverlayVisible()).toBe(false);
    expect(service.appReady()).toBe(true);
  });

  it('muestra la overlay de carga mientras el fetch inicial esta en curso', () => {
    const presence$ = new Subject<UserPresenceResponse>();
    const { service, store, apiMock } = setup();
    apiMock.getPresence.mockReturnValue(presence$.asObservable());
    login(store);

    service.start();

    expect(service.bootstrapStatus()).toBe('loading');
    expect(service.bootstrapOverlayVisible()).toBe(true);
    expect(service.appReady()).toBe(false);

    presence$.next(freePresence());

    expect(service.bootstrapStatus()).toBe('ready');
    expect(service.bootstrapOverlayVisible()).toBe(false);
    expect(service.appReady()).toBe(true);
  });

  it('pasa a error y permite reintentar el bootstrap', () => {
    const { service, store, apiMock } = setup();
    apiMock.getPresence.mockReturnValue(throwError(() => ({ status: 500 })));
    login(store);

    service.start();

    expect(service.bootstrapStatus()).toBe('error');
    expect(service.bootstrapOverlayVisible()).toBe(true);
    expect(service.appReady()).toBe(false);

    apiMock.getPresence.mockReturnValue(of(busyMatch('match-retry')));
    service.retryBootstrap();

    expect(service.bootstrapStatus()).toBe('ready');
    expect(service.appReady()).toBe(true);
  });

  it('latchea everReady: un re-fetch fallido no desmonta la app ya montada', () => {
    const { service, store, apiMock } = setup(freePresence());
    login(store);
    service.start();
    expect(service.appReady()).toBe(true);

    // Un reintento posterior que falla muestra la overlay pero NO baja appReady.
    apiMock.getPresence.mockReturnValue(throwError(() => ({ status: 500 })));
    service.retryBootstrap();

    expect(service.bootstrapStatus()).toBe('error');
    expect(service.bootstrapOverlayVisible()).toBe(true);
    expect(service.appReady()).toBe(true);
  });

  it('se suscribe a /user/queue/presence y procesa PRESENCE_UPDATED', () => {
    const { service, store, wsMock, routerMock, presenceEvents$ } = setup(freePresence());
    login(store);

    service.start();
    presenceEvents$.next({
      eventType: 'PRESENCE_UPDATED',
      timestamp: 1,
      payload: busyMatch('match-push'),
    });

    expect(wsMock.connect).toHaveBeenCalledTimes(1);
    expect(wsMock.subscribe).toHaveBeenCalledWith('/user/queue/presence');
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/match/match-push');
  });

  it('deduplica snapshots repetidos hacia el mismo destino', () => {
    const { service, store, routerMock, presenceEvents$ } = setup(freePresence());
    login(store);

    service.start();
    const event: PresenceWsEvent = {
      eventType: 'PRESENCE_UPDATED',
      timestamp: 1,
      payload: busyMatch('same-match'),
    };
    presenceEvents$.next(event);
    presenceEvents$.next(event);

    expect(routerMock.navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('cancela suscripciones al cerrar sesion', () => {
    const { service, store, routerMock, presenceEvents$ } = setup(freePresence());
    login(store);
    service.start();

    store.clearSession();
    presenceEvents$.next({
      eventType: 'PRESENCE_UPDATED',
      timestamp: 1,
      payload: busyMatch('after-logout'),
    });

    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it('navega al match de origen cuando hay revancha abierta sin match activo', () => {
    const { service, store, routerMock } = setup(rematchPresence('origin-42'));
    login(store);

    service.start();

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/match/origin-42');
  });

  it('no navega por revancha si ya esta en el match de origen', () => {
    const { service, store, routerMock } = setup(rematchPresence('origin-42'), '/match/origin-42');
    login(store);

    service.start();

    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it('expone la ultima presence procesada en el signal presence()', () => {
    const { service, store } = setup(rematchPresence('origin-9'));
    login(store);

    expect(service.presence()).toBeNull();

    service.start();

    expect(service.presence()?.rematch?.originMatchId).toBe('origin-9');
  });

  it('navega a /spectate/:matchId cuando el usuario está mirando una partida', () => {
    const { service, store, routerMock } = setup(spectatingPresence('spectate-42'));
    login(store);

    service.start();

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/spectate/spectate-42');
  });

  it('no navega por spectate si ya está en la ruta de spectate', () => {
    const { service, store, routerMock } = setup(
      spectatingPresence('spectate-42'),
      '/spectate/spectate-42',
    );
    login(store);

    service.start();

    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it('expone busy segun el snapshot de presencia vigente', () => {
    const { service, store, presenceEvents$ } = setup(freePresence());
    login(store);

    service.start();
    expect(service.busy()).toBe(false);

    presenceEvents$.next({
      eventType: 'PRESENCE_UPDATED',
      timestamp: 1,
      payload: busyMatch('busy-match'),
    });

    expect(service.busy()).toBe(true);
  });
});
