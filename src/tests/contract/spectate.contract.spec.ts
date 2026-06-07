/**
 * Contract test — GET /api/matches/{matchId}/spectate (§4.15) + §7.4.5 spectatableMatch
 *
 * Verifica paridad en tiempo de compilación entre los tipos TypeScript y el contrato
 * documentado. Si se añaden/renombran campos en los modelos sin actualizar el contrato
 * (o viceversa), este archivo falla a compilar.
 */
import { describe, it, expect } from 'vitest';
import type { SpectateMatchState, SpectateRoundState, SpectatableMatch } from '../../app/core/models/spectate.models';
import type { FriendSummary } from '../../app/core/models/social.models';

// ─── Paridad de SpectateMatchState (§4.15) via satisfies ─────────────────────

const _spectateMatchStateCheck = {
  matchId: '',
  status: 'IN_PROGRESS' as const,
  scorePlayerOne: 0,
  scorePlayerTwo: 0,
  gamesWonPlayerOne: 0,
  gamesWonPlayerTwo: 0,
  matchWinner: null,
  stateVersion: 0,
  currentRound: null,
  spectatorCount: 0,
  playerOneUsername: '',
  playerTwoUsername: null,
  gamesToPlay: 3 as 1 | 3 | 5,
} satisfies Record<
  keyof SpectateMatchState,
  SpectateMatchState[keyof SpectateMatchState]
>;

void _spectateMatchStateCheck;

// ─── Paridad de SpectatableMatch (§7.4.5) ────────────────────────────────────

const _spectatableMatchCheck = {
  id: '',
  status: 'IN_PROGRESS' as const,
} satisfies Record<keyof SpectatableMatch, SpectatableMatch[keyof SpectatableMatch]>;

void _spectatableMatchCheck;

// ─── FriendSummary incluye spectatableMatch (§7.4.5, feature 026) ────────────

const _friendSummaryWithSpectate: FriendSummary = {
  friendUsername: 'alice',
  online: true,
  availability: 'AVAILABLE',
  busyReason: null,
  spectatableMatch: { id: 'match-uuid', status: 'IN_PROGRESS' },
};

void _friendSummaryWithSpectate;

// ─── Tests runtime ───────────────────────────────────────────────────────────

describe('Contract: GET /api/matches/{matchId}/spectate §4.15', () => {
  it('SpectateMatchState tiene los campos requeridos del contrato', () => {
    const state: SpectateMatchState = {
      matchId: 'match-1',
      status: 'IN_PROGRESS',
      scorePlayerOne: 0,
      scorePlayerTwo: 0,
      gamesWonPlayerOne: 0,
      gamesWonPlayerTwo: 0,
      matchWinner: null,
      stateVersion: 1,
      currentRound: null,
      spectatorCount: 1,
      playerOneUsername: 'alice',
      playerTwoUsername: 'bob',
      gamesToPlay: 3,
    };

    const requiredFields: (keyof SpectateMatchState)[] = [
      'matchId', 'status', 'scorePlayerOne', 'scorePlayerTwo',
      'gamesWonPlayerOne', 'gamesWonPlayerTwo', 'matchWinner',
      'stateVersion', 'currentRound', 'spectatorCount',
      'playerOneUsername', 'playerTwoUsername', 'gamesToPlay',
    ];
    for (const field of requiredFields) {
      expect(state).toHaveProperty(field);
    }
  });

  it('SpectateMatchState no contiene myCards ni availableActions', () => {
    const state: SpectateMatchState = {
      matchId: 'match-1',
      status: 'IN_PROGRESS',
      scorePlayerOne: 0,
      scorePlayerTwo: 0,
      gamesWonPlayerOne: 0,
      gamesWonPlayerTwo: 0,
      matchWinner: null,
      stateVersion: 1,
      currentRound: null,
      spectatorCount: 1,
      playerOneUsername: 'alice',
      playerTwoUsername: 'bob',
      gamesToPlay: 3,
    };

    expect(state).not.toHaveProperty('myCards');
    expect(state).not.toHaveProperty('availableActions');
  });

  it('playerTwoUsername nullable (§4.15 — rival puede no estar sentado)', () => {
    const state: SpectateMatchState = {
      matchId: 'match-1',
      status: 'IN_PROGRESS',
      scorePlayerOne: 0,
      scorePlayerTwo: 0,
      gamesWonPlayerOne: 0,
      gamesWonPlayerTwo: 0,
      matchWinner: null,
      stateVersion: 1,
      currentRound: null,
      spectatorCount: 0,
      playerOneUsername: 'alice',
      playerTwoUsername: null,
      gamesToPlay: 1,
    };
    expect(state.playerTwoUsername).toBeNull();
  });

  it('gamesToPlay acepta exactamente {1, 3, 5}', () => {
    const values: (1 | 3 | 5)[] = [1, 3, 5];
    for (const v of values) {
      const state: SpectateMatchState = {
        matchId: 'x', status: 'IN_PROGRESS',
        scorePlayerOne: 0, scorePlayerTwo: 0,
        gamesWonPlayerOne: 0, gamesWonPlayerTwo: 0,
        matchWinner: null, stateVersion: 0, currentRound: null,
        spectatorCount: 0, playerOneUsername: 'a', playerTwoUsername: 'b',
        gamesToPlay: v,
      };
      expect(state.gamesToPlay).toBe(v);
    }
  });
});

describe('Contract: SpectatableMatch (§7.4.5)', () => {
  it('tiene campos id (UUID) y status = IN_PROGRESS', () => {
    const m: SpectatableMatch = { id: 'uuid-xyz', status: 'IN_PROGRESS' };
    expect(m.id).toBe('uuid-xyz');
    expect(m.status).toBe('IN_PROGRESS');
  });
});

describe('Contract: FriendSummary.spectatableMatch (§7.4.5)', () => {
  it('spectatableMatch es tipeable como null o SpectatableMatch', () => {
    const withMatch: FriendSummary = {
      friendUsername: 'bob',
      online: true,
      availability: 'BUSY',
      busyReason: 'IN_MATCH',
      spectatableMatch: { id: 'match-42', status: 'IN_PROGRESS' },
    };
    const withNull: FriendSummary = {
      friendUsername: 'carol',
      online: false,
      availability: 'AVAILABLE',
      busyReason: null,
      spectatableMatch: null,
    };
    expect(withMatch.spectatableMatch?.id).toBe('match-42');
    expect(withNull.spectatableMatch).toBeNull();
  });
});
