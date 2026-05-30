import { describe, it, expect } from 'vitest';
import {
  URGENCY_THRESHOLD_MS,
  computeRemainingMsFromEvent,
  computeRemainingMsFromSnapshot,
  isUrgent,
  computeElapsedFraction,
  hasActiveDeadline,
} from './turn-timer';

describe('turn-timer', () => {
  describe('computeRemainingMsFromEvent', () => {
    it('calcula el restante usando el timestamp del servidor (independiente del reloj local)', () => {
      // deadline 30s después del "ahora" del servidor
      expect(computeRemainingMsFromEvent(1_000_030_000, 1_000_000_000)).toBe(30_000);
    });

    it('normaliza a 0 cuando el plazo ya venció', () => {
      expect(computeRemainingMsFromEvent(1_000_000_000, 1_000_005_000)).toBe(0);
    });
  });

  describe('computeRemainingMsFromSnapshot', () => {
    it('corrige el desfase de reloj con el offset servidor↔cliente', () => {
      // cliente atrasado 2s respecto al servidor → offset +2000
      // now cliente = 1_000_000_000, offset = 2000 → ahora servidor = 1_000_002_000
      // deadline = 1_000_032_000 → restante = 30_000
      const remaining = computeRemainingMsFromSnapshot(1_000_032_000, 2000, 1_000_000_000);
      expect(remaining).toBe(30_000);
    });

    it('usa offset 0 cuando no hubo eventos previos', () => {
      expect(computeRemainingMsFromSnapshot(1_000_010_000, 0, 1_000_000_000)).toBe(10_000);
    });

    it('normaliza a 0 cuando el deadline del snapshot ya pasó (FR-013)', () => {
      expect(computeRemainingMsFromSnapshot(1_000_000_000, 0, 1_000_009_000)).toBe(0);
    });
  });

  describe('isUrgent', () => {
    it('es urgente en el límite exacto de 5000 ms', () => {
      expect(isUrgent(URGENCY_THRESHOLD_MS)).toBe(true);
      expect(isUrgent(5001)).toBe(false);
      expect(isUrgent(0)).toBe(true);
    });
  });

  describe('computeElapsedFraction', () => {
    it('0 al inicio, 1 al agotarse', () => {
      expect(computeElapsedFraction(30_000, 30_000)).toBe(0);
      expect(computeElapsedFraction(0, 30_000)).toBe(1);
      expect(computeElapsedFraction(15_000, 30_000)).toBe(0.5);
    });

    it('clampa restante fuera de rango', () => {
      expect(computeElapsedFraction(40_000, 30_000)).toBe(0);
      expect(computeElapsedFraction(-5_000, 30_000)).toBe(1);
    });

    it('duración inválida → agotado (FR-013)', () => {
      expect(computeElapsedFraction(10_000, 0)).toBe(1);
    });
  });

  describe('hasActiveDeadline', () => {
    it('true sólo si los tres campos son válidos', () => {
      expect(hasActiveDeadline(1_000_000_000, 30_000, 'PLAYER_ONE')).toBe(true);
    });

    it('false si falta cualquier campo o la duración no es positiva (FR-013)', () => {
      expect(hasActiveDeadline(null, 30_000, 'PLAYER_ONE')).toBe(false);
      expect(hasActiveDeadline(1_000_000_000, null, 'PLAYER_ONE')).toBe(false);
      expect(hasActiveDeadline(1_000_000_000, 30_000, null)).toBe(false);
      expect(hasActiveDeadline(1_000_000_000, 0, 'PLAYER_ONE')).toBe(false);
    });
  });
});
