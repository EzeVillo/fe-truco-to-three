import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  derivePresenceDestination,
  type PresenceWsEvent,
  type UserPresenceResponse,
} from '../../app/core/models/presence.models';

const _presenceCheck = {
  busy: true,
  match: { id: 'match-1', status: 'IN_PROGRESS' },
  league: null,
  cup: null,
  rematch: null,
  quickMatch: null,
  spectating: null,
  ownedBotMatch: null,
} satisfies UserPresenceResponse;

const _eventCheck = {
  eventType: 'PRESENCE_UPDATED',
  timestamp: 1,
  payload: _presenceCheck,
} satisfies PresenceWsEvent;

void _presenceCheck;
void _eventCheck;

function docs(): string {
  return readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
}

describe('Contract: presencia / reconexion §7.6', () => {
  it('docs/CONTRATOS_API.md documenta endpoint REST, cola WS y evento de presencia', () => {
    const content = docs();

    expect(content).toContain('GET /api/me/presence');
    expect(content).toContain('/user/queue/presence');
    expect(content).toContain('PRESENCE_UPDATED');
  });

  it('docs/CONTRATOS_API.md documenta el shape completo de UserPresenceResponse', () => {
    const content = docs();

    for (const field of ['busy', 'match', 'league', 'cup', 'rematch', 'quickMatch']) {
      expect(content).toContain(`"${field}"`);
    }
    expect(content).toContain('"originMatchId"');
    expect(content).toContain('WAITING_FOR_PLAYERS');
    expect(content).toContain('READY');
    expect(content).toContain('IN_PROGRESS');
  });

  it('derivePresenceDestination prioriza match activo', () => {
    const presence: UserPresenceResponse = {
      busy: true,
      match: { id: 'match-1', status: 'READY' },
      league: null,
      cup: null,
      rematch: { id: 'session-1', originMatchId: 'origin-1' },
      quickMatch: null,
      spectating: null,
      ownedBotMatch: null,
    };

    expect(derivePresenceDestination(presence)).toEqual({ kind: 'match', matchId: 'match-1' });
  });

  it('derivePresenceDestination usa rematch si no hay match activo', () => {
    const presence: UserPresenceResponse = {
      busy: true,
      match: null,
      league: null,
      cup: null,
      rematch: { id: 'session-1', originMatchId: 'origin-1' },
      quickMatch: null,
      spectating: null,
      ownedBotMatch: null,
    };

    expect(derivePresenceDestination(presence)).toEqual({
      kind: 'rematch',
      originMatchId: 'origin-1',
    });
  });

  it('derivePresenceDestination devuelve spectate cuando el usuario está mirando', () => {
    const presence: UserPresenceResponse = {
      busy: true,
      match: null,
      league: null,
      cup: null,
      rematch: null,
      quickMatch: null,
      spectating: { matchId: 'spectate-match-abc' },
      ownedBotMatch: null,
    };

    expect(derivePresenceDestination(presence)).toEqual({
      kind: 'spectate',
      matchId: 'spectate-match-abc',
    });
  });

  it('derivePresenceDestination: match/rematch tienen prioridad sobre spectating', () => {
    const presence: UserPresenceResponse = {
      busy: true,
      match: { id: 'match-1', status: 'IN_PROGRESS' },
      league: null,
      cup: null,
      rematch: null,
      quickMatch: null,
      spectating: { matchId: 'spectate-match-abc' },
      ownedBotMatch: null,
    };
    expect(derivePresenceDestination(presence).kind).toBe('match');
  });

  it('derivePresenceDestination manda al dueño de una bot-match a espectarla', () => {
    const presence: UserPresenceResponse = {
      busy: true,
      match: null,
      league: null,
      cup: null,
      rematch: null,
      quickMatch: null,
      spectating: null,
      ownedBotMatch: { matchId: 'bot-duel-1', status: 'IN_PROGRESS' },
    };

    expect(derivePresenceDestination(presence)).toEqual({
      kind: 'spectate',
      matchId: 'bot-duel-1',
    });
  });

  it('derivePresenceDestination ignora usuario libre y torneos en v1', () => {
    const free: UserPresenceResponse = {
      busy: false,
      match: null,
      league: null,
      cup: null,
      rematch: null,
      quickMatch: null,
      spectating: null,
      ownedBotMatch: null,
    };
    const tournamentOnly: UserPresenceResponse = {
      busy: true,
      match: null,
      league: { id: 'league-1', status: 'IN_PROGRESS', currentMatchId: 'match-league' },
      cup: null,
      rematch: null,
      quickMatch: null,
      spectating: null,
      ownedBotMatch: null,
    };
    const quickMatchOnly: UserPresenceResponse = {
      busy: true,
      match: null,
      league: null,
      cup: null,
      rematch: null,
      quickMatch: { status: 'SEARCHING', enqueuedAt: '2026-05-20T10:00:00Z' },
      spectating: null,
      ownedBotMatch: null,
    };

    expect(derivePresenceDestination(free)).toEqual({ kind: 'none' });
    expect(derivePresenceDestination(tournamentOnly)).toEqual({ kind: 'none' });
    expect(derivePresenceDestination(quickMatchOnly)).toEqual({ kind: 'none' });
  });
});
