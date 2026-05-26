import { describe, it, expect } from 'vitest';
import { callDisplayMapper } from './call-display-mapper';
import type { MatchWsEvent } from '../models/match-ws-events';

function makeEvent(eventType: string, payload: unknown): MatchWsEvent {
  return {
    matchId: 'test-match',
    eventType: eventType as MatchWsEvent['eventType'],
    timestamp: Date.now(),
    payload,
    stateVersion: 1,
  };
}

describe('callDisplayMapper', () => {
  describe('TRUCO_CALLED', () => {
    it('mapea TRUCO', () => {
      const result = callDisplayMapper(makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'TRUCO' }));
      expect(result).toEqual({ seat: 'PLAYER_ONE', text: '\u00a1Truco!', isAcceptance: false });
    });

    it('mapea RETRUCO', () => {
      const result = callDisplayMapper(makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_TWO', call: 'RETRUCO' }));
      expect(result).toEqual({ seat: 'PLAYER_TWO', text: '\u00a1Retruco!', isAcceptance: false });
    });

    it('mapea VALE_CUATRO', () => {
      const result = callDisplayMapper(makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'VALE_CUATRO' }));
      expect(result).toEqual({ seat: 'PLAYER_ONE', text: '\u00a1Vale cuatro!', isAcceptance: false });
    });

    it('devuelve null para call desconocido', () => {
      const result = callDisplayMapper(makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'UNKNOWN' }));
      expect(result).toBeNull();
    });
  });

  describe('TRUCO_RESPONDED', () => {
    it('mapea QUIERO con isAcceptance true', () => {
      const result = callDisplayMapper(makeEvent('TRUCO_RESPONDED', { responderSeat: 'PLAYER_TWO', response: 'QUIERO', call: 'TRUCO' }));
      expect(result).toEqual({ seat: 'PLAYER_TWO', text: '\u00a1Quiero!', isAcceptance: true });
    });

    it('mapea NO_QUIERO con isAcceptance false', () => {
      const result = callDisplayMapper(makeEvent('TRUCO_RESPONDED', { responderSeat: 'PLAYER_ONE', response: 'NO_QUIERO', call: 'TRUCO' }));
      expect(result).toEqual({ seat: 'PLAYER_ONE', text: '\u00a1No quiero!', isAcceptance: false });
    });

    it('mapea QUIERO_Y_ME_VOY_AL_MAZO con isAcceptance false', () => {
      const result = callDisplayMapper(makeEvent('TRUCO_RESPONDED', { responderSeat: 'PLAYER_ONE', response: 'QUIERO_Y_ME_VOY_AL_MAZO', call: 'TRUCO' }));
      expect(result).toEqual({ seat: 'PLAYER_ONE', text: '\u00a1Quiero y me voy al mazo!', isAcceptance: false });
    });

    it('devuelve null para response desconocido', () => {
      const result = callDisplayMapper(makeEvent('TRUCO_RESPONDED', { responderSeat: 'PLAYER_ONE', response: 'UNKNOWN', call: 'TRUCO' }));
      expect(result).toBeNull();
    });
  });

  describe('ENVIDO_CALLED', () => {
    it('mapea ENVIDO', () => {
      const result = callDisplayMapper(makeEvent('ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' }));
      expect(result).toEqual({ seat: 'PLAYER_ONE', text: '\u00a1Envido!', isAcceptance: false });
    });

    it('mapea REAL_ENVIDO', () => {
      const result = callDisplayMapper(makeEvent('ENVIDO_CALLED', { callerSeat: 'PLAYER_TWO', call: 'REAL_ENVIDO' }));
      expect(result).toEqual({ seat: 'PLAYER_TWO', text: '\u00a1Real envido!', isAcceptance: false });
    });

    it('mapea FALTA_ENVIDO', () => {
      const result = callDisplayMapper(makeEvent('ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'FALTA_ENVIDO' }));
      expect(result).toEqual({ seat: 'PLAYER_ONE', text: '\u00a1Falta envido!', isAcceptance: false });
    });

    it('devuelve null para call desconocido', () => {
      const result = callDisplayMapper(makeEvent('ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'UNKNOWN' }));
      expect(result).toBeNull();
    });
  });

  describe('ENVIDO_RESOLVED', () => {
    it('devuelve null debido al gap de responderSeat', () => {
      const result = callDisplayMapper(makeEvent('ENVIDO_RESOLVED', { response: 'QUIERO', winnerSeat: 'PLAYER_ONE' }));
      expect(result).toBeNull();
    });

    it('devuelve null para NO_QUIERO tambi\u00e9n', () => {
      const result = callDisplayMapper(makeEvent('ENVIDO_RESOLVED', { response: 'NO_QUIERO', winnerSeat: 'PLAYER_TWO' }));
      expect(result).toBeNull();
    });
  });

  describe('FOLDED', () => {
    it('mapea FOLDED', () => {
      const result = callDisplayMapper(makeEvent('FOLDED', { seat: 'PLAYER_ONE' }));
      expect(result).toEqual({ seat: 'PLAYER_ONE', text: 'Me voy al mazo', isAcceptance: false });
    });
  });

  describe('eventos ignorados', () => {
    it('devuelve null para CARD_PLAYED', () => {
      const result = callDisplayMapper(makeEvent('CARD_PLAYED', { seat: 'PLAYER_ONE', card: { suit: 'ESPADA', number: 1 } }));
      expect(result).toBeNull();
    });

    it('devuelve null para ROUND_STARTED', () => {
      const result = callDisplayMapper(makeEvent('ROUND_STARTED', { roundNumber: 1, manoSeat: 'PLAYER_ONE' }));
      expect(result).toBeNull();
    });

    it('devuelve null para MATCH_FINISHED', () => {
      const result = callDisplayMapper(makeEvent('MATCH_FINISHED', { winnerSeat: 'PLAYER_ONE', gamesWonPlayerOne: 1, gamesWonPlayerTwo: 0 }));
      expect(result).toBeNull();
    });
  });
});
