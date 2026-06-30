import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MatchHistoryResponse } from '../../app/core/models/match-history.models';

const _history = {
  entries: [
    {
      matchId: '8b9c5936-9a1f-45ec-a587-24306689f6f7',
      opponentName: 'juancho',
      opponentIsBot: false,
      outcome: 'WON',
      endReason: 'FINISHED',
      ownGamesWon: 3,
      opponentGamesWon: 1,
      endedAt: 1772768158123,
    },
    {
      matchId: '550e8400-e29b-41d4-a716-446655440099',
      opponentName: 'Cacho Toledo',
      opponentIsBot: true,
      outcome: 'LOST',
      endReason: 'ABANDONED',
      ownGamesWon: 1,
      opponentGamesWon: 3,
      endedAt: 1772768000000,
    },
  ],
} satisfies MatchHistoryResponse;

void _history;

function contract(): string {
  // Índice de contratos + sección de perfil/presencia (donde vive el historial).
  return readFileSync(resolve(process.cwd(), 'docs/contratos/07-perfil-presencia.md'), 'utf-8');
}

describe('Contract: Historial de partidas', () => {
  const content = contract();

  it('GET /api/match-history devuelve entries con el shape esperado', () => {
    expect(content).toContain('GET /api/match-history');
    expect(Object.keys(_history).sort()).toEqual(['entries']);
    expect(Object.keys(_history.entries[0]).sort()).toEqual([
      'endReason',
      'endedAt',
      'matchId',
      'opponentGamesWon',
      'opponentIsBot',
      'opponentName',
      'outcome',
      'ownGamesWon',
    ]);
  });

  it('cada campo del entry está documentado en el contrato', () => {
    for (const field of [
      'matchId',
      'opponentName',
      'opponentIsBot',
      'outcome',
      'endReason',
      'ownGamesWon',
      'opponentGamesWon',
      'endedAt',
    ]) {
      expect(content, `falta ${field}`).toContain(field);
    }
  });

  it('los enums de outcome y endReason coinciden con el contrato', () => {
    const outcomes: MatchHistoryResponse['entries'][number]['outcome'][] = ['WON', 'LOST'];
    const endReasons: MatchHistoryResponse['entries'][number]['endReason'][] = [
      'FINISHED',
      'ABANDONED',
      'FORFEITED',
    ];
    for (const value of [...outcomes, ...endReasons]) {
      expect(content, `falta enum ${value}`).toContain(value);
    }
  });

  it('el historial devuelve como máximo 5 partidas, más reciente primero', () => {
    expect(content).toContain('máximo **5**');
    expect(content).toContain('más reciente primero');
  });
});
