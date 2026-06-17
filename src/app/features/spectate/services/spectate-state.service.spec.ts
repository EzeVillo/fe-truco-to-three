import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpectateStateService } from './spectate-state.service';
import { MatchEventQueueService } from '../../match/services/match-event-queue.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { SpectateApiService } from './spectate-api.service';
import type { SpectateMatchState } from '../../../core/models/spectate.models';

function makeSnap(overrides: Partial<SpectateMatchState> = {}): SpectateMatchState {
  return {
    matchId: 'match-1',
    status: 'IN_PROGRESS',
    scorePlayerOne: 0,
    scorePlayerTwo: 0,
    gamesWonPlayerOne: 0,
    gamesWonPlayerTwo: 0,
    matchWinner: null,
    stateVersion: 1,
    currentRound: null,
    spectatorCount: 3,
    playerOneUsername: 'alice',
    playerTwoUsername: 'bob',
    gamesToPlay: 3,
    ...overrides,
  };
}

describe('SpectateStateService', () => {
  let service: SpectateStateService;
  let wsSubject: Subject<unknown>;
  let connectedSubject: Subject<boolean>;
  let apiGetSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    wsSubject = new Subject<unknown>();
    connectedSubject = new Subject<boolean>();

    const wsMock = {
      connect: vi.fn(),
      connected: connectedSubject.asObservable(),
      subscribe: vi.fn().mockReturnValue(wsSubject.asObservable()),
    };

    apiGetSpy = vi
      .fn()
      .mockReturnValue({ subscribe: (_: unknown) => ({ unsubscribe: () => undefined }) });

    TestBed.configureTestingModule({
      providers: [
        SpectateStateService,
        MatchEventQueueService,
        { provide: WebSocketService, useValue: wsMock },
        { provide: SpectateApiService, useValue: { getSpectate: apiGetSpy } },
        { provide: HttpClient, useValue: {} },
      ],
    });

    service = TestBed.inject(SpectateStateService);
  });

  it('arranca con loading=true y state=null al inicializar', () => {
    service.init('match-1');
    expect(service.loading()).toBe(true);
    expect(service.matchState()).toBeNull();
  });

  it('aplica SPECTATE_STATE: setea state, spectatorCount y loading=false', () => {
    service.init('match-1');
    const snap = makeSnap({ spectatorCount: 5, stateVersion: 1 });

    wsSubject.next({
      eventType: 'SPECTATE_STATE',
      matchId: 'match-1',
      timestamp: Date.now(),
      stateVersion: 1,
      payload: { matchState: snap },
    });

    expect(service.loading()).toBe(false);
    expect(service.matchState()).not.toBeNull();
    expect(service.spectatorCount()).toBe(5);
    expect(service.error()).toBeNull();
  });

  it('SPECTATE_STATE: el estado adaptado no tiene myCards ni availableActions', () => {
    service.init('match-1');
    const snap = makeSnap({
      currentRound: {
        status: 'IN_PROGRESS',
        currentTurn: 'alice',
        roundStatus: 'PLAYING',
        currentTrucoCall: null,
        currentEnvidoCall: null,
        currentTrucoCaller: null,
        currentEnvidoCaller: null,
        winner: null,
        playedHands: [],
        currentHand: { cardPlayerOne: null, cardPlayerTwo: null, mano: 'alice' },
        actionDeadline: null,
        turnDurationMillis: null,
        actionDeadlineSeat: null,
        handPlayerOne: null,
        handPlayerTwo: null,
      },
    });
    wsSubject.next({
      eventType: 'SPECTATE_STATE',
      stateVersion: 1,
      timestamp: Date.now(),
      payload: { matchState: snap },
    });

    const state = service.matchState();
    expect(state?.roundGame?.myCards).toEqual([]);
    expect(state?.roundGame?.availableActions).toEqual([]);
  });

  it('SPECTATE_ERROR: setea error con copy del front, no expone string crudo', () => {
    service.init('match-1');
    wsSubject.next({
      eventType: 'SPECTATE_ERROR',
      matchId: 'match-1',
      timestamp: Date.now(),
      payload: { error: 'NotSpectatingException: blah blah' },
    });

    expect(service.error()).not.toBeNull();
    expect(service.error()).not.toContain('NotSpectatingException');
    expect(service.loading()).toBe(false);
  });

  it('hueco de stateVersion dispara re-fetch via SpectateApiService', () => {
    service.init('match-1');
    // Establece versión inicial 1
    wsSubject.next({
      eventType: 'SPECTATE_STATE',
      stateVersion: 1,
      timestamp: Date.now(),
      payload: { matchState: makeSnap({ stateVersion: 1 }) },
    });

    // Llega un evento con versión 5 (hueco: esperábamos 2)
    wsSubject.next({
      eventType: 'TURN_CHANGED',
      matchId: 'match-1',
      stateVersion: 5,
      timestamp: Date.now(),
      payload: { seat: 'PLAYER_ONE' },
    });

    expect(apiGetSpy).toHaveBeenCalledWith('match-1');
  });

  it('ACTION_DEADLINE_SET actualiza actionDeadline/actionDeadlineSeat (evento derivado)', () => {
    service.init('match-1');
    wsSubject.next({
      eventType: 'SPECTATE_STATE',
      stateVersion: 1,
      timestamp: Date.now(),
      payload: {
        matchState: makeSnap({
          currentRound: {
            status: 'IN_PROGRESS',
            currentTurn: 'alice',
            roundStatus: 'PLAYING',
            currentTrucoCall: null,
            currentEnvidoCall: null,
            currentTrucoCaller: null,
            currentEnvidoCaller: null,
            winner: null,
            playedHands: [],
            currentHand: { cardPlayerOne: null, cardPlayerTwo: null, mano: 'alice' },
            actionDeadline: 1000,
            turnDurationMillis: 30000,
            actionDeadlineSeat: 'PLAYER_ONE',
            handPlayerOne: null,
            handPlayerTwo: null,
          },
        }),
      },
    });

    // El BE reinicia el reloj sobre el otro asiento; sin stateVersion (derivado).
    wsSubject.next({
      eventType: 'ACTION_DEADLINE_SET',
      matchId: 'match-1',
      timestamp: Date.now(),
      payload: { seat: 'PLAYER_TWO', actionDeadline: 9999, turnDurationMillis: 30000 },
    });

    const round = service.matchState()?.roundGame;
    expect(round?.actionDeadlineSeat).toBe('PLAYER_TWO');
    expect(round?.actionDeadline).toBe(9999);
  });

  it('destroy cancela suscripciones', () => {
    service.init('match-1');
    service.destroy();
    // Después de destroy, los eventos no producen cambios de estado
    const stateBefore = service.matchState();
    wsSubject.next({
      eventType: 'SPECTATE_STATE',
      stateVersion: 99,
      timestamp: Date.now(),
      payload: { matchState: makeSnap() },
    });
    expect(service.matchState()).toBe(stateBefore);
  });
});
