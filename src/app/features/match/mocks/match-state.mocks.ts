import type { MatchState } from '../../../core/models/match.models';

export const mockMatchViewerPlayerOne: MatchState = {
  matchId: 'mock-match-001',
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
    ],
    roundStatus: 'PLAYING',
    currentTrucoCall: null,
    winner: null,
    availableActions: [
      { type: 'PLAY_CARD' },
      { type: 'CALL_TRUCO' },
    ],
    playedHands: [
      {
        cardPlayerOne: { suit: 'ORO', number: 3 },
        cardPlayerTwo: { suit: 'COPA', number: 5 },
        winner: 'juancho',
      },
    ],
    currentHand: {
      cardPlayerOne: null,
      cardPlayerTwo: null,
      mano: 'juancho',
    },
  },
} as const satisfies MatchState;

export const mockMatchViewerPlayerTwo: MatchState = {
  matchId: 'mock-match-002',
  status: 'IN_PROGRESS',
  viewerSeat: 'PLAYER_TWO',
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
    ],
    roundStatus: 'PLAYING',
    currentTrucoCall: null,
    winner: null,
    availableActions: [
      { type: 'PLAY_CARD' },
      { type: 'CALL_TRUCO' },
    ],
    playedHands: [
      {
        cardPlayerOne: { suit: 'ORO', number: 3 },
        cardPlayerTwo: { suit: 'COPA', number: 5 },
        winner: 'juancho',
      },
    ],
    currentHand: {
      cardPlayerOne: null,
      cardPlayerTwo: null,
      mano: 'juancho',
    },
  },
} as const satisfies MatchState;

export const mockMatchEmptyTable: MatchState = {
  matchId: 'mock-match-003',
  status: 'IN_PROGRESS',
  viewerSeat: 'PLAYER_ONE',
  playerOneUsername: 'juancho',
  playerTwoUsername: 'martina',
  gamesToPlay: 1,
  scorePlayerOne: 0,
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
    availableActions: [
      { type: 'PLAY_CARD' },
      { type: 'CALL_TRUCO' },
    ],
    playedHands: [],
    currentHand: {
      cardPlayerOne: null,
      cardPlayerTwo: null,
      mano: 'juancho',
    },
  },
} as const satisfies MatchState;

export const mockMatchAsymmetricHand: MatchState = {
  matchId: 'mock-match-004',
  status: 'IN_PROGRESS',
  viewerSeat: 'PLAYER_ONE',
  playerOneUsername: 'juancho',
  playerTwoUsername: 'martina',
  gamesToPlay: 5,
  scorePlayerOne: 2,
  scorePlayerTwo: 1,
  gamesWonPlayerOne: 1,
  gamesWonPlayerTwo: 0,
  matchWinner: null,
  roundGame: {
    status: 'IN_PROGRESS',
    currentTurn: 'martina',
    myCards: [
      { suit: 'ESPADA', number: 1 },
    ],
    roundStatus: 'PLAYING',
    currentTrucoCall: null,
    winner: null,
    availableActions: [
      { type: 'PLAY_CARD' },
    ],
    playedHands: [
      {
        cardPlayerOne: { suit: 'ORO', number: 3 },
        cardPlayerTwo: { suit: 'COPA', number: 5 },
        winner: 'juancho',
      },
    ],
    currentHand: {
      cardPlayerOne: { suit: 'BASTO', number: 7 },
      cardPlayerTwo: null,
      mano: 'juancho',
    },
  },
} as const satisfies MatchState;
