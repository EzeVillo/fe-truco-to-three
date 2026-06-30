/**
 * Contract test — WebSocket Match events (§9.3–§9.6 + §4.14)
 *
 * Verifica que los tipos TypeScript de eventos WS estén en paridad
 * con los contratos documentados en docs/CONTRATOS_API.md.
 */
import { describe, it, expect } from 'vitest';
import { readContrato } from './_docs';
import type {
  MatchWsEvent,
  MatchDerivedEvent,
  MatchEventType,
  MatchDerivedEventType,
  CardPlayedPayload,
  TurnChangedPayload,
  TrucoCalledPayload,
  TrucoRespondedPayload,
  EnvidoCalledPayload,
  EnvidoResolvedPayload,
  ScoreChangedPayload,
  RoundStartedPayload,
  RoundEndedPayload,
  GameStartedPayload,
  GameScoreChangedPayload,
  MatchFinishedPayload,
  MatchAbandonedPayload,
  MatchForfeitedPayload,
  FoldedPayload,
  HandResolvedPayload,
  HandDealtPayload,
  AvailableActionsUpdatedPayload,
  PlayerHandUpdatedPayload,
} from '../../app/features/match/models/match-ws-events';

function getContractSection(): string {
  return readContrato('02-matches.md');
}

// Compile-time shape checks via satisfies
const _cardPlayedCheck = {
  seat: 'PLAYER_ONE' as const,
  card: { suit: 'ESPADA' as const, number: 1 },
} satisfies CardPlayedPayload;

const _turnChangedCheck = {
  seat: 'PLAYER_ONE' as const,
} satisfies TurnChangedPayload;

const _trucoCalledCheck = {
  callerSeat: 'PLAYER_ONE' as const,
  call: 'TRUCO' as const,
} satisfies TrucoCalledPayload;

const _trucoRespondedCheck = {
  responderSeat: 'PLAYER_ONE' as const,
  response: 'QUIERO' as const,
  call: 'TRUCO' as const,
} satisfies TrucoRespondedPayload;

const _envidoCalledCheck = {
  callerSeat: 'PLAYER_ONE' as const,
  call: 'ENVIDO' as const,
} satisfies EnvidoCalledPayload;

const _envidoResolvedCheck = {
  response: 'QUIERO' as const,
  winnerSeat: 'PLAYER_ONE' as const,
  pointsMano: 2,
  pointsPie: 0,
} satisfies EnvidoResolvedPayload;

const _scoreChangedCheck = {
  scorePlayerOne: 2,
  scorePlayerTwo: 1,
} satisfies ScoreChangedPayload;

const _roundStartedCheck = {
  roundNumber: 1,
  manoSeat: 'PLAYER_ONE' as const,
} satisfies RoundStartedPayload;

const _roundEndedCheck = {
  winnerSeat: 'PLAYER_ONE' as const,
} satisfies RoundEndedPayload;

const _gameStartedCheck = {
  gameNumber: 1,
} satisfies GameStartedPayload;

const _gameScoreChangedCheck = {
  gamesWonPlayerOne: 1,
  gamesWonPlayerTwo: 0,
} satisfies GameScoreChangedPayload;

const _matchFinishedCheck = {
  winnerSeat: 'PLAYER_ONE' as const,
  gamesWonPlayerOne: 1,
  gamesWonPlayerTwo: 0,
} satisfies MatchFinishedPayload;

const _matchAbandonedCheck = {
  winnerSeat: 'PLAYER_ONE' as const,
  abandonerSeat: 'PLAYER_TWO' as const,
  gamesWonPlayerOne: 1,
  gamesWonPlayerTwo: 0,
} satisfies MatchAbandonedPayload;

const _matchForfeitedCheck = {
  winnerSeat: 'PLAYER_ONE' as const,
  loserSeat: 'PLAYER_TWO' as const,
  gamesWonPlayerOne: 1,
  gamesWonPlayerTwo: 0,
} satisfies MatchForfeitedPayload;

const _foldedCheck = {
  seat: 'PLAYER_ONE' as const,
} satisfies FoldedPayload;

const _handResolvedCheck = {
  cardPlayerOne: { suit: 'ESPADA' as const, number: 1 },
  cardPlayerTwo: { suit: 'BASTO' as const, number: 7 },
  winnerSeat: 'PLAYER_ONE' as const,
} satisfies HandResolvedPayload;

const _handDealtCheck = {
  seat: 'PLAYER_ONE' as const,
  cards: [{ suit: 'ESPADA' as const, number: 1 }],
} satisfies HandDealtPayload;

const _availableActionsCheck = {
  seat: 'PLAYER_ONE' as const,
  availableActions: [{ type: 'PLAY_CARD' as const }],
} satisfies AvailableActionsUpdatedPayload;

const _playerHandCheck = {
  seat: 'PLAYER_ONE' as const,
  cards: [{ suit: 'ESPADA' as const, number: 1 }],
} satisfies PlayerHandUpdatedPayload;

const _matchWsEventCheck = {
  matchId: 'test',
  eventType: 'CARD_PLAYED' as MatchEventType,
  timestamp: 1234567890,
  payload: {},
  stateVersion: 1,
} satisfies MatchWsEvent;

const _matchDerivedEventCheck = {
  matchId: 'test',
  eventType: 'AVAILABLE_ACTIONS_UPDATED' as MatchDerivedEventType,
  timestamp: 1234567890,
  payload: {},
} satisfies MatchDerivedEvent;

// Prevent lint from removing the objects
void _cardPlayedCheck;
void _turnChangedCheck;
void _trucoCalledCheck;
void _trucoRespondedCheck;
void _envidoCalledCheck;
void _envidoResolvedCheck;
void _scoreChangedCheck;
void _roundStartedCheck;
void _roundEndedCheck;
void _gameStartedCheck;
void _gameScoreChangedCheck;
void _matchFinishedCheck;
void _matchAbandonedCheck;
void _matchForfeitedCheck;
void _foldedCheck;
void _handResolvedCheck;
void _handDealtCheck;
void _availableActionsCheck;
void _playerHandCheck;
void _matchWsEventCheck;
void _matchDerivedEventCheck;

describe('Contract: Match WS events §9.3–§9.6', () => {
  const content = getContractSection();

  it('§9.3 lista /user/queue/match-derived', () => {
    expect(content).toMatch(/\/user\/queue\/match-derived/);
  });

  it('§9.4 define stateVersion en eventos transaccionales', () => {
    const event: MatchWsEvent = {
      matchId: 'test',
      eventType: 'CARD_PLAYED',
      timestamp: 1,
      payload: {},
      stateVersion: 1,
    };
    expect(event.stateVersion).toBe(1);
  });

  it('§9.4 eventos derivados no llevan stateVersion', () => {
    const event: MatchDerivedEvent = {
      matchId: 'test',
      eventType: 'AVAILABLE_ACTIONS_UPDATED',
      timestamp: 1,
      payload: {},
    };
    expect('stateVersion' in event).toBe(false);
  });

  it('§9.5 incluye todos los eventType transaccionales del contrato', () => {
    const transactionalTypes: MatchEventType[] = [
      'CARD_PLAYED',
      'TURN_CHANGED',
      'TRUCO_CALLED',
      'TRUCO_RESPONDED',
      'ENVIDO_CALLED',
      'ENVIDO_RESOLVED',
      'SCORE_CHANGED',
      'ROUND_STARTED',
      'ROUND_ENDED',
      'GAME_STARTED',
      'GAME_SCORE_CHANGED',
      'MATCH_FINISHED',
      'MATCH_ABANDONED',
      'MATCH_FORFEITED',
      'FOLDED',
      'HAND_RESOLVED',
      'HAND_DEALT',
      'HAND_CHANGED',
      'SPECTATOR_COUNT_CHANGED',
      'PLAYER_JOINED',
      'PLAYER_READY',
      'MATCH_CANCELLED',
      'MATCH_PLAYER_LEFT',
      'REMATCH_AVAILABLE',
      'REMATCH_OPPONENT_WANTS',
      'REMATCH_CONFIRMED',
      'REMATCH_CLOSED_BY_LEAVE',
      'REMATCH_EXPIRED',
    ];
    for (const type of transactionalTypes) {
      expect(content).toContain(type);
    }
  });

  it('§9.5 incluye AVAILABLE_ACTIONS_UPDATED y PLAYER_HAND_UPDATED como derivados', () => {
    expect(content).toContain('AVAILABLE_ACTIONS_UPDATED');
    expect(content).toContain('PLAYER_HAND_UPDATED');
  });

  it('§9.6 CARD_PLAYED payload tiene seat y card', () => {
    const keys = Object.keys(_cardPlayedCheck).sort();
    expect(keys).toEqual(['card', 'seat']);
  });

  it('§9.6 TURN_CHANGED payload tiene seat', () => {
    const keys = Object.keys(_turnChangedCheck).sort();
    expect(keys).toEqual(['seat']);
  });

  it('§9.6 SCORE_CHANGED payload tiene scorePlayerOne y scorePlayerTwo', () => {
    const keys = Object.keys(_scoreChangedCheck).sort();
    expect(keys).toEqual(['scorePlayerOne', 'scorePlayerTwo']);
  });

  it('§9.6 MATCH_FINISHED payload tiene winnerSeat, gamesWonPlayerOne, gamesWonPlayerTwo', () => {
    const keys = Object.keys(_matchFinishedCheck).sort();
    expect(keys).toEqual(['gamesWonPlayerOne', 'gamesWonPlayerTwo', 'winnerSeat']);
  });

  it('§9.6 MATCH_ABANDONED payload tiene winnerSeat, abandonerSeat, gamesWonPlayerOne, gamesWonPlayerTwo', () => {
    const keys = Object.keys(_matchAbandonedCheck).sort();
    expect(keys).toEqual(['abandonerSeat', 'gamesWonPlayerOne', 'gamesWonPlayerTwo', 'winnerSeat']);
  });

  it('§9.6 MATCH_FORFEITED payload tiene winnerSeat, loserSeat, gamesWonPlayerOne, gamesWonPlayerTwo', () => {
    const keys = Object.keys(_matchForfeitedCheck).sort();
    expect(keys).toEqual(['gamesWonPlayerOne', 'gamesWonPlayerTwo', 'loserSeat', 'winnerSeat']);
  });

  it('§9.6 HAND_RESOLVED payload tiene cardPlayerOne, cardPlayerTwo, winnerSeat', () => {
    const keys = Object.keys(_handResolvedCheck).sort();
    expect(keys).toEqual(['cardPlayerOne', 'cardPlayerTwo', 'winnerSeat']);
  });

  it('§4.14 GET /api/matches/{matchId} incluye stateVersion top-level', () => {
    expect(content).toMatch(/"stateVersion":\s*\d+/);
  });
});
