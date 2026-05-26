import type { Card, AvailableAction } from '../../../core/models/match.models';
import type { Seat, TrucoCall, TrucoResponse, EnvidoCall, EnvidoResponse } from '../../../core/models/enums';

export type MatchEventType =
  | 'CARD_PLAYED'
  | 'TURN_CHANGED'
  | 'TRUCO_CALLED'
  | 'TRUCO_RESPONDED'
  | 'ENVIDO_CALLED'
  | 'ENVIDO_RESOLVED'
  | 'SCORE_CHANGED'
  | 'ROUND_STARTED'
  | 'ROUND_ENDED'
  | 'GAME_STARTED'
  | 'GAME_SCORE_CHANGED'
  | 'MATCH_FINISHED'
  | 'MATCH_ABANDONED'
  | 'MATCH_FORFEITED'
  | 'FOLDED'
  | 'HAND_RESOLVED'
  | 'HAND_DEALT'
  | 'HAND_CHANGED'
  | 'SPECTATOR_COUNT_CHANGED'
  | 'PLAYER_JOINED'
  | 'PLAYER_READY'
  | 'MATCH_CANCELLED'
  | 'MATCH_PLAYER_LEFT'
  | 'REMATCH_AVAILABLE'
  | 'REMATCH_OPPONENT_WANTS'
  | 'REMATCH_CONFIRMED'
  | 'REMATCH_CLOSED_BY_LEAVE'
  | 'REMATCH_EXPIRED';

export interface MatchWsEvent<TPayload = unknown> {
  matchId: string;
  eventType: MatchEventType;
  timestamp: number;
  payload: TPayload;
  stateVersion: number;
}

export type MatchDerivedEventType =
  | 'AVAILABLE_ACTIONS_UPDATED'
  | 'PLAYER_HAND_UPDATED';

export interface MatchDerivedEvent<TPayload = unknown> {
  matchId: string;
  eventType: MatchDerivedEventType;
  timestamp: number;
  payload: TPayload;
}

export interface MatchEndedEvent {
  winnerSeat: Seat;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
  reason: 'FINISHED' | 'ABANDONED' | 'FORFEITED';
}

// Payloads
export interface CardPlayedPayload {
  seat: Seat;
  card: Card;
}

export interface TurnChangedPayload {
  seat: Seat;
}

export interface TrucoCalledPayload {
  callerSeat: Seat;
  call: TrucoCall;
}

export interface TrucoRespondedPayload {
  responderSeat: Seat;
  response: TrucoResponse;
  call: TrucoCall;
}

export interface EnvidoCalledPayload {
  callerSeat: Seat;
  call: EnvidoCall;
}

export interface EnvidoResolvedPayload {
  response: EnvidoResponse;
  winnerSeat: Seat;
  pointsMano?: number;
  pointsPie?: number;
}

export interface ScoreChangedPayload {
  scorePlayerOne: number;
  scorePlayerTwo: number;
}

export interface RoundStartedPayload {
  roundNumber: number;
  manoSeat: Seat;
}

export interface RoundEndedPayload {
  winnerSeat: Seat;
}

export interface GameStartedPayload {
  gameNumber: number;
}

export interface GameScoreChangedPayload {
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
}

export interface MatchFinishedPayload {
  winnerSeat: Seat;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
}

export interface MatchAbandonedPayload {
  winnerSeat: Seat;
  abandonerSeat: Seat;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
}

export interface MatchForfeitedPayload {
  winnerSeat: Seat;
  loserSeat: Seat;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
}

export interface FoldedPayload {
  seat: Seat;
}

export interface HandResolvedPayload {
  cardPlayerOne: Card | null;
  cardPlayerTwo: Card | null;
  winnerSeat: Seat;
}

export interface HandDealtPayload {
  seat: Seat;
  cards: Card[];
}

export interface AvailableActionsUpdatedPayload {
  seat: Seat;
  availableActions: AvailableAction[];
}

export interface PlayerHandUpdatedPayload {
  seat: Seat;
  cards: Card[];
}
