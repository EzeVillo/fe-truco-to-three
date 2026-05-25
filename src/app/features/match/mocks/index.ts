import type { MatchState } from '../../../core/models/match.models';
import {
  mockMatchViewerPlayerOne,
  mockMatchViewerPlayerTwo,
  mockMatchEmptyTable,
  mockMatchAsymmetricHand,
} from './match-state.mocks';
import {
  mockMatchActionsCommon,
  mockMatchActionsCallOnly,
  mockMatchActionsEmpty,
  mockMatchActionsRetruco,
  mockMatchActionsValeCuatro,
  mockMatchActionsOnlyFold,
  mockMatchActionsRespondEnvido,
  mockMatchActionsRespondTruco,
} from './match-action-fixtures.mocks';

export type FixtureKey =
  | 'viewer-player-one'
  | 'viewer-player-two'
  | 'empty-table'
  | 'asymmetric-hand'
  | 'actions-common'
  | 'actions-call-only'
  | 'actions-empty'
  | 'actions-retruco'
  | 'actions-vale-cuatro'
  | 'actions-only-fold'
  | 'actions-respond-envido'
  | 'actions-respond-truco';

export const DEFAULT_FIXTURE: FixtureKey = 'viewer-player-one';

const FIXTURE_MAP: Record<FixtureKey, MatchState> = {
  'viewer-player-one': mockMatchViewerPlayerOne,
  'viewer-player-two': mockMatchViewerPlayerTwo,
  'empty-table': mockMatchEmptyTable,
  'asymmetric-hand': mockMatchAsymmetricHand,
  'actions-common': mockMatchActionsCommon,
  'actions-call-only': mockMatchActionsCallOnly,
  'actions-empty': mockMatchActionsEmpty,
  'actions-retruco': mockMatchActionsRetruco,
  'actions-vale-cuatro': mockMatchActionsValeCuatro,
  'actions-only-fold': mockMatchActionsOnlyFold,
  'actions-respond-envido': mockMatchActionsRespondEnvido,
  'actions-respond-truco': mockMatchActionsRespondTruco,
};

export function getFixture(key: string | null | undefined): MatchState {
  if (!key) {
    return FIXTURE_MAP[DEFAULT_FIXTURE];
  }
  const fixture = FIXTURE_MAP[key as FixtureKey];
  return fixture ?? FIXTURE_MAP[DEFAULT_FIXTURE];
}

// Exportar helpers de acciones para reutilización en tests
export {
  mockActionsCommon,
  mockActionsCallOnly,
  mockActionsEmpty,
  mockActionsOnlyFold,
} from './available-actions.mocks';

export {
  mockMatchActionsCommon,
  mockMatchActionsCallOnly,
  mockMatchActionsEmpty,
  mockMatchActionsRetruco,
  mockMatchActionsValeCuatro,
  mockMatchActionsOnlyFold,
  mockMatchActionsRespondEnvido,
  mockMatchActionsRespondTruco,
} from './match-action-fixtures.mocks';
