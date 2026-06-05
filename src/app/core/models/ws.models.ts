// Modelos de eventos WebSocket
// Fuente: docs/CONTRATOS_API.md §9 y specs/001-auth-models-foundation/data-model.md §4

import type { Seat, Suit, TrucoCall, EnvidoCall, TrucoResponse, EnvidoResponse } from './enums';

interface WsEventBase<TType extends string, TPayload> {
  eventType: TType;
  timestamp: number;
  payload: TPayload;
}

/** Eventos de match — canal /user/queue/match. matchId top-level. */
export type MatchWsEvent =
  | (WsEventBase<'CARD_PLAYED', { seat: Seat; card: { suit: Suit; number: number } }> & {
      matchId: string;
    })
  | (WsEventBase<'TURN_CHANGED', { seat: Seat }> & { matchId: string })
  | (WsEventBase<'TRUCO_CALLED', { callerSeat: Seat; call: TrucoCall }> & { matchId: string })
  | (WsEventBase<
      'TRUCO_RESPONDED',
      { responderSeat: Seat; response: TrucoResponse; call: TrucoCall }
    > & { matchId: string })
  | (WsEventBase<'ENVIDO_CALLED', { callerSeat: Seat; call: EnvidoCall }> & { matchId: string })
  | (WsEventBase<
      'ENVIDO_RESOLVED',
      {
        response: EnvidoResponse;
        winnerSeat: Seat;
        pointsMano?: number;
        pointsPie?: number;
      }
    > & { matchId: string })
  | (WsEventBase<'SCORE_CHANGED', { scorePlayerOne: number; scorePlayerTwo: number }> & {
      matchId: string;
    })
  | (WsEventBase<'ROUND_STARTED', { roundNumber: number; manoSeat: Seat }> & { matchId: string })
  | (WsEventBase<'ROUND_ENDED', { winnerSeat: Seat }> & { matchId: string })
  | (WsEventBase<'GAME_STARTED', { gameNumber: number }> & { matchId: string })
  | (WsEventBase<'GAME_SCORE_CHANGED', { gamesWonPlayerOne: number; gamesWonPlayerTwo: number }> & {
      matchId: string;
    })
  | (WsEventBase<
      'MATCH_FINISHED',
      { winnerSeat: Seat; gamesWonPlayerOne: number; gamesWonPlayerTwo: number }
    > & { matchId: string });
// Resto de eventTypes se añaden al implementar cada feature (AVAILABLE_ACTIONS_UPDATED, etc.)

/**
 * Eventos sociales (amistades) — canal /user/queue/social.
 * Fuente: docs/CONTRATOS_API.md §9.5e (eventType) y §9.6 (payload).
 *
 * El mismo canal emite además eventos `RESOURCE_INVITATION_*` (invitaciones a
 * recursos), fuera de alcance del MVP de amistades (feature 024); el consumidor
 * los ignora en su default case.
 */
export type SocialWsEvent =
  | WsEventBase<'FRIEND_REQUEST_RECEIVED', { requesterUsername: string; addresseeUsername: string }>
  | WsEventBase<'FRIEND_REQUEST_ACCEPTED', { requesterUsername: string; addresseeUsername: string }>
  | WsEventBase<'FRIEND_REQUEST_DECLINED', { requesterUsername: string; addresseeUsername: string }>
  | WsEventBase<
      'FRIEND_REQUEST_CANCELLED',
      { requesterUsername: string; addresseeUsername: string }
    >
  | WsEventBase<
      'FRIENDSHIP_REMOVED',
      { requesterUsername: string; addresseeUsername: string; removedByUsername: string }
    >;

// Análogamente: LeagueWsEvent, CupWsEvent, ChatWsEvent, SpectateWsEvent, PublicLobbyWsEvent
// se completan conforme se implementan las features correspondientes.

/** Unión discriminada general de eventos WebSocket. */
export type WsEvent = MatchWsEvent | SocialWsEvent /* | LeagueWsEvent | ... */;
