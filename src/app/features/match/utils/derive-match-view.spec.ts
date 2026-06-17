import { describe, it, expect } from 'vitest';
import type { MatchState } from '../../../core/models/match.models';
import { deriveMatchView } from './derive-match-view';
import {
  mockMatchViewerPlayerOne,
  mockMatchViewerPlayerTwo,
  mockMatchEmptyTable,
  mockMatchAsymmetricHand,
} from '../mocks/match-state.mocks';

describe('deriveMatchView', () => {
  it('maps viewer PLAYER_ONE correctly', () => {
    const view = deriveMatchView(mockMatchViewerPlayerOne);
    expect(view.self.seat).toBe('PLAYER_ONE');
    expect(view.self.username).toBe('juancho');
    expect(view.opponent.seat).toBe('PLAYER_TWO');
    expect(view.opponent.username).toBe('martina');
  });

  it('maps viewer PLAYER_TWO symmetrically', () => {
    const view = deriveMatchView(mockMatchViewerPlayerTwo);
    expect(view.self.seat).toBe('PLAYER_TWO');
    expect(view.self.username).toBe('martina');
    expect(view.opponent.seat).toBe('PLAYER_ONE');
    expect(view.opponent.username).toBe('juancho');
  });

  it('maps scores relative to seat', () => {
    const viewOne = deriveMatchView(mockMatchViewerPlayerOne);
    expect(viewOne.self.score).toBe(1);
    expect(viewOne.opponent.score).toBe(0);

    const viewTwo = deriveMatchView(mockMatchViewerPlayerTwo);
    expect(viewTwo.self.score).toBe(0);
    expect(viewTwo.opponent.score).toBe(1);
  });

  it('derives seriesLabel from gamesToPlay', () => {
    expect(deriveMatchView(mockMatchViewerPlayerOne).seriesLabel).toBe('Mejor de 3');
    expect(deriveMatchView(mockMatchEmptyTable).seriesLabel).toBe('Mejor de 1');
    expect(deriveMatchView(mockMatchAsymmetricHand).seriesLabel).toBe('Mejor de 5');
  });

  it('calculates hand counts for self and opponent', () => {
    const view = deriveMatchView(mockMatchViewerPlayerOne);
    expect(view.self.handCount).toBe(2); // 3 total - 1 played in playedHands
    expect(view.opponent.handCount).toBe(2);
  });

  it('calculates hand counts for asymmetric hand', () => {
    const view = deriveMatchView(mockMatchAsymmetricHand);
    expect(view.self.handCount).toBe(1); // 3 - 1 playedHands - 1 currentHand
    expect(view.opponent.handCount).toBe(2); // 3 - 1 playedHands - 0 currentHand
  });

  it('maps played hands correctly', () => {
    const view = deriveMatchView(mockMatchViewerPlayerOne);
    expect(view.self.playedInPreviousHands.length).toBe(1);
    expect(view.self.playedInPreviousHands[0]?.number).toBe(3);
    expect(view.opponent.playedInPreviousHands[0]?.number).toBe(5);
  });

  it('maps current hand cards correctly', () => {
    const view = deriveMatchView(mockMatchAsymmetricHand);
    expect(view.self.playedInCurrentHand?.number).toBe(7);
    expect(view.opponent.playedInCurrentHand).toBeNull();
  });

  it('determines currentTurnIsSelf correctly', () => {
    const viewOne = deriveMatchView(mockMatchViewerPlayerOne);
    expect(viewOne.currentTurnIsSelf).toBe(true);

    const viewAsymmetric = deriveMatchView(mockMatchAsymmetricHand);
    expect(viewAsymmetric.currentTurnIsSelf).toBe(false);
  });

  it('handles empty table (no roundGame data)', () => {
    const view = deriveMatchView(mockMatchEmptyTable);
    expect(view.self.handCount).toBe(3);
    expect(view.self.handCards).toHaveLength(3);
    expect(view.playedHandsCount).toBe(0);
  });

  it('maps availableActions from roundGame', () => {
    const view = deriveMatchView(mockMatchViewerPlayerOne);
    expect(view.availableActions).toEqual([
      { type: 'PLAY_CARD' },
      { type: 'CALL_TRUCO' },
      { type: 'CALL_ENVIDO' },
      { type: 'FOLD' },
    ]);
  });

  it('maps currentTrucoCall from roundGame', () => {
    const view = deriveMatchView(mockMatchViewerPlayerOne);
    expect(view.currentTrucoCall).toBeNull();
  });

  it('returns empty availableActions when roundGame is null', () => {
    const stateWithoutRound = { ...mockMatchEmptyTable, roundGame: null };
    const view = deriveMatchView(stateWithoutRound);
    expect(view.availableActions).toEqual([]);
  });

  describe('manos boca arriba (spectate bot-vs-bot §9.2b)', () => {
    it('sin handPlayerOne/Two no hay manos reveladas (se cae a dorsos/myCards)', () => {
      const view = deriveMatchView(mockMatchViewerPlayerOne);
      expect(view.self.revealedHandCards).toBeNull();
      expect(view.opponent.revealedHandCards).toBeNull();
      expect(view.self.handCards).toEqual(mockMatchViewerPlayerOne.roundGame!.myCards);
      expect(view.opponent.handCards).toBeNull();
    });

    it('expone ambas manos reveladas y filtra las cartas ya jugadas en mesa', () => {
      const state: MatchState = {
        ...mockMatchViewerPlayerOne,
        roundGame: {
          ...mockMatchViewerPlayerOne.roundGame!,
          // Mano "repartida" completa de cada asiento (lo que llega en HAND_DEALT).
          handPlayerOne: [
            { suit: 'ORO', number: 3 },
            { suit: 'ESPADA', number: 1 },
            { suit: 'BASTO', number: 7 },
          ],
          handPlayerTwo: [
            { suit: 'COPA', number: 5 },
            { suit: 'ESPADA', number: 4 },
            { suit: 'ORO', number: 2 },
          ],
          // PLAYER_ONE bajó el 3 de oro y PLAYER_TWO el 5 de copa (en playedHands).
          playedHands: [
            {
              cardPlayerOne: { suit: 'ORO', number: 3 },
              cardPlayerTwo: { suit: 'COPA', number: 5 },
              winner: 'juancho',
            },
          ],
          currentHand: { cardPlayerOne: null, cardPlayerTwo: null, mano: 'juancho' },
        },
      };

      const view = deriveMatchView(state);
      // Quedan las dos cartas no jugadas de cada asiento.
      expect(view.self.revealedHandCards).toEqual([
        { suit: 'ESPADA', number: 1 },
        { suit: 'BASTO', number: 7 },
      ]);
      expect(view.opponent.revealedHandCards).toEqual([
        { suit: 'ESPADA', number: 4 },
        { suit: 'ORO', number: 2 },
      ]);
    });
  });

  describe('temporizador de turno (013-turn-timer)', () => {
    function withDeadline(seat: 'PLAYER_ONE' | 'PLAYER_TWO' | null) {
      return {
        ...mockMatchViewerPlayerOne,
        roundGame: {
          ...mockMatchViewerPlayerOne.roundGame!,
          actionDeadline: seat === null ? null : 1_000_030_000,
          turnDurationMillis: seat === null ? null : 30_000,
          actionDeadlineSeat: seat,
        },
      };
    }

    it('deadlineIsSelf=true y self.hasActiveDeadline cuando el plazo es del viewer', () => {
      const view = deriveMatchView(withDeadline('PLAYER_ONE'));
      expect(view.deadlineIsSelf).toBe(true);
      expect(view.self.hasActiveDeadline).toBe(true);
      expect(view.opponent.hasActiveDeadline).toBe(false);
      expect(view.actionDeadline).toBe(1_000_030_000);
      expect(view.turnDurationMillis).toBe(30_000);
    });

    it('deadlineIsSelf=false y opponent.hasActiveDeadline cuando el plazo es del rival', () => {
      const view = deriveMatchView(withDeadline('PLAYER_TWO'));
      expect(view.deadlineIsSelf).toBe(false);
      expect(view.self.hasActiveDeadline).toBe(false);
      expect(view.opponent.hasActiveDeadline).toBe(true);
    });

    it('deadlineIsSelf=null y sin reloj activo cuando no hay plazo', () => {
      const view = deriveMatchView(withDeadline(null));
      expect(view.deadlineIsSelf).toBeNull();
      expect(view.self.hasActiveDeadline).toBe(false);
      expect(view.opponent.hasActiveDeadline).toBe(false);
      expect(view.actionDeadline).toBeNull();
    });

    it('sin reloj cuando roundGame es null', () => {
      const view = deriveMatchView({ ...mockMatchViewerPlayerOne, roundGame: null });
      expect(view.deadlineIsSelf).toBeNull();
      expect(view.self.hasActiveDeadline).toBe(false);
      expect(view.opponent.hasActiveDeadline).toBe(false);
    });
  });
});
