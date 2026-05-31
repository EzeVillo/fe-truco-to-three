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
  | 'PLAYER_HAND_UPDATED'
  // Temporizador de turno. Viajan por /user/queue/match con stateVersion null;
  // se tratan como derivados (no avanzan stateVersion). Ver
  // docs/CONTRATOS_API.md §9.5/§9.6 y feature 013-turn-timer (research D1).
  | 'ACTION_DEADLINE_SET'
  | 'ACTION_DEADLINE_CLEARED';

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

/**
 * Payload semántico derivado en frontend cuando GAME_SCORE_CHANGED indica
 * que alguien ganó una partida individual (game) de la serie.
 * No es un evento del backend; se emite internamente desde MatchStateService.
 */
export interface GameWonPayload {
  winnerSeat: Seat;
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

/** §9.6 `PLAYER_READY` — el asiento indicado quedó listo. */
export interface PlayerReadyPayload {
  seat: Seat;
}

/**
 * §9.6 `MATCH_PLAYER_LEFT` — el segundo jugador salió antes de comenzar; la
 * partida vuelve a `WAITING_FOR_PLAYERS`. `leaverSeat` es siempre `PLAYER_TWO`.
 */
export interface MatchPlayerLeftPayload {
  leaverSeat: Seat;
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

/** Payload de `ACTION_DEADLINE_SET`. Fuente: docs/CONTRATOS_API.md §9.6. */
export interface ActionDeadlineSetPayload {
  seat: Seat; // asiento que debe actuar
  actionDeadline: number; // epochMillis absoluto
  turnDurationMillis: number; // plazo total del turno
}

/** Payload de `ACTION_DEADLINE_CLEARED` — sin campos. */
export type ActionDeadlineClearedPayload = Record<string, never>;

// Rematch payloads — §9.6. expiresAt en epochMillis (distinto del REST que es ISO-8601).
export interface RematchAvailablePayload {
  sessionId: string;
  originMatchId: string;
  expiresAt: number;
}

export interface RematchOpponentWantsPayload {
  sessionId: string;
  originMatchId: string;
  actor: string;
}

export interface RematchConfirmedPayload {
  sessionId: string;
  originMatchId: string;
  newMatchId: string;
  newPlayerOne: string;
  newPlayerTwo: string;
}

export interface RematchClosedByLeavePayload {
  sessionId: string;
  originMatchId: string;
  actor: string;
}

export interface RematchExpiredPayload {
  sessionId: string;
  originMatchId: string;
}
