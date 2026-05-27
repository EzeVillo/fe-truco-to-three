import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Subject, Observable } from 'rxjs';
import { MatchStateService } from './match-state.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { environment } from '../../../../environments/environment';
import type { MatchWsEvent } from '../models/match-ws-events';

class MockWebSocketService {
  readonly connected = new Subject<boolean>();

  connect(): void {
    this.connected.next(true);
  }

  subscribe<T>(_destination: string): Observable<T> {
    return new Subject<T>().asObservable();
  }
}

describe('MatchStateService', () => {
  let service: MatchStateService;
  let httpMock: HttpTestingController;
  let mockWsService: MockWebSocketService;

  beforeEach(() => {
    mockWsService = new MockWebSocketService();

    TestBed.configureTestingModule({
      providers: [
        MatchStateService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WebSocketService, useValue: mockWsService },
      ],
    });

    service = TestBed.inject(MatchStateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    service.destroy();
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

  describe('matchEvent$', () => {
    it('emite evento WS despu\u00e9s de aplicarlo al estado', () => {
      const eventSubject = new Subject<MatchWsEvent>();
      vi.spyOn(mockWsService, 'subscribe').mockImplementation((destination: string) => {
        if (destination === '/user/queue/match') {
          return eventSubject.asObservable();
        }
        return new Subject<unknown>().asObservable();
      });

      const emittedEvents: MatchWsEvent[] = [];
      service.matchEvent$.subscribe((evt) => emittedEvents.push(evt));

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

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].eventType).toBe('TRUCO_CALLED');
      expect(emittedEvents[0].payload).toEqual({ callerSeat: 'PLAYER_TWO', call: 'TRUCO' });
    });

    it('no emite eventos duplicados (stateVersion ya aplicado)', () => {
      const eventSubject = new Subject<MatchWsEvent>();
      vi.spyOn(mockWsService, 'subscribe').mockImplementation((destination: string) => {
        if (destination === '/user/queue/match') {
          return eventSubject.asObservable();
        }
        return new Subject<unknown>().asObservable();
      });

      const emittedEvents: MatchWsEvent[] = [];
      service.matchEvent$.subscribe((evt) => emittedEvents.push(evt));

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
        stateVersion: 2,
      });

      expect(emittedEvents).toHaveLength(1);
    });
  });
});
