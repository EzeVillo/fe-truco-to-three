import { describe, it, expect } from 'vitest';
import { adaptSpectateToMatchState } from './adapt-spectate-to-match-view';
import type { SpectateMatchState } from '../../../core/models/spectate.models';

function makeState(overrides: Partial<SpectateMatchState> = {}): SpectateMatchState {
  return {
    matchId: 'match-1',
    status: 'IN_PROGRESS',
    scorePlayerOne: 1,
    scorePlayerTwo: 0,
    gamesWonPlayerOne: 0,
    gamesWonPlayerTwo: 0,
    matchWinner: null,
    stateVersion: 3,
    currentRound: null,
    spectatorCount: 2,
    playerOneUsername: 'alice',
    playerTwoUsername: 'bob',
    gamesToPlay: 3,
    ...overrides,
  };
}

describe('adaptSpectateToMatchState', () => {
  it('fija viewerSeat = PLAYER_ONE siempre', () => {
    const result = adaptSpectateToMatchState(makeState());
    expect(result.viewerSeat).toBe('PLAYER_ONE');
  });

  it('myCards siempre vacío (invariante solo-lectura)', () => {
    const state = makeState({
      currentRound: {
        status: 'IN_PROGRESS',
        currentTurn: 'alice',
        roundStatus: 'PLAYING',
        currentTrucoCall: null,
        currentEnvidoCall: null,
        winner: null,
        playedHands: [],
        currentHand: { cardPlayerOne: null, cardPlayerTwo: null, mano: 'alice' },
        actionDeadline: null,
        turnDurationMillis: null,
        actionDeadlineSeat: null,
      },
    });
    const result = adaptSpectateToMatchState(state);
    expect(result.roundGame?.myCards).toEqual([]);
  });

  it('availableActions siempre vacío', () => {
    const state = makeState({
      currentRound: {
        status: 'IN_PROGRESS',
        currentTurn: 'alice',
        roundStatus: 'PLAYING',
        currentTrucoCall: null,
        currentEnvidoCall: null,
        winner: null,
        playedHands: [],
        currentHand: { cardPlayerOne: null, cardPlayerTwo: null, mano: 'alice' },
        actionDeadline: null,
        turnDurationMillis: null,
        actionDeadlineSeat: null,
      },
    });
    const result = adaptSpectateToMatchState(state);
    expect(result.roundGame?.availableActions).toEqual([]);
  });

  it('currentRound: null → roundGame: null', () => {
    const result = adaptSpectateToMatchState(makeState({ currentRound: null }));
    expect(result.roundGame).toBeNull();
  });

  it('copia roster y scores directamente', () => {
    const state = makeState({
      playerOneUsername: 'alice',
      playerTwoUsername: 'bob',
      scorePlayerOne: 2,
      scorePlayerTwo: 1,
      gamesWonPlayerOne: 1,
      gamesWonPlayerTwo: 0,
      gamesToPlay: 5,
      matchWinner: null,
    });
    const result = adaptSpectateToMatchState(state);
    expect(result.playerOneUsername).toBe('alice');
    expect(result.playerTwoUsername).toBe('bob');
    expect(result.scorePlayerOne).toBe(2);
    expect(result.scorePlayerTwo).toBe(1);
    expect(result.gamesWonPlayerOne).toBe(1);
    expect(result.gamesWonPlayerTwo).toBe(0);
    expect(result.gamesToPlay).toBe(5);
  });

  it('playerTwoUsername nullable se preserva', () => {
    const result = adaptSpectateToMatchState(makeState({ playerTwoUsername: null }));
    expect(result.playerTwoUsername).toBeNull();
  });
});
