import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { MatchStateService } from './match-state.service';
import { MatchEventQueueService } from './match-event-queue.service';
import { SpectatorCountStore } from '../../../shared/services/spectator-count.store';
import { WebSocketService } from '../../../core/services/websocket.service';
import { environment } from '../../../../environments/environment';
import type { MatchWsEvent, MatchDerivedEvent } from '../models/match-ws-events';

class MockWebSocketService {
  readonly connected = new BehaviorSubject<boolean>(false);
  private readonly eventSubject = new Subject<MatchWsEvent>();
  private readonly derivedSubject = new Subject<MatchDerivedEvent>();

  connect(): void {
    this.connected.next(true);
  }

  subscribe<T>(destination: string): Observable<T> {
    if (destination === '/user/queue/match') {
      return this.eventSubject.asObservable() as Observable<T>;
    }
    if (destination === '/user/queue/match-derived') {
      return this.derivedSubject.asObservable() as Observable<T>;
    }
    return new Subject<T>().asObservable();
  }

  getEventSubject(): Subject<MatchWsEvent> {
    return this.eventSubject;
  }

  getDerivedSubject(): Subject<MatchDerivedEvent> {
    return this.derivedSubject;
  }
}

class MockMatchEventQueueService {
  init = vi.fn();
  enqueueTransactional = vi.fn();
  enqueueDerived = vi.fn();
  flushImmediately = vi.fn();
  clear = vi.fn();
  pendingCount = vi.fn(() => 0);
}

describe('MatchStateService', () => {
  let service: MatchStateService;
  let httpMock: HttpTestingController;
  let mockWsService: MockWebSocketService;
  let mockEventQueue: MockMatchEventQueueService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    mockWsService = new MockWebSocketService();
    mockEventQueue = new MockMatchEventQueueService();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const parentInjector = TestBed.inject(EnvironmentInjector);
    const injector = createEnvironmentInjector(
      [
        { provide: WebSocketService, useValue: mockWsService },
        { provide: MatchEventQueueService, useValue: mockEventQueue },
      ],
      parentInjector,
    );

    httpMock = TestBed.inject(HttpTestingController);
    service = runInInjectionContext(injector, () => new MatchStateService());
  });

  afterEach(() => {
    httpMock.verify();
    service.destroy();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function flushSnapshot(): void {
    const req = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
    req.flush({
      matchId: 'test-match',
      status: 'IN_PROGRESS',
      viewerSeat: 'PLAYER_ONE',
      playerOneUsername: 'juancho',
      playerTwoUsername: 'martina',
      gamesToPlay: 3,
      scorePlayerOne: 1,
      scorePlayerTwo: 0,
      gamesWonPlayerOne: 0,
      gamesWonPlayerTwo: 0,
      matchWinner: null,
      roundGame: {
        status: 'IN_PROGRESS',
        currentTurn: 'juancho',
        myCards: [
          { suit: 'ESPADA', number: 1 },
          { suit: 'BASTO', number: 7 },
        ],
        roundStatus: 'PLAYING',
        currentTrucoCall: null,
        currentEnvidoCall: null,
        winner: null,
        availableActions: [{ type: 'PLAY_CARD' }, { type: 'CALL_TRUCO' }],
        playedHands: [],
        currentHand: {
          cardPlayerOne: null,
          cardPlayerTwo: null,
          mano: 'juancho',
        },
        actionDeadline: null,
        turnDurationMillis: null,
        actionDeadlineSeat: null,
      },
      stateVersion: 1,
    });
  }

  function makeWaitingSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      matchId: 'test-match',
      status: 'WAITING_FOR_PLAYERS',
      viewerSeat: 'PLAYER_ONE',
      playerOneUsername: 'juancho',
      playerTwoUsername: null,
      gamesToPlay: 3,
      scorePlayerOne: 0,
      scorePlayerTwo: 0,
      gamesWonPlayerOne: 0,
      gamesWonPlayerTwo: 0,
      matchWinner: null,
      roundGame: null,
      stateVersion: 1,
      ...overrides,
    };
  }

  describe('init()', () => {
    it('inicializa el eventQueue con los callbacks correctos', () => {
      service.init('test-match');
      flushSnapshot();

      expect(mockEventQueue.init).toHaveBeenCalledTimes(1);
      const deps = mockEventQueue.init.mock.calls[0][0];
      expect(typeof deps.getViewerSeat).toBe('function');
      expect(typeof deps.applyTransactional).toBe('function');
      expect(typeof deps.applyDerived).toBe('function');
      expect(deps.getViewerSeat()).toBe('PLAYER_ONE');
    });
  });

  describe('eventos vivos', () => {
    it('eventos transaccionales invocan enqueueTransactional en lugar de apply directo', () => {
      const eventSubject = mockWsService.getEventSubject();

      service.init('test-match');
      flushSnapshot();

      const wsEvent: MatchWsEvent = {
        matchId: 'test-match',
        eventType: 'TRUCO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
        stateVersion: 2,
      };

      eventSubject.next(wsEvent);

      expect(mockEventQueue.enqueueTransactional).toHaveBeenCalledTimes(1);
      expect(mockEventQueue.enqueueTransactional).toHaveBeenLastCalledWith(wsEvent);
    });

    it('PLAYER_JOINED refresca el roster inmediatamente para mostrar el nombre del rival', () => {
      const eventSubject = mockWsService.getEventSubject();

      service.init('test-match');
      const initialReq = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
      initialReq.flush(makeWaitingSnapshot());

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'PLAYER_JOINED',
        timestamp: Date.now(),
        payload: {},
        stateVersion: 2,
      });

      const refreshReq = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
      refreshReq.flush(
        makeWaitingSnapshot({
          status: 'READY',
          playerTwoUsername: 'martina',
          stateVersion: 2,
        }),
      );

      expect(service.state()?.status).toBe('READY');
      expect(service.state()?.playerTwoUsername).toBe('martina');
      expect(mockEventQueue.enqueueTransactional).toHaveBeenCalledOnce();
    });

    it('GAME_STARTED completa el roster del host en una pública (autostart, sin pasar por READY)', () => {
      service.init('test-match');
      // El host arranca esperando: rival aún null.
      const initialReq = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
      initialReq.flush(makeWaitingSnapshot());

      // La cola real aplica el GAME_STARTED vía applyTransactional: lo invocamos
      // directo porque el eventQueue está mockeado.
      const applyTransactional = mockEventQueue.init.mock.calls[0][0].applyTransactional as (
        e: MatchWsEvent,
      ) => void;
      applyTransactional({
        matchId: 'test-match',
        eventType: 'GAME_STARTED',
        timestamp: Date.now(),
        payload: {},
        stateVersion: 2,
      });

      expect(service.state()?.status).toBe('IN_PROGRESS');

      // ensureRosterNames dispara un GET para completar identidades faltantes.
      const rosterReq = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
      rosterReq.flush(
        makeWaitingSnapshot({
          status: 'IN_PROGRESS',
          playerTwoUsername: 'martina',
          stateVersion: 2,
        }),
      );

      // El nombre del rival aparece y el status NO se revierte a WAITING.
      expect(service.state()?.playerTwoUsername).toBe('martina');
      expect(service.state()?.status).toBe('IN_PROGRESS');
    });

    // La integración de eventos derivados (enqueueDerived) se verifica
    // indirectamente a través del spec de MatchEventQueueService y del
    // test de init() que confirma que applyDerived se pasa correctamente.

    it('no emite eventos duplicados (stateVersion ya aplicado)', () => {
      const eventSubject = mockWsService.getEventSubject();

      service.init('test-match');
      flushSnapshot();

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'TRUCO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
        stateVersion: 2,
      });

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'TRUCO_RESPONDED',
        timestamp: Date.now(),
        payload: { responderSeat: 'PLAYER_ONE', response: 'QUIERO', call: 'TRUCO' },
        stateVersion: 1,
      });

      // El segundo evento tiene stateVersion <= lastApplied (1 <= 1), por lo que se descarta
      expect(mockEventQueue.enqueueTransactional).toHaveBeenCalledTimes(1);
    });

    it('dos eventos remotos consecutivos en ráfaga no disparan refetch (gap falso por delay de cola)', () => {
      // Regresión: cuando llegan dos eventos transaccionales seguidos antes de que
      // el primero salga de la cola, el segundo se evaluaba contra lastApplied (que aún
      // no había avanzado) y se interpretaba como gap → triggerRefetch infinito.
      // La fix usa lastSeenVersion (avanza al encolar) en lugar de lastApplied.
      const eventSubject = mockWsService.getEventSubject();

      service.init('test-match');
      flushSnapshot();

      // Snapshot quedó en stateVersion=1; el mock de eventQueue NO aplica los eventos,
      // así que lastApplied se queda en 1 incluso después de encolar.
      eventSubject.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_TWO', call: 'ENVIDO' },
        stateVersion: 2,
      });
      eventSubject.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_TWO', call: 'FALTA_ENVIDO' },
        stateVersion: 3,
      });

      // Ambos se encolaron, no hubo refetch
      expect(mockEventQueue.enqueueTransactional).toHaveBeenCalledTimes(2);
      httpMock.expectNone(`${environment.apiUrl}/matches/test-match`);
    });
  });

  describe('SPECTATOR_COUNT_CHANGED (feature 026)', () => {
    it('ignora el evento sin disparar refetch ni enqueue (no es estado de juego)', () => {
      const eventSubject = mockWsService.getEventSubject();
      service.init('test-match');
      flushSnapshot();

      // init() ya llamó clear() una vez; un refetch espurio lo volvería a llamar.
      const clearCallsBefore = mockEventQueue.clear.mock.calls.length;

      // Un espectador entra: el BE difunde SPECTATOR_COUNT_CHANGED por el canal del
      // match sin un stateVersion que encaje en la secuencia transaccional.
      eventSubject.next({
        matchId: 'test-match',
        eventType: 'SPECTATOR_COUNT_CHANGED',
        timestamp: Date.now(),
        payload: { spectatorCount: 1 },
      } as unknown as MatchWsEvent);

      // No debe parpadear el tablero (refetch) ni tocar la cola ack-gated.
      httpMock.expectNone(`${environment.apiUrl}/matches/test-match`);
      expect(mockEventQueue.enqueueTransactional).not.toHaveBeenCalled();
      expect(mockEventQueue.enqueueDerived).not.toHaveBeenCalled();
      expect(mockEventQueue.clear.mock.calls.length).toBe(clearCallsBefore);

      // Pero sí publica el conteo al store global que lee el header (feature 026).
      expect(TestBed.inject(SpectatorCountStore).count()).toBe(1);
    });

    it('no rompe la reconciliación: un evento de juego posterior se aplica normal', () => {
      const eventSubject = mockWsService.getEventSubject();
      service.init('test-match');
      flushSnapshot();

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'SPECTATOR_COUNT_CHANGED',
        timestamp: Date.now(),
        payload: { spectatorCount: 2 },
      } as unknown as MatchWsEvent);

      // El siguiente evento transaccional real (stateVersion = lastApplied + 1) se
      // encola sin que el evento de espectadores haya alterado lastSeenVersion.
      eventSubject.next({
        matchId: 'test-match',
        eventType: 'TRUCO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
        stateVersion: 2,
      } as unknown as MatchWsEvent);

      expect(mockEventQueue.enqueueTransactional).toHaveBeenCalledTimes(1);
      httpMock.expectNone(`${environment.apiUrl}/matches/test-match`);
    });
  });

  describe('eventos del temporizador (013-turn-timer)', () => {
    it('rutea ACTION_DEADLINE_SET como derivado y no dispara refetch', () => {
      const eventSubject = mockWsService.getEventSubject();
      service.init('test-match');
      flushSnapshot();

      const timerEvent = {
        matchId: 'test-match',
        eventType: 'ACTION_DEADLINE_SET',
        timestamp: Date.now(),
        payload: {
          seat: 'PLAYER_ONE',
          actionDeadline: Date.now() + 30_000,
          turnDurationMillis: 30_000,
        },
        stateVersion: null,
      } as unknown as MatchWsEvent;

      eventSubject.next(timerEvent);

      expect(mockEventQueue.enqueueDerived).toHaveBeenCalledTimes(1);
      expect(mockEventQueue.enqueueTransactional).not.toHaveBeenCalled();
      httpMock.expectNone(`${environment.apiUrl}/matches/test-match`);
    });

    it('ACTION_DEADLINE_CLEARED también se rutea como derivado', () => {
      const eventSubject = mockWsService.getEventSubject();
      service.init('test-match');
      flushSnapshot();

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'ACTION_DEADLINE_CLEARED',
        timestamp: Date.now(),
        payload: {},
        stateVersion: null,
      } as unknown as MatchWsEvent);

      expect(mockEventQueue.enqueueDerived).toHaveBeenCalledTimes(1);
      expect(mockEventQueue.enqueueTransactional).not.toHaveBeenCalled();
    });

    it('deriva serverClockOffsetMs del timestamp del evento', () => {
      const eventSubject = mockWsService.getEventSubject();
      service.init('test-match');
      flushSnapshot();

      const fixedNow = 1_000_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'ACTION_DEADLINE_SET',
        timestamp: fixedNow + 4000,
        payload: {
          seat: 'PLAYER_ONE',
          actionDeadline: fixedNow + 34_000,
          turnDurationMillis: 30_000,
        },
        stateVersion: null,
      } as unknown as MatchWsEvent);

      expect(service.serverClockOffsetMs()).toBe(4000);
    });

    it('inicializa el plazo desde el snapshot (reconexión / carga inicial, FR-009)', () => {
      service.init('test-match');
      const req = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
      req.flush({
        matchId: 'test-match',
        status: 'IN_PROGRESS',
        viewerSeat: 'PLAYER_ONE',
        playerOneUsername: 'juancho',
        playerTwoUsername: 'martina',
        gamesToPlay: 3,
        scorePlayerOne: 0,
        scorePlayerTwo: 0,
        gamesWonPlayerOne: 0,
        gamesWonPlayerTwo: 0,
        matchWinner: null,
        roundGame: {
          status: 'IN_PROGRESS',
          currentTurn: 'juancho',
          myCards: [],
          roundStatus: 'PLAYING',
          currentTrucoCall: null,
          currentEnvidoCall: null,
          winner: null,
          availableActions: [{ type: 'PLAY_CARD' }],
          playedHands: [],
          currentHand: { cardPlayerOne: null, cardPlayerTwo: null, mano: 'juancho' },
          actionDeadline: 1_000_030_000,
          turnDurationMillis: 30_000,
          actionDeadlineSeat: 'PLAYER_ONE',
        },
        stateVersion: 1,
      });

      const round = service.state()?.roundGame;
      expect(round?.actionDeadline).toBe(1_000_030_000);
      expect(round?.turnDurationMillis).toBe(30_000);
      expect(round?.actionDeadlineSeat).toBe('PLAYER_ONE');
    });
  });

  describe('buffer de carga', () => {
    it('aplica eventos del buffer sin pasar por la cola', () => {
      const eventSubject = mockWsService.getEventSubject();

      service.init('test-match');

      // Enviar evento mientras loading === true (antes de flushSnapshot)
      const bufferedEvent: MatchWsEvent = {
        matchId: 'test-match',
        eventType: 'CARD_PLAYED',
        timestamp: Date.now(),
        payload: { seat: 'PLAYER_TWO', card: { suit: 'ESPADA', number: 1 } },
        stateVersion: 2,
      };
      eventSubject.next(bufferedEvent);

      // Antes del snapshot, no debe haber llamado a la cola ni al apply directo
      expect(mockEventQueue.enqueueTransactional).not.toHaveBeenCalled();

      // Ahora completar el snapshot
      flushSnapshot();

      // El evento del buffer se aplica directamente sin pasar por la cola
      // Verificamos que el state se actualizó (matchEvent$ debería emitir)
      // Nota: el buffer usa applyAndIncrement directamente, por lo que matchEvent$ emite
      // Pero como el mock de eventQueue no aplica el evento, verificamos que enqueueTransactional
      // NO fue llamado para el evento del buffer
      expect(mockEventQueue.enqueueTransactional).not.toHaveBeenCalled();
    });

    it('refresca el roster si PLAYER_JOINED se aplica desde buffer durante la carga inicial', () => {
      const eventSubject = mockWsService.getEventSubject();
      service.init('test-match');

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'PLAYER_JOINED',
        timestamp: Date.now(),
        payload: {},
        stateVersion: 2,
      });

      const initialReq = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
      initialReq.flush(makeWaitingSnapshot());

      const refreshReq = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
      refreshReq.flush(
        makeWaitingSnapshot({
          status: 'READY',
          playerTwoUsername: 'martina',
          stateVersion: 2,
        }),
      );

      expect(service.state()?.status).toBe('READY');
      expect(service.state()?.playerTwoUsername).toBe('martina');
    });
  });

  describe('destroy()', () => {
    it('llama clear() del eventQueue', () => {
      service.init('test-match');
      flushSnapshot();
      mockEventQueue.clear.mockClear();

      service.destroy();

      expect(mockEventQueue.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconexión', () => {
    it('invoca flushImmediately() antes de refetch', () => {
      service.init('test-match');
      flushSnapshot();

      // Simular desconexión
      mockWsService.connected.next(false);

      // Simular reconexión
      mockWsService.connected.next(true);

      // Debe llamar flushImmediately antes de hacer el fetch del snapshot
      expect(mockEventQueue.flushImmediately).toHaveBeenCalledTimes(1);

      // Y debe hacer el refetch
      const req = httpMock.expectOne(`${environment.apiUrl}/matches/test-match`);
      req.flush({
        matchId: 'test-match',
        status: 'IN_PROGRESS',
        viewerSeat: 'PLAYER_ONE',
        playerOneUsername: 'juancho',
        playerTwoUsername: 'martina',
        gamesToPlay: 3,
        scorePlayerOne: 1,
        scorePlayerTwo: 0,
        gamesWonPlayerOne: 0,
        gamesWonPlayerTwo: 0,
        matchWinner: null,
        roundGame: {
          status: 'IN_PROGRESS',
          currentTurn: 'juancho',
          myCards: [
            { suit: 'ESPADA', number: 1 },
            { suit: 'BASTO', number: 7 },
          ],
          roundStatus: 'PLAYING',
          currentTrucoCall: null,
          currentEnvidoCall: null,
          winner: null,
          availableActions: [{ type: 'PLAY_CARD' }, { type: 'CALL_TRUCO' }],
          playedHands: [],
          currentHand: {
            cardPlayerOne: null,
            cardPlayerTwo: null,
            mano: 'juancho',
          },
        },
        stateVersion: 1,
      });
    });
  });

  describe('ruteo de eventos REMATCH_* (feature 014)', () => {
    const REMATCH_TYPES = [
      'REMATCH_AVAILABLE',
      'REMATCH_OPPONENT_WANTS',
      'REMATCH_CONFIRMED',
      'REMATCH_CLOSED_BY_LEAVE',
      'REMATCH_EXPIRED',
    ] as const;

    it.each(REMATCH_TYPES)(
      '%s se emite por rematch$ y NO por la cola transaccional',
      (eventType) => {
        const eventSubject = mockWsService.getEventSubject();
        service.init('test-match');
        flushSnapshot();

        const rematchEvents: unknown[] = [];
        service.rematch$.subscribe((e) => rematchEvents.push(e));

        const wsEvent: MatchWsEvent = {
          matchId: 'test-match',
          eventType,
          timestamp: Date.now(),
          payload: { sessionId: 'sid', originMatchId: 'test-match' },
          stateVersion: 99,
        };

        eventSubject.next(wsEvent);

        expect(rematchEvents).toHaveLength(1);
        expect((rematchEvents[0] as MatchWsEvent).eventType).toBe(eventType);
        // No pasa por la cola ack-gated
        expect(mockEventQueue.enqueueTransactional).not.toHaveBeenCalled();
      },
    );

    it('REMATCH_AVAILABLE durante loading se bufferea en rematch$ (no en buffer transaccional)', () => {
      const eventSubject = mockWsService.getEventSubject();
      service.init('test-match');
      // No flush → loading = true

      const rematchEvents: unknown[] = [];
      service.rematch$.subscribe((e) => rematchEvents.push(e));

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'REMATCH_AVAILABLE',
        timestamp: Date.now(),
        payload: { sessionId: 'sid', originMatchId: 'test-match', expiresAt: 9999999 },
        stateVersion: 5,
      });

      // Llega directo al canal rematch$ sin pasar por el buffer transaccional
      expect(rematchEvents).toHaveLength(1);
      expect(mockEventQueue.enqueueTransactional).not.toHaveBeenCalled();

      // Cleanup
      flushSnapshot();
    });

    it('un evento transaccional normal (TRUCO_CALLED) no se emite por rematch$', () => {
      const eventSubject = mockWsService.getEventSubject();
      service.init('test-match');
      flushSnapshot();

      const rematchEvents: unknown[] = [];
      service.rematch$.subscribe((e) => rematchEvents.push(e));

      eventSubject.next({
        matchId: 'test-match',
        eventType: 'TRUCO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
        stateVersion: 2,
      });

      expect(rematchEvents).toHaveLength(0);
    });
  });
});
