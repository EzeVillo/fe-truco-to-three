import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { RematchStateService } from './rematch-state.service';
import { RematchApiService } from './rematch-api.service';
import { MatchStateService } from './match-state.service';
import { environment } from '../../../../environments/environment';
import type { RematchSessionResponse } from '../models/rematch.models';
import type { MatchWsEvent } from '../models/match-ws-events';

const BASE = `${environment.apiUrl}/matches`;

function makeDto(overrides: Partial<RematchSessionResponse> = {}): RematchSessionResponse {
  return {
    sessionId: 'sid-1',
    originMatchId: 'mid-1',
    status: 'OPEN',
    playerOneChoice: 'UNDECIDED',
    playerTwoChoice: 'UNDECIDED',
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    resultMatchId: null,
    ...overrides,
  };
}

class MockMatchStateService {
  readonly rematch$ = new Subject<MatchWsEvent>();
  readonly serverClockOffsetMs = signal(0);
}

describe('RematchStateService', () => {
  let service: RematchStateService;
  let httpMock: HttpTestingController;
  let mockMatchState: MockMatchStateService;
  let childInjector: EnvironmentInjector;

  beforeEach(() => {
    TestBed.resetTestingModule();
    mockMatchState = new MockMatchStateService();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const parentInjector = TestBed.inject(EnvironmentInjector);
    childInjector = createEnvironmentInjector(
      [
        RematchApiService,
        { provide: MatchStateService, useValue: mockMatchState },
      ],
      parentInjector,
    );

    httpMock = TestBed.inject(HttpTestingController);
    service = runInInjectionContext(childInjector, () => new RematchStateService());
  });

  afterEach(() => {
    httpMock?.verify();
    service?.reset();
    childInjector?.destroy();
    vi.restoreAllMocks();
  });

  // --- init() + snapshot REST ---

  describe('init() — snapshot REST', () => {
    it('setea session cuando getSession devuelve 200 (viewerSeat PLAYER_ONE)', () => {
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(
        makeDto({ playerOneChoice: 'WANTS_REMATCH', playerTwoChoice: 'UNDECIDED' }),
      );

      const s = service.session();
      expect(s).not.toBeNull();
      expect(s!.selfChoice).toBe('WANTS_REMATCH');
      expect(s!.opponentChoice).toBe('UNDECIDED');
      expect(s!.status).toBe('OPEN');
      expect(typeof s!.expiresAt).toBe('number');
    });

    it('mapea playerTwo como self cuando viewerSeat es PLAYER_TWO', () => {
      service.init('mid-1', 'PLAYER_TWO', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(
        makeDto({ playerOneChoice: 'UNDECIDED', playerTwoChoice: 'WANTS_REMATCH' }),
      );

      expect(service.session()!.selfChoice).toBe('WANTS_REMATCH');
      expect(service.session()!.opponentChoice).toBe('UNDECIDED');
    });

    it('session queda null cuando getSession devuelve 404', () => {
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock
        .expectOne(`${BASE}/mid-1/rematch`)
        .flush(null, { status: 404, statusText: 'Not Found' });

      expect(service.session()).toBeNull();
    });

    it('NO pega al GET cuando fetchSession es false (default); session queda null', () => {
      service.init('mid-1', 'PLAYER_ONE');
      httpMock.expectNone(`${BASE}/mid-1/rematch`);

      expect(service.session()).toBeNull();
    });

    it('aún sin fetchSession, REMATCH_AVAILABLE por WS setea la sesión sin GET', () => {
      service.init('mid-1', 'PLAYER_ONE');
      httpMock.expectNone(`${BASE}/mid-1/rematch`);

      mockMatchState.rematch$.next({
        matchId: 'mid-1', eventType: 'REMATCH_AVAILABLE', timestamp: Date.now(),
        payload: { sessionId: 'sid-9', originMatchId: 'mid-1', expiresAt: 9_999_999_999 },
        stateVersion: 0,
      });

      expect(service.session()!.status).toBe('OPEN');
    });

    it('normaliza expiresAt ISO-8601 a epochMillis (number)', () => {
      const isoDate = '2026-06-01T12:00:00Z';
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(makeDto({ expiresAt: isoDate }));

      expect(typeof service.session()!.expiresAt).toBe('number');
      expect(service.session()!.expiresAt).toBe(Date.parse(isoDate));
    });
  });

  // --- reducers de eventos REMATCH_* ---

  describe('reducción de eventos REMATCH_*', () => {
    beforeEach(() => {
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(makeDto());
    });

    it('REMATCH_AVAILABLE crea sesión OPEN con UNDECIDED/UNDECIDED', () => {
      mockMatchState.rematch$.next({
        matchId: 'mid-1', eventType: 'REMATCH_AVAILABLE', timestamp: Date.now(),
        payload: { sessionId: 'sid-2', originMatchId: 'mid-1', expiresAt: 9_999_999_999 },
        stateVersion: 0,
      });

      const s = service.session()!;
      expect(s.status).toBe('OPEN');
      expect(s.selfChoice).toBe('UNDECIDED');
      expect(s.opponentChoice).toBe('UNDECIDED');
      expect(s.expiresAt).toBe(9_999_999_999);
    });

    it('REMATCH_OPPONENT_WANTS actualiza opponentChoice a WANTS_REMATCH', () => {
      mockMatchState.rematch$.next({
        matchId: 'mid-1', eventType: 'REMATCH_OPPONENT_WANTS', timestamp: Date.now(),
        payload: { sessionId: 'sid-1', originMatchId: 'mid-1', actor: 'martina' },
        stateVersion: 0,
      });

      expect(service.session()!.opponentChoice).toBe('WANTS_REMATCH');
    });

    it('REMATCH_CONFIRMED actualiza status y resultMatchId', () => {
      mockMatchState.rematch$.next({
        matchId: 'mid-1', eventType: 'REMATCH_CONFIRMED', timestamp: Date.now(),
        payload: { sessionId: 'sid-1', originMatchId: 'mid-1', newMatchId: 'mid-2', newPlayerOne: 'a', newPlayerTwo: 'b' },
        stateVersion: 0,
      });

      expect(service.session()!.status).toBe('CONFIRMED');
      expect(service.session()!.resultMatchId).toBe('mid-2');
    });

    it('REMATCH_CLOSED_BY_LEAVE actualiza status y opponentChoice', () => {
      mockMatchState.rematch$.next({
        matchId: 'mid-1', eventType: 'REMATCH_CLOSED_BY_LEAVE', timestamp: Date.now(),
        payload: { sessionId: 'sid-1', originMatchId: 'mid-1', actor: 'martina' },
        stateVersion: 0,
      });

      expect(service.session()!.status).toBe('CLOSED_BY_LEAVE');
      expect(service.session()!.opponentChoice).toBe('LEFT');
    });

    it('REMATCH_EXPIRED actualiza status a EXPIRED', () => {
      mockMatchState.rematch$.next({
        matchId: 'mid-1', eventType: 'REMATCH_EXPIRED', timestamp: Date.now(),
        payload: { sessionId: 'sid-1', originMatchId: 'mid-1' },
        stateVersion: 0,
      });

      expect(service.session()!.status).toBe('EXPIRED');
    });
  });

  // --- acciones optimistas ---

  describe('accept() — acción optimista', () => {
    beforeEach(() => {
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(makeDto());
    });

    it('setea selfChoice=WANTS_REMATCH inmediatamente', () => {
      service.accept();
      httpMock.expectOne(`${BASE}/mid-1/rematch/choose`).flush(null, { status: 204, statusText: 'No Content' });

      expect(service.session()!.selfChoice).toBe('WANTS_REMATCH');
    });

    it('en error 422, revierte selfChoice y setea errorMessage sin texto del BE', () => {
      service.accept();
      httpMock
        .expectOne(`${BASE}/mid-1/rematch/choose`)
        .flush({ message: 'BE-leak' }, { status: 422, statusText: 'Unprocessable' });

      expect(service.session()!.selfChoice).toBe('UNDECIDED');
      expect(service.errorMessage()).not.toBe('');
      expect(service.errorMessage()).not.toContain('BE-leak');
    });
  });

  describe('leave() — acción optimista', () => {
    beforeEach(() => {
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(makeDto());
    });

    it('setea status=CLOSED_BY_LEAVE y selfChoice=LEFT inmediatamente', () => {
      service.leave();
      httpMock.expectOne(`${BASE}/mid-1/rematch/leave`).flush(null, { status: 204, statusText: 'No Content' });

      const s = service.session()!;
      expect(s.status).toBe('CLOSED_BY_LEAVE');
      expect(s.selfChoice).toBe('LEFT');
    });

    it('en error, revierte y errorMessage no contiene texto crudo del BE', () => {
      service.leave();
      httpMock
        .expectOne(`${BASE}/mid-1/rematch/leave`)
        .flush({ message: 'raw-error' }, { status: 404, statusText: 'Not Found' });

      expect(service.session()!.status).toBe('OPEN');
      expect(service.errorMessage()).not.toContain('raw-error');
    });
  });

  // --- reset() ---

  describe('reset()', () => {
    it('limpia session y errorMessage', () => {
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(makeDto());

      service.reset();

      expect(service.session()).toBeNull();
      expect(service.errorMessage()).toBe('');
    });

    it('desuscribe de rematch$ tras reset (no procesa eventos del match anterior)', () => {
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(makeDto());
      service.reset();

      mockMatchState.rematch$.next({
        matchId: 'mid-1', eventType: 'REMATCH_CONFIRMED', timestamp: Date.now(),
        payload: { sessionId: 'sid-1', originMatchId: 'mid-1', newMatchId: 'mid-2', newPlayerOne: 'a', newPlayerTwo: 'b' },
        stateVersion: 0,
      });

      expect(service.session()).toBeNull();
    });
  });

  // --- initFromDto() ---

  describe('initFromDto()', () => {
    it('setea session sin llamar getSession (sin petición HTTP)', () => {
      const dto = makeDto({ playerTwoChoice: 'WANTS_REMATCH' });
      service.initFromDto(dto, 'PLAYER_TWO');

      expect(service.session()!.selfChoice).toBe('WANTS_REMATCH');
      expect(service.session()!.status).toBe('OPEN');
      httpMock.expectNone(`${BASE}/mid-1/rematch`);
    });
  });

  // --- getErrorCopy — nunca expone ApiError.message ---

  describe('getErrorCopy', () => {
    it('accept() en error 422 devuelve copy de producto, no el mensaje crudo del BE', () => {
      service.init('mid-1', 'PLAYER_ONE', true);
      httpMock.expectOne(`${BASE}/mid-1/rematch`).flush(makeDto());

      service.accept();
      httpMock
        .expectOne(`${BASE}/mid-1/rematch/choose`)
        .flush({ message: 'La sesión no está abierta' }, { status: 422, statusText: 'Unprocessable' });

      expect(service.errorMessage()).not.toContain('La sesión no está abierta');
      expect(service.errorMessage().length).toBeGreaterThan(0);
    });
  });
});
