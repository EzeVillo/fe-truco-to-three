import type { MatchState } from '../../../core/models/match.models';
import {
  mockActionsCommon,
  mockActionsCallOnly,
  mockActionsEmpty,
  mockActionsOnlyFold,
  mockActionsRespondEnvido,
} from './available-actions.mocks';

// Fixture base reutilizado para todos los estados de acciones.
const BASE_MATCH: MatchState = {
  matchId: 'mock-match-actions-001',
  status: 'IN_PROGRESS',
  viewerSeat: 'PLAYER_ONE',
  playerOneUsername: 'juancho',
  playerTwoUsername: 'martina',
  gamesToPlay: 3,
  scorePlayerOne: 1,
  scorePlayerTwo: 0,
  gamesWonPlayerOne: 0,
  gamesWonPlayerTwo: 0,
  matchWinner: null,
  roundGame: {
    status: 'IN_PROGRESS',
    currentTurn: 'juancho',
    myCards: [
      { suit: 'ESPADA', number: 1 },
      { suit: 'BASTO', number: 7 },
      { suit: 'ORO', number: 5 },
    ],
    roundStatus: 'PLAYING',
    currentTrucoCall: null,
    winner: null,
    availableActions: [],
    playedHands: [],
    currentHand: {
      cardPlayerOne: null,
      cardPlayerTwo: null,
      mano: 'juancho',
    },
    actionDeadline: null,
    turnDurationMillis: null,
    actionDeadlineSeat: null,
  },
};

// 1. Acciones comunes disponibles (todas habilitadas)
export const mockMatchActionsCommon: MatchState = {
  ...BASE_MATCH,
  roundGame: {
    ...BASE_MATCH.roundGame!,
    availableActions: mockActionsCommon,
  },
};

// 2. Solo cantos disponibles (mismo set, simula contexto distinto)
export const mockMatchActionsCallOnly: MatchState = {
  ...BASE_MATCH,
  roundGame: {
    ...BASE_MATCH.roundGame!,
    availableActions: mockActionsCallOnly,
  },
};

// 3. Sin acciones disponibles (esperando al rival)
export const mockMatchActionsEmpty: MatchState = {
  ...BASE_MATCH,
  roundGame: {
    ...BASE_MATCH.roundGame!,
    currentTurn: 'martina',
    availableActions: mockActionsEmpty,
  },
};

// 4. Botón Truco muestra "Retruco"
export const mockMatchActionsRetruco: MatchState = {
  ...BASE_MATCH,
  roundGame: {
    ...BASE_MATCH.roundGame!,
    currentTrucoCall: 'RETRUCO',
    availableActions: mockActionsCommon,
  },
};

// 5. Botón Truco muestra "Vale 4"
export const mockMatchActionsValeCuatro: MatchState = {
  ...BASE_MATCH,
  roundGame: {
    ...BASE_MATCH.roundGame!,
    currentTrucoCall: 'VALE_CUATRO',
    availableActions: mockActionsCommon,
  },
};

// 6. Solo mazo habilitado
export const mockMatchActionsOnlyFold: MatchState = {
  ...BASE_MATCH,
  roundGame: {
    ...BASE_MATCH.roundGame!,
    availableActions: mockActionsOnlyFold,
  },
};

// 7. Modo respuesta de envido (rival cantó envido)
export const mockMatchActionsRespondEnvido: MatchState = {
  ...BASE_MATCH,
  roundGame: {
    ...BASE_MATCH.roundGame!,
    roundStatus: 'ENVIDO_IN_PROGRESS',
    availableActions: mockActionsRespondEnvido,
  },
};

// 8. Modo respuesta de truco (rival cantó truco)
export const mockMatchActionsRespondTruco: MatchState = {
  ...BASE_MATCH,
  roundGame: {
    ...BASE_MATCH.roundGame!,
    roundStatus: 'TRUCO_IN_PROGRESS',
    currentTrucoCall: 'TRUCO',
    availableActions: [
      { type: 'RESPOND_TRUCO' },
    ],
  },
};
