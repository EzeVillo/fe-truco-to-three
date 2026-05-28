import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MatchEventQueueService } from './match-event-queue.service';
import type { MatchWsEvent, MatchDerivedEvent } from '../models/match-ws-events';

describe('MatchEventQueueService', () => {
  let service: MatchEventQueueService;
  let transactionalSpy: (event: MatchWsEvent) => void;
  let derivedSpy: (event: MatchDerivedEvent) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new MatchEventQueueService();
    transactionalSpy = vi.fn();
    derivedSpy = vi.fn();
    service.init({
      getViewerSeat: () => 'PLAYER_ONE',
      applyTransactional: transactionalSpy,
      applyDerived: derivedSpy,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('US1 — delay entre eventos remotos', () => {
    it('enqueue dos CARD_PLAYED remotos: ambos se aplican con delay, el segundo no antes', () => {
      const event1: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: 1,
        payload: { seat: 'PLAYER_TWO', card: { suit: 'ESPADA', number: 1 } },
        stateVersion: 2,
      };
      const event2: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: 2,
        payload: { seat: 'PLAYER_TWO', card: { suit: 'ORO', number: 7 } },
        stateVersion: 3,
      };

      service.enqueueTransactional(event1);
      service.enqueueTransactional(event2);

      expect(transactionalSpy).not.toHaveBeenCalled();
      expect(service.pendingCount()).toBe(2);

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(1);
      expect(transactionalSpy).toHaveBeenLastCalledWith(event1);

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(2);
      expect(transactionalSpy).toHaveBeenLastCalledWith(event2);
    });

    it('enqueue CARD_PLAYED remoto + TURN_CHANGED: carta primero con delay, turno inmediato después', () => {
      const cardEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: 1,
        payload: { seat: 'PLAYER_TWO', card: { suit: 'ESPADA', number: 1 } },
        stateVersion: 2,
      };
      const turnEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'TURN_CHANGED',
        timestamp: 2,
        payload: { seat: 'PLAYER_ONE' },
        stateVersion: 3,
      };

      service.enqueueTransactional(cardEvent);
      service.enqueueTransactional(turnEvent);

      expect(transactionalSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(2);
      expect(transactionalSpy).toHaveBeenNthCalledWith(1, cardEvent);
      expect(transactionalSpy).toHaveBeenNthCalledWith(2, turnEvent);
    });
  });

  describe('US2 — orden causal entre transaccionales y derivados', () => {
    it('enqueue CARD_PLAYED + ENVIDO_CALLED + AVAILABLE_ACTIONS_UPDATED: orden exacto con delays correctos', () => {
      const cardEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: 1,
        payload: { seat: 'PLAYER_TWO', card: { suit: 'ESPADA', number: 1 } },
        stateVersion: 2,
      };
      const envidoEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'ENVIDO_CALLED',
        timestamp: 2,
        payload: { callerSeat: 'PLAYER_TWO', call: 'ENVIDO' },
        stateVersion: 3,
      };
      const derivedEvent: MatchDerivedEvent = {
        matchId: 'm1',
        eventType: 'AVAILABLE_ACTIONS_UPDATED',
        timestamp: 3,
        payload: { seat: 'PLAYER_ONE', availableActions: [{ type: 'PLAY_CARD' }] },
      };

      service.enqueueTransactional(cardEvent);
      service.enqueueTransactional(envidoEvent);
      service.enqueueDerived(derivedEvent);

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(1);
      expect(transactionalSpy).toHaveBeenNthCalledWith(1, cardEvent);

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(2);
      expect(transactionalSpy).toHaveBeenNthCalledWith(2, envidoEvent);

      vi.advanceTimersByTime(1);
      expect(derivedSpy).toHaveBeenCalledTimes(1);
      expect(derivedSpy).toHaveBeenNthCalledWith(1, derivedEvent);
    });

    it('enqueue dos cantos remotos encadenados: se aplican uno por uno con delay', () => {
      const envidoEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'ENVIDO_CALLED',
        timestamp: 1,
        payload: { callerSeat: 'PLAYER_TWO', call: 'ENVIDO' },
        stateVersion: 2,
      };
      const trucoEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'TRUCO_CALLED',
        timestamp: 2,
        payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
        stateVersion: 3,
      };

      service.enqueueTransactional(envidoEvent);
      service.enqueueTransactional(trucoEvent);

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(1);
      expect(transactionalSpy).toHaveBeenNthCalledWith(1, envidoEvent);

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(2);
      expect(transactionalSpy).toHaveBeenNthCalledWith(2, trucoEvent);
    });
  });

  describe('US3 — acciones locales sin delay', () => {
    it('evento local se aplica sincrónicamente y pendingCount queda en 0', () => {
      const localEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: 1,
        payload: { seat: 'PLAYER_ONE', card: { suit: 'ESPADA', number: 1 } },
        stateVersion: 2,
      };

      service.enqueueTransactional(localEvent);

      expect(transactionalSpy).toHaveBeenCalledTimes(1);
      expect(transactionalSpy).toHaveBeenLastCalledWith(localEvent);
      expect(service.pendingCount()).toBe(0);
    });

    it('secuencia local + remoto: local inmediato, remoto con delay', () => {
      const localEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: 1,
        payload: { seat: 'PLAYER_ONE', card: { suit: 'ESPADA', number: 1 } },
        stateVersion: 2,
      };
      const remoteEvent: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: 2,
        payload: { seat: 'PLAYER_TWO', card: { suit: 'ORO', number: 7 } },
        stateVersion: 3,
      };

      service.enqueueTransactional(localEvent);
      service.enqueueTransactional(remoteEvent);

      expect(transactionalSpy).toHaveBeenCalledTimes(1);
      expect(transactionalSpy).toHaveBeenNthCalledWith(1, localEvent);

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(2);
      expect(transactionalSpy).toHaveBeenNthCalledWith(2, remoteEvent);
    });
  });

  describe('Edge cases — flush, clear y coalescing', () => {
    it('flushImmediately aplica 5 ítems pendientes en orden sin timers', () => {
      const events: MatchWsEvent[] = Array.from({ length: 5 }, (_, i) => ({
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: i + 1,
        payload: { seat: 'PLAYER_TWO', card: { suit: 'ESPADA', number: i + 1 } },
        stateVersion: i + 2,
      }));

      for (const evt of events) {
        service.enqueueTransactional(evt);
      }

      expect(service.pendingCount()).toBe(5);

      service.flushImmediately();

      expect(transactionalSpy).toHaveBeenCalledTimes(5);
      for (let i = 0; i < 5; i++) {
        expect(transactionalSpy).toHaveBeenNthCalledWith(i + 1, events[i]);
      }
      expect(service.pendingCount()).toBe(0);
    });

    it('clear() cancela timer y descarta ítems; nuevo enqueue funciona normalmente', () => {
      const event1: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'CARD_PLAYED',
        timestamp: 1,
        payload: { seat: 'PLAYER_TWO', card: { suit: 'ESPADA', number: 1 } },
        stateVersion: 2,
      };
      const event2: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'TRUCO_CALLED',
        timestamp: 2,
        payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
        stateVersion: 3,
      };

      service.enqueueTransactional(event1);
      service.clear();

      expect(transactionalSpy).not.toHaveBeenCalled();
      expect(service.pendingCount()).toBe(0);

      service.enqueueTransactional(event2);

      vi.advanceTimersByTime(600);
      expect(transactionalSpy).toHaveBeenCalledTimes(1);
      expect(transactionalSpy).toHaveBeenLastCalledWith(event2);
    });

    it('coalescing: dos TURN_CHANGED consecutivos del mismo seat se colapsan', () => {
      const turn1: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'TURN_CHANGED',
        timestamp: 1,
        payload: { seat: 'PLAYER_TWO' },
        stateVersion: 2,
      };
      const turn2: MatchWsEvent = {
        matchId: 'm1',
        eventType: 'TURN_CHANGED',
        timestamp: 2,
        payload: { seat: 'PLAYER_TWO' },
        stateVersion: 3,
      };

      service.enqueueTransactional(turn1);
      service.enqueueTransactional(turn2);

      // El primer TURN_CHANGED se aplica inmediatamente (delay 0).
      // El segundo se descarta por coalescing, por lo que no hay items pendientes
      // y apply se invocó exactamente una vez.
      expect(service.pendingCount()).toBe(0);
      expect(transactionalSpy).toHaveBeenCalledTimes(1);
      expect(transactionalSpy).toHaveBeenLastCalledWith(turn1);
    });
  });
});
