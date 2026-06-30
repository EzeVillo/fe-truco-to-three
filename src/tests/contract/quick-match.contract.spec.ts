/**
 * Contract test - POST/DELETE /api/matches/quick (§9.3)
 *
 * `gamesToPlay` representa partidas totales de la serie:
 * BEST_OF_1 -> 1, BEST_OF_3 -> 3, BEST_OF_5 -> 5.
 */
import { describe, it, expect } from 'vitest';
import { readContrato } from './_docs';
import type { QuickMatchRequest, QuickMatchResponse } from '../../app/core/models/match.models';
import { seriesFormatToGamesToPlay } from '../../app/core/models/match.models';

const _reqKeysCheck = {
  gamesToPlay: 1 as 1 | 3 | 5,
} satisfies Record<keyof QuickMatchRequest, QuickMatchRequest[keyof QuickMatchRequest]>;

const _resKeysCheck = {
  status: 'SEARCHING' as 'SEARCHING' | 'MATCHED',
  matchId: null as string | null,
  enqueuedAt: '',
} satisfies Record<keyof QuickMatchResponse, QuickMatchResponse[keyof QuickMatchResponse]>;

void _reqKeysCheck;
void _resKeysCheck;

function quickMatchSection(): string {
  const content = readContrato('08-bots.md');
  const sectionMatch = content.match(/##\s*Quick Match[\s\S]*$/);
  expect(sectionMatch, 'Seccion Quick Match no encontrada en 08-bots.md').toBeTruthy();
  return sectionMatch![0];
}

describe('Contract: Quick Match §9.3', () => {
  it('QuickMatchRequest contiene exactamente {gamesToPlay}', () => {
    const req: QuickMatchRequest = { gamesToPlay: 3 };
    expect(Object.keys(req).sort()).toEqual(['gamesToPlay']);
  });

  it('QuickMatchResponse contiene exactamente {enqueuedAt, matchId, status}', () => {
    const res: QuickMatchResponse = {
      status: 'SEARCHING',
      matchId: null,
      enqueuedAt: '2026-05-20T10:00:00Z',
    };
    expect(Object.keys(res).sort()).toEqual(['enqueuedAt', 'matchId', 'status']);
  });

  it('gamesToPlay usa partidas totales de serie {1, 3, 5}', () => {
    expect(seriesFormatToGamesToPlay('BEST_OF_1')).toBe(1);
    expect(seriesFormatToGamesToPlay('BEST_OF_3')).toBe(3);
    expect(seriesFormatToGamesToPlay('BEST_OF_5')).toBe(5);
  });

  it('docs/CONTRATOS_API.md §9.3 documenta entrada, cancelacion y estados', () => {
    const section = quickMatchSection();

    expect(section).toContain('POST /api/matches/quick');
    expect(section).toContain('DELETE /api/matches/quick');
    expect(section).toContain('"gamesToPlay": 3');
    expect(section).toContain('"status": "SEARCHING"');
    expect(section).toContain('"status": "MATCHED"');
    expect(section).toContain('"matchId": null');
    expect(section).toContain('/user/queue/match');
    expect(section).toContain('GAME_STARTED');
  });
});
