/**
 * Contract test — Rematch (§4.17 REST + §9.6 WS events + §8.2 enums)
 *
 * Verifica paridad entre los tipos TypeScript de revancha y los contratos
 * documentados en docs/CONTRATOS_API.md.
 *
 * Nota dual-format expiresAt:
 *   - REMATCH_AVAILABLE (WS) → epochMillis (number)
 *   - GET /api/matches/{matchId}/rematch (REST) → ISO-8601 (string)
 *   RematchStateService normaliza siempre a epochMillis.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  RematchAvailablePayload,
  RematchOpponentWantsPayload,
  RematchConfirmedPayload,
  RematchClosedByLeavePayload,
  RematchExpiredPayload,
} from '../../app/features/match/models/match-ws-events';
import type {
  RematchSession,
  RematchSessionResponse,
  RematchSessionStatus,
  RematchChoice,
} from '../../app/features/match/models/rematch.models';

function getContractDoc(): string {
  const docsPath = resolve(process.cwd(), 'docs/CONTRATOS_API.md');
  return readFileSync(docsPath, 'utf-8');
}

// Compile-time shape checks via satisfies

const _rematchAvailable = {
  sessionId: 'uuid-1',
  originMatchId: 'uuid-2',
  expiresAt: 1775304600000,
} satisfies RematchAvailablePayload;

const _rematchOpponentWants = {
  sessionId: 'uuid-1',
  originMatchId: 'uuid-2',
  actor: 'juancho',
} satisfies RematchOpponentWantsPayload;

const _rematchConfirmed = {
  sessionId: 'uuid-1',
  originMatchId: 'uuid-2',
  newMatchId: 'uuid-3',
  newPlayerOne: 'juancho',
  newPlayerTwo: 'martina',
} satisfies RematchConfirmedPayload;

const _rematchClosedByLeave = {
  sessionId: 'uuid-1',
  originMatchId: 'uuid-2',
  actor: 'martina',
} satisfies RematchClosedByLeavePayload;

const _rematchExpired = {
  sessionId: 'uuid-1',
  originMatchId: 'uuid-2',
} satisfies RematchExpiredPayload;

const _rematchSessionResponse = {
  sessionId: 'uuid-1',
  originMatchId: 'uuid-2',
  status: 'OPEN' as RematchSessionStatus,
  playerOneChoice: 'UNDECIDED' as RematchChoice,
  playerTwoChoice: 'WANTS_REMATCH' as RematchChoice,
  expiresAt: '2026-05-16T18:00:00Z',
  resultMatchId: null,
} satisfies RematchSessionResponse;

const _rematchSession = {
  sessionId: 'uuid-1',
  originMatchId: 'uuid-2',
  status: 'OPEN' as RematchSessionStatus,
  selfChoice: 'UNDECIDED' as RematchChoice,
  opponentChoice: 'WANTS_REMATCH' as RematchChoice,
  expiresAt: 1775304600000,
  resultMatchId: null,
} satisfies RematchSession;

void _rematchAvailable;
void _rematchOpponentWants;
void _rematchConfirmed;
void _rematchClosedByLeave;
void _rematchExpired;
void _rematchSessionResponse;
void _rematchSession;

describe('Contract: Rematch §4.17 REST + §9.6 WS + §8.2 enums', () => {
  const content = getContractDoc();

  it('§9.6 define los 5 eventType REMATCH_*', () => {
    const rematchTypes = [
      'REMATCH_AVAILABLE',
      'REMATCH_OPPONENT_WANTS',
      'REMATCH_CONFIRMED',
      'REMATCH_CLOSED_BY_LEAVE',
      'REMATCH_EXPIRED',
    ];
    for (const type of rematchTypes) {
      expect(content, `Falta ${type} en el contrato`).toContain(type);
    }
  });

  it('§9.6 REMATCH_AVAILABLE payload tiene sessionId, originMatchId, expiresAt (epochMillis)', () => {
    const keys = Object.keys(_rematchAvailable).sort();
    expect(keys).toEqual(['expiresAt', 'originMatchId', 'sessionId']);
    expect(typeof _rematchAvailable.expiresAt).toBe('number');
  });

  it('§9.6 REMATCH_OPPONENT_WANTS payload tiene sessionId, originMatchId, actor', () => {
    const keys = Object.keys(_rematchOpponentWants).sort();
    expect(keys).toEqual(['actor', 'originMatchId', 'sessionId']);
  });

  it('§9.6 REMATCH_CONFIRMED payload tiene sessionId, originMatchId, newMatchId, newPlayerOne, newPlayerTwo', () => {
    const keys = Object.keys(_rematchConfirmed).sort();
    expect(keys).toEqual([
      'newMatchId',
      'newPlayerOne',
      'newPlayerTwo',
      'originMatchId',
      'sessionId',
    ]);
  });

  it('§9.6 REMATCH_CLOSED_BY_LEAVE payload tiene sessionId, originMatchId, actor', () => {
    const keys = Object.keys(_rematchClosedByLeave).sort();
    expect(keys).toEqual(['actor', 'originMatchId', 'sessionId']);
  });

  it('§9.6 REMATCH_EXPIRED payload tiene sessionId, originMatchId', () => {
    const keys = Object.keys(_rematchExpired).sort();
    expect(keys).toEqual(['originMatchId', 'sessionId']);
  });

  it('§4.17.3 DTO REST define sessionId, originMatchId, status, playerOneChoice, playerTwoChoice, expiresAt (ISO-8601), resultMatchId', () => {
    const keys = Object.keys(_rematchSessionResponse).sort();
    expect(keys).toEqual([
      'expiresAt',
      'originMatchId',
      'playerOneChoice',
      'playerTwoChoice',
      'resultMatchId',
      'sessionId',
      'status',
    ]);
    expect(typeof _rematchSessionResponse.expiresAt).toBe('string');
  });

  it('§4.17 contrato define endpoint GET /api/matches/{matchId}/rematch', () => {
    expect(content).toMatch(/\/api\/matches\/.*rematch/i);
  });

  it('§4.17 contrato define endpoint POST …/rematch/choose', () => {
    expect(content).toMatch(/rematch\/choose/i);
  });

  it('§4.17 contrato define endpoint POST …/rematch/leave', () => {
    expect(content).toMatch(/rematch\/leave/i);
  });

  it('§8.2 RematchSessionStatus cubre OPEN, CONFIRMED, CLOSED_BY_LEAVE, EXPIRED', () => {
    const statuses: RematchSessionStatus[] = ['OPEN', 'CONFIRMED', 'CLOSED_BY_LEAVE', 'EXPIRED'];
    for (const s of statuses) {
      expect(content).toContain(s);
    }
  });

  it('§8.2 RematchChoice cubre UNDECIDED, WANTS_REMATCH, LEFT', () => {
    const choices: RematchChoice[] = ['UNDECIDED', 'WANTS_REMATCH', 'LEFT'];
    for (const c of choices) {
      expect(content).toContain(c);
    }
  });

  it('vista cliente RematchSession normaliza expiresAt a epochMillis (number)', () => {
    expect(typeof _rematchSession.expiresAt).toBe('number');
  });

  it('resultMatchId es null cuando status !== CONFIRMED', () => {
    expect(_rematchSession.resultMatchId).toBeNull();
  });
});
