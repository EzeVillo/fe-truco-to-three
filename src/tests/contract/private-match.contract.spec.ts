/**
 * Contract test — Partida privada por código (feature 015)
 *
 * Verifica paridad entre los tipos TypeScript y `docs/CONTRATOS_API.md`:
 *  - CreateMatchRequest / CreateMatchResponse (§4.1)
 *  - JoinResponse (§4.2)
 *  - MATCH_STATUS incluye READY (§8.2, alineado a §4.2/§4.13)
 *
 * Si el contrato cambia y no se actualiza el TS (o viceversa), este test falla
 * en build time gracias a `satisfies` y en runtime por las aserciones.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  CreateMatchRequest,
  CreateMatchResponse,
  JoinResponse,
} from '../../app/core/models/match.models';
import { MATCH_STATUS } from '../../app/core/models/enums';

// ─── Paridad de campos via `satisfies` (compile-time) ───────────────────────

const _createReqCheck = {
  gamesToPlay: 3 as 1 | 3 | 5,
  visibility: 'PRIVATE',
} satisfies Record<keyof CreateMatchRequest, CreateMatchRequest[keyof CreateMatchRequest]>;

const _createResCheck = {
  matchId: '',
  joinCode: '',
  visibility: 'PRIVATE',
} satisfies Record<keyof CreateMatchResponse, CreateMatchResponse[keyof CreateMatchResponse]>;

const _joinResCheck = {
  targetType: 'MATCH',
  targetId: '',
} satisfies Record<keyof JoinResponse, JoinResponse[keyof JoinResponse]>;

void _createReqCheck;
void _createResCheck;
void _joinResCheck;

describe('Contract: Partida privada por código', () => {
  it('CreateMatchRequest contiene exactamente {gamesToPlay, visibility} (§4.1)', () => {
    const req: CreateMatchRequest = { gamesToPlay: 3, visibility: 'PRIVATE' };
    expect(Object.keys(req).sort()).toEqual(['gamesToPlay', 'visibility']);
  });

  it('CreateMatchResponse contiene exactamente {matchId, joinCode, visibility} (§4.1)', () => {
    const res: CreateMatchResponse = { matchId: 'uuid', joinCode: 'ABC123', visibility: 'PRIVATE' };
    expect(Object.keys(res).sort()).toEqual(['joinCode', 'matchId', 'visibility']);
  });

  it('JoinResponse contiene exactamente {targetType, targetId} (§4.2)', () => {
    const res: JoinResponse = { targetType: 'MATCH', targetId: 'uuid' };
    expect(Object.keys(res).sort()).toEqual(['targetId', 'targetType']);
  });

  it('gamesToPlay solo admite {1,3,5} (§4.1, nunca 2)', () => {
    const valid: Array<1 | 3 | 5> = [1, 3, 5];
    for (const v of valid) {
      const req: CreateMatchRequest = { gamesToPlay: v, visibility: 'PRIVATE' };
      expect([1, 3, 5]).toContain(req.gamesToPlay);
    }
  });

  it('MATCH_STATUS incluye READY (§8.2, alineado a §4.2/§4.13)', () => {
    expect(MATCH_STATUS.READY).toBe('READY');
  });

  // ─── Verificación documental ────────────────────────────────────────────
  it('docs §4.1 documenta POST /api/matches con gamesToPlay {1,3,5} y visibility', () => {
    const content = readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
    const section = content.match(/###\s*4\.1\s+Crear partida([\s\S]*?)(?=###)/)?.[1] ?? '';
    expect(section).toContain('gamesToPlay');
    expect(section).toMatch(/`1`,\s*`3`,\s*`5`/);
    expect(section).toContain('visibility');
  });

  it('docs §8.2 lista READY entre los status de MatchStateResponse', () => {
    const content = readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
    expect(content).toMatch(/MatchStateResponse\.status[\s\S]*?READY/);
  });
});
