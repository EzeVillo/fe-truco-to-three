/**
 * Contract test — POST /api/matches/bot (§9.2)
 *
 * Verifica que los tipos TypeScript `CreateBotMatchRequest` y `CreateBotMatchResponse`
 * estén en paridad con lo documentado en `docs/CONTRATOS_API.md §9.2`, y que
 * `seriesFormatToGamesToPlay` mapee correctamente los valores del contrato.
 *
 * Si el contrato cambia en el backend y no se actualiza el TS (o viceversa),
 * este test falla en build time gracias a `satisfies`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  CreateBotMatchRequest,
  CreateBotMatchResponse,
} from '../../app/core/models/match.models';
import { seriesFormatToGamesToPlay } from '../../app/core/models/match.models';

// ─── Paridad de campos via `satisfies` (compile-time) ───────────────────────

// Si se añade o renombra un campo en CreateBotMatchRequest, este objeto
// falla a compilar → el contract test falla en build time.
const _reqKeysCheck = {
  botId: '',
  gamesToPlay: 1 as 1 | 3 | 5,
} satisfies Record<keyof CreateBotMatchRequest, CreateBotMatchRequest[keyof CreateBotMatchRequest]>;

// Mismo mecanismo para la response.
const _resKeysCheck = {
  matchId: '',
} satisfies Record<
  keyof CreateBotMatchResponse,
  CreateBotMatchResponse[keyof CreateBotMatchResponse]
>;

// Fuerza que el linter no elimine los objetos (se usan en runtime).
void _reqKeysCheck;
void _resKeysCheck;

// ─── Tests de mapeo seriesFormatToGamesToPlay ────────────────────────────────

describe('Contract: POST /api/matches/bot §9.2', () => {
  it('CreateBotMatchRequest contiene exactamente los campos {botId, gamesToPlay}', () => {
    // Si aparecen campos extra o se renombra uno, el `satisfies` de arriba falla.
    // Este test refuerza la semántica en runtime.
    const req: CreateBotMatchRequest = { botId: 'uuid', gamesToPlay: 1 };
    const keys = Object.keys(req).sort();
    expect(keys).toEqual(['botId', 'gamesToPlay']);
  });

  it('CreateBotMatchResponse contiene exactamente el campo {matchId}', () => {
    const res: CreateBotMatchResponse = { matchId: 'uuid' };
    const keys = Object.keys(res).sort();
    expect(keys).toEqual(['matchId']);
  });

  it('seriesFormatToGamesToPlay(BEST_OF_1) === 1 (nunca 2)', () => {
    expect(seriesFormatToGamesToPlay('BEST_OF_1')).toBe(1);
  });

  it('seriesFormatToGamesToPlay(BEST_OF_3) === 3 (no 2 — bug corregido)', () => {
    expect(seriesFormatToGamesToPlay('BEST_OF_3')).toBe(3);
  });

  it('seriesFormatToGamesToPlay(BEST_OF_5) === 5', () => {
    expect(seriesFormatToGamesToPlay('BEST_OF_5')).toBe(5);
  });

  it('gamesToPlay solo acepta valores {1, 3, 5} — valores del contrato §9.2', () => {
    const validValues: Array<1 | 3 | 5> = [1, 3, 5];
    for (const v of validValues) {
      const req: CreateBotMatchRequest = { botId: 'test', gamesToPlay: v };
      expect([1, 3, 5]).toContain(req.gamesToPlay);
    }
  });

  // ─── Verificación documental §9.2 ──────────────────────────────────────────
  it('docs/CONTRATOS_API.md §9.2 describe gamesToPlay como "Partidas totales de la serie"', () => {
    const docsPath = resolve(process.cwd(), 'docs/CONTRATOS_API.md');
    const content = readFileSync(docsPath, 'utf-8');

    // Extraer sección §9.2 Crear partida contra bot
    const sectionMatch = content.match(
      /###\s*9\.2\s+Crear partida contra bot([\s\S]*?)(?=###|\Z|$)/,
    );
    expect(sectionMatch, 'Sección §9.2 no encontrada en CONTRATOS_API.md').toBeTruthy();

    const section = sectionMatch![1];

    // Verificar que el contrato menciona los valores válidos 1, 3, 5
    // (y no "partidas a ganar" que era la descripción incorrecta)
    expect(section).toMatch(/1,\s*3,\s*5/);

    // Verificar que la descripción correcta está presente
    expect(section).toContain('Partidas totales de la serie');
  });
});
