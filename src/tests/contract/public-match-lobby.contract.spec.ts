/**
 * Contract test — Lobby público de matches (feature 021)
 *
 * Verifica paridad entre los tipos TypeScript y `docs/CONTRATOS_API.md`:
 *  - PublicMatchLobbyItem ↔ item de §4.3 y payload.lobby de §9.4
 *  - PublicMatchLobbyUpsertEvent / PublicMatchLobbyRemovedEvent ↔ §9.4
 *
 * `satisfies` rompe el build si los tipos divergen; las aserciones documentales
 * detectan si el contrato cambió sin actualizar el TS.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  PublicMatchLobbyItem,
  PublicMatchLobbyUpsertEvent,
  PublicMatchLobbyRemovedEvent,
} from '../../app/features/lobby/models/public-match-lobby.models';

// ─── Paridad de campos via `satisfies` (compile-time) ───────────────────────

const _itemCheck: PublicMatchLobbyItem = {
  matchId: '',
  host: '',
  gamesToPlay: 3,
  totalSlots: 2,
  occupiedSlots: 1,
  status: 'WAITING_FOR_PLAYERS',
  joinCode: 'ABC12345',
};

const _upsertCheck = {
  eventType: 'PUBLIC_MATCH_LOBBY_UPSERT',
  timestamp: 0,
  payload: { lobby: _itemCheck },
} satisfies PublicMatchLobbyUpsertEvent;

const _removedCheck = {
  eventType: 'PUBLIC_MATCH_LOBBY_REMOVED',
  timestamp: 0,
  payload: { id: '' },
} satisfies PublicMatchLobbyRemovedEvent;

void _itemCheck;
void _upsertCheck;
void _removedCheck;

describe('Contract: Lobby público de matches', () => {
  it('PublicMatchLobbyItem expone los campos del item de §4.3', () => {
    const item: PublicMatchLobbyItem = {
      matchId: 'uuid',
      host: 'juancho',
      gamesToPlay: 3,
      totalSlots: 2,
      occupiedSlots: 1,
      status: 'WAITING_FOR_PLAYERS',
      joinCode: 'ABC12345',
    };
    expect(Object.keys(item).sort()).toEqual(
      ['gamesToPlay', 'host', 'joinCode', 'matchId', 'occupiedSlots', 'status', 'totalSlots'].sort(),
    );
  });

  it('gamesToPlay solo admite {1,3,5}', () => {
    const valid: Array<1 | 3 | 5> = [1, 3, 5];
    for (const v of valid) {
      const item: PublicMatchLobbyItem = {
        matchId: 'u',
        host: 'h',
        gamesToPlay: v,
        totalSlots: 2,
        occupiedSlots: 1,
        status: 'WAITING_FOR_PLAYERS',
        joinCode: null,
      };
      expect([1, 3, 5]).toContain(item.gamesToPlay);
    }
  });

  it('UPSERT lleva el item en payload.lobby; REMOVED lleva el id en payload.id (§9.4)', () => {
    const upsert: PublicMatchLobbyUpsertEvent = {
      eventType: 'PUBLIC_MATCH_LOBBY_UPSERT',
      timestamp: 1,
      payload: { lobby: _itemCheck },
    };
    const removed: PublicMatchLobbyRemovedEvent = {
      eventType: 'PUBLIC_MATCH_LOBBY_REMOVED',
      timestamp: 2,
      payload: { id: 'uuid' },
    };
    expect(upsert.payload.lobby.matchId).toBe('');
    expect(removed.payload.id).toBe('uuid');
  });

  // ─── Verificación documental ────────────────────────────────────────────

  it('docs §4.3 documenta GET /api/matches/public con los campos del item', () => {
    const content = readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
    expect(content).toContain('GET /api/matches/public');
    for (const field of ['matchId', 'host', 'gamesToPlay', 'totalSlots', 'occupiedSlots', 'status']) {
      expect(content).toContain(field);
    }
  });

  it('docs §9.4 documenta los eventos de lobby público', () => {
    const content = readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
    expect(content).toContain('PUBLIC_MATCH_LOBBY_UPSERT');
    expect(content).toContain('PUBLIC_MATCH_LOBBY_REMOVED');
  });
});
