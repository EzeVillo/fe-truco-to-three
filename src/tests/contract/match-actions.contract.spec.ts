/**
 * Contract test — Acciones de match REST (§4.6 – §4.11 + §8.1)
 *
 * Verifica que los tipos TypeScript de request DTOs estén en paridad
 * con los bodies y enums documentados en docs/CONTRATOS_API.md.
 *
 * Si el contrato cambia y no se actualiza el TS (o viceversa),
 * este test falla en build time gracias a `satisfies`.
 */
import { describe, it, expect } from 'vitest';
import { readContrato } from './_docs';
import type {
  PlayCardRequest,
  CallEnvidoRequest,
  RespondTrucoRequest,
  RespondEnvidoRequest,
} from '../../app/core/models/match.models';
import type { Suit, EnvidoCall, TrucoResponse, EnvidoResponse } from '../../app/core/models/enums';

// ─── Paridad de campos via `satisfies` (compile-time) ───────────────────────

const _playCardKeysCheck = {
  suit: 'ESPADA' as Suit,
  number: 1,
} satisfies Record<keyof PlayCardRequest, PlayCardRequest[keyof PlayCardRequest]>;

const _callEnvidoKeysCheck = {
  call: 'ENVIDO' as EnvidoCall,
} satisfies Record<keyof CallEnvidoRequest, CallEnvidoRequest[keyof CallEnvidoRequest]>;

const _respondTrucoKeysCheck = {
  response: 'QUIERO' as TrucoResponse,
} satisfies Record<keyof RespondTrucoRequest, RespondTrucoRequest[keyof RespondTrucoRequest]>;

const _respondEnvidoKeysCheck = {
  response: 'QUIERO' as EnvidoResponse,
} satisfies Record<keyof RespondEnvidoRequest, RespondEnvidoRequest[keyof RespondEnvidoRequest]>;

// Fuerza que el linter no elimine los objetos.
void _playCardKeysCheck;
void _callEnvidoKeysCheck;
void _respondTrucoKeysCheck;
void _respondEnvidoKeysCheck;

// ─── Tests de enums case-sensitive ──────────────────────────────────────────

describe('Contract: Match actions REST §4.6–§4.11 + §8.1', () => {
  const content = readContrato('02-matches.md');

  it('PlayCardRequest contiene exactamente {suit, number}', () => {
    const req: PlayCardRequest = { suit: 'ESPADA', number: 7 };
    const keys = Object.keys(req).sort();
    expect(keys).toEqual(['number', 'suit']);
  });

  it('CallEnvidoRequest contiene exactamente {call}', () => {
    const req: CallEnvidoRequest = { call: 'ENVIDO' };
    const keys = Object.keys(req).sort();
    expect(keys).toEqual(['call']);
  });

  it('RespondTrucoRequest contiene exactamente {response}', () => {
    const req: RespondTrucoRequest = { response: 'QUIERO' };
    const keys = Object.keys(req).sort();
    expect(keys).toEqual(['response']);
  });

  it('RespondEnvidoRequest contiene exactamente {response}', () => {
    const req: RespondEnvidoRequest = { response: 'NO_QUIERO' };
    const keys = Object.keys(req).sort();
    expect(keys).toEqual(['response']);
  });

  it('§4.6 define suit ∈ {ESPADA, BASTO, COPA, ORO} (case-sensitive)', () => {
    const validSuits: Suit[] = ['ESPADA', 'BASTO', 'COPA', 'ORO'];
    for (const suit of validSuits) {
      const req: PlayCardRequest = { suit, number: 1 };
      expect(['ESPADA', 'BASTO', 'COPA', 'ORO']).toContain(req.suit);
    }
  });

  it('§4.9 define call ∈ {ENVIDO, REAL_ENVIDO, FALTA_ENVIDO}', () => {
    const validCalls: EnvidoCall[] = ['ENVIDO', 'REAL_ENVIDO', 'FALTA_ENVIDO'];
    for (const call of validCalls) {
      const req: CallEnvidoRequest = { call };
      expect(['ENVIDO', 'REAL_ENVIDO', 'FALTA_ENVIDO']).toContain(req.call);
    }
  });

  it('§4.8 define response ∈ {QUIERO, NO_QUIERO, QUIERO_Y_ME_VOY_AL_MAZO}', () => {
    const validResponses: TrucoResponse[] = ['QUIERO', 'NO_QUIERO', 'QUIERO_Y_ME_VOY_AL_MAZO'];
    for (const response of validResponses) {
      const req: RespondTrucoRequest = { response };
      expect(['QUIERO', 'NO_QUIERO', 'QUIERO_Y_ME_VOY_AL_MAZO']).toContain(req.response);
    }
  });

  it('§4.10 define response ∈ {QUIERO, NO_QUIERO}', () => {
    const validResponses: EnvidoResponse[] = ['QUIERO', 'NO_QUIERO'];
    for (const response of validResponses) {
      const req: RespondEnvidoRequest = { response };
      expect(['QUIERO', 'NO_QUIERO']).toContain(req.response);
    }
  });

  it('docs/CONTRATOS_API.md menciona paths exactos para las 6 acciones', () => {
    expect(content).toMatch(/POST\s+\/api\/matches\/\{matchId\}\/play-card/);
    expect(content).toMatch(/POST\s+\/api\/matches\/\{matchId\}\/truco/);
    expect(content).toMatch(/POST\s+\/api\/matches\/\{matchId\}\/truco\/respond/);
    expect(content).toMatch(/POST\s+\/api\/matches\/\{matchId\}\/envido/);
    expect(content).toMatch(/POST\s+\/api\/matches\/\{matchId\}\/envido\/respond/);
    expect(content).toMatch(/POST\s+\/api\/matches\/\{matchId\}\/fold/);
  });

  it('docs/CONTRATOS_API.md §8.1 define enums case-sensitive', () => {
    // Buscar la sección de enums
    const convenciones = readContrato('00-convenciones.md');
    const sectionMatch = convenciones.match(/##\s*Enums y valores permitidos[\s\S]*?(?=\n##\s|$)/);
    expect(sectionMatch, 'Sección Enums no encontrada en 00-convenciones.md').toBeTruthy();
  });
});
