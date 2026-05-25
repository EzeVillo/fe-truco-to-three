import { describe, it, expect } from 'vitest';
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
});
