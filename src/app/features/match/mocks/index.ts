import type { MatchState } from '../../../core/models/match.models';
import {
  mockMatchViewerPlayerOne,
  mockMatchViewerPlayerTwo,
  mockMatchEmptyTable,
  mockMatchAsymmetricHand,
} from './match-state.mocks';

export type FixtureKey =
  | 'viewer-player-one'
  | 'viewer-player-two'
  | 'empty-table'
  | 'asymmetric-hand';

export const DEFAULT_FIXTURE: FixtureKey = 'viewer-player-one';

const FIXTURE_MAP: Record<FixtureKey, MatchState> = {
  'viewer-player-one': mockMatchViewerPlayerOne,
  'viewer-player-two': mockMatchViewerPlayerTwo,
  'empty-table': mockMatchEmptyTable,
  'asymmetric-hand': mockMatchAsymmetricHand,
};

export function getFixture(key: string | null | undefined): MatchState {
  if (!key) {
    return FIXTURE_MAP[DEFAULT_FIXTURE];
  }
  const fixture = FIXTURE_MAP[key as FixtureKey];
  return fixture ?? FIXTURE_MAP[DEFAULT_FIXTURE];
}
