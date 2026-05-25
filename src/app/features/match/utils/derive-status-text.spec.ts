import { describe, it, expect } from 'vitest';
import { deriveStatusText } from './derive-status-text';
import {
  mockMatchViewerPlayerOne,
  mockMatchViewerPlayerTwo,
  mockMatchEmptyTable,
  mockMatchAsymmetricHand,
} from '../mocks/match-state.mocks';

describe('deriveStatusText', () => {
  it('returns "Esperando inicio" when status is not IN_PROGRESS', () => {
    const state = { ...mockMatchViewerPlayerOne, status: 'FINISHED' as const, roundGame: null };
    expect(deriveStatusText(state)).toBe('Esperando inicio');
  });

  it('returns "Esperando inicio" when roundGame is null', () => {
    const state = { ...mockMatchViewerPlayerOne, roundGame: null };
    expect(deriveStatusText(state)).toBe('Esperando inicio');
  });

  it('returns "Fin de la mano" when roundStatus is FINISHED', () => {
    const state = {
      ...mockMatchViewerPlayerOne,
      roundGame: {
        ...mockMatchViewerPlayerOne.roundGame!,
        roundStatus: 'FINISHED' as const,
      },
    };
    expect(deriveStatusText(state)).toBe('Fin de la mano');
  });

  it('returns "Tu turno" when currentTurn is self', () => {
    const text = deriveStatusText(mockMatchViewerPlayerOne);
    expect(text).toContain('Tu turno');
    expect(text).toContain('Mano 2 de 3');
  });

  it('returns "Turno de {opponent}" when currentTurn is opponent', () => {
    const text = deriveStatusText(mockMatchAsymmetricHand);
    expect(text).toContain('Turno de martina');
    expect(text).toContain('Mano 2 de 3');
  });

  it('returns only hand text when currentTurn is null', () => {
    const state = {
      ...mockMatchViewerPlayerOne,
      roundGame: {
        ...mockMatchViewerPlayerOne.roundGame!,
        currentTurn: null,
      },
    };
    expect(deriveStatusText(state)).toBe('Mano 2 de 3');
  });

  it('counts hand number from playedHands + 1', () => {
    const text = deriveStatusText(mockMatchEmptyTable);
    expect(text).toContain('Mano 1 de 3');
  });
});
