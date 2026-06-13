import { describe, it, expect } from 'vitest';
import type { MatchState } from '../../app/core/models/match.models';
import {
  mockMatchViewerPlayerOne,
  mockMatchViewerPlayerTwo,
  mockMatchEmptyTable,
  mockMatchAsymmetricHand,
} from '../../app/features/match/mocks/match-state.mocks';

const REQUIRED_TOP_LEVEL_KEYS: (keyof MatchState)[] = [
  'matchId',
  'status',
  'viewerSeat',
  'playerOneUsername',
  'playerTwoUsername',
  'gamesToPlay',
  'scorePlayerOne',
  'scorePlayerTwo',
  'gamesWonPlayerOne',
  'gamesWonPlayerTwo',
  'matchWinner',
  'roundGame',
  'lobby',
];

const REQUIRED_ROUND_STATE_KEYS = [
  'status',
  'currentTurn',
  'myCards',
  'roundStatus',
  'currentTrucoCall',
  'winner',
  'availableActions',
  'playedHands',
  'currentHand',
];

function assertHasAllKeys(obj: object, keys: string[]): void {
  for (const key of keys) {
    expect(key in obj).toBe(true);
  }
}

describe('match-state-shape contract', () => {
  const fixtures: { name: string; value: MatchState }[] = [
    { name: 'mockMatchViewerPlayerOne', value: mockMatchViewerPlayerOne },
    { name: 'mockMatchViewerPlayerTwo', value: mockMatchViewerPlayerTwo },
    { name: 'mockMatchEmptyTable', value: mockMatchEmptyTable },
    { name: 'mockMatchAsymmetricHand', value: mockMatchAsymmetricHand },
  ];

  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      it('satisfies MatchState shape with all top-level keys', () => {
        assertHasAllKeys(fixture.value, REQUIRED_TOP_LEVEL_KEYS);
      });

      it('has valid gamesToPlay value', () => {
        expect([1, 3, 5]).toContain(fixture.value.gamesToPlay);
      });

      it('has valid viewerSeat value', () => {
        expect(['PLAYER_ONE', 'PLAYER_TWO']).toContain(fixture.value.viewerSeat);
      });

      if (fixture.value.roundGame !== null) {
        it('has all RoundState keys when roundGame is present', () => {
          assertHasAllKeys(fixture.value.roundGame!, REQUIRED_ROUND_STATE_KEYS);
        });
      }
    });
  }
});
