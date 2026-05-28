import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { MatchStateService } from './match-state.service';
import { MatchEventQueueService } from './match-event-queue.service';
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
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
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
        winner: null,
        availableActions: [
          { type: 'PLAY_CARD' },
          { type: 'CALL_TRUCO' },
        ],
        playedHands: [],
        currentHand: {
          cardPlayerOne: null,
          cardPlayerTwo: null,
          mano: 'juancho',
        },
      },
      stateVersion: 1,
    });
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
          winner: null,
          availableActions: [
            { type: 'PLAY_CARD' },
            { type: 'CALL_TRUCO' },
          ],
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
});
