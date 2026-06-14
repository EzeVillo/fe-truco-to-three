// Modelos de eventos WebSocket
// Fuente: docs/CONTRATOS_API.md §9 y specs/001-auth-models-foundation/data-model.md §4

import type { Seat, Suit, TrucoCall, EnvidoCall, TrucoResponse, EnvidoResponse } from './enums';
import type {
  FriendAvailability,
  FriendBusyReason,
  ResourceInvitationTargetType,
} from './social.models';
import type { SpectatableMatch, SpectateMatchState } from './spectate.models';
import type { ChatParentType } from './chat.models';

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

/** Item del snapshot FRIEND_AVAILABILITY_STATE (§9.6). */
export interface FriendAvailabilitySnapshotItem {
  friendUsername: string;
  online: boolean;
  availability: FriendAvailability;
  busyReason: FriendBusyReason | null;
  spectatableMatch: SpectatableMatch | null;
}

/** Delta FRIEND_AVAILABILITY_CHANGED — un amigo (§9.6). */
export interface FriendAvailabilityDelta {
  friendUsername: string;
  online: boolean;
  availability: FriendAvailability;
  busyReason: FriendBusyReason | null;
  spectatableMatch: SpectatableMatch | null;
}

/** Eventos del canal /user/queue/match-spectate (§9.5g/§9.6). */
export type SpectateWsEvent =
  | {
      eventType: 'SPECTATE_STATE';
      matchId: string;
      timestamp: number;
      stateVersion: number;
      payload: { matchState: SpectateMatchState };
    }
  | {
      eventType: 'SPECTATE_ERROR';
      matchId: string;
      timestamp: number;
      payload: { error: string };
    }
  | {
      eventType: 'SPECTATOR_COUNT_CHANGED';
      matchId: string;
      timestamp: number;
      payload: { spectatorCount: number };
    };

/**
 * Eventos sociales (amistades + invitaciones + disponibilidad) — canal
 * /user/queue/social. Fuente: docs/CONTRATOS_API.md §9.5e (eventType) y §9.6 (payload).
 *
 * Los eventos `RESOURCE_INVITATION_*` y `FRIEND_AVAILABILITY_*` se agregan en la
 * feature 025; el consumidor maneja sólo invitaciones con `targetType === 'MATCH'`.
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
    >
  | WsEventBase<
      'RESOURCE_INVITATION_RECEIVED',
      {
        invitationId: string;
        senderUsername: string;
        targetType: ResourceInvitationTargetType;
        targetId: string;
        expiresAt: number;
      }
    >
  | WsEventBase<
      'RESOURCE_INVITATION_ACCEPTED',
      {
        invitationId: string;
        recipientUsername: string;
        targetType: ResourceInvitationTargetType;
        targetId: string;
      }
    >
  | WsEventBase<
      'RESOURCE_INVITATION_DECLINED',
      {
        invitationId: string;
        recipientUsername: string;
        targetType: ResourceInvitationTargetType;
        targetId: string;
      }
    >
  | WsEventBase<
      'RESOURCE_INVITATION_CANCELLED',
      {
        invitationId: string;
        senderUsername: string;
        targetType: ResourceInvitationTargetType;
        targetId: string;
      }
    >
  | WsEventBase<
      'RESOURCE_INVITATION_EXPIRED',
      {
        invitationId: string;
        senderUsername: string;
        recipientUsername: string;
        targetType: ResourceInvitationTargetType;
        targetId: string;
      }
    >
  | WsEventBase<'FRIEND_AVAILABILITY_STATE', { friends: FriendAvailabilitySnapshotItem[] }>
  | WsEventBase<'FRIEND_AVAILABILITY_CHANGED', FriendAvailabilityDelta>;

/**
 * Eventos del canal /user/queue/campaign (§9.6). Se emite al terminar cada match
 * de campaña (victoria o derrota), post-commit y solo al jugador, con los puntos
 * conseguidos en ese match, el total acumulado y el movimiento de posición. En una
 * derrota `pointsAwarded` es `0` y `previousPosition`/`newPosition` no cambian.
 */
export type CampaignWsEvent =
  | WsEventBase<
      'CAMPAIGN_MATCH_POINTS',
      {
        matchId: string;
        rivalId: string;
        won: boolean;
        pointsAwarded: number;
        totalPoints: number;
        previousPosition: number;
        newPosition: number;
      }
    >
  | WsEventBase<
      'CAMPAIGN_BOT_UNLOCKED',
      {
        botId: string;
        matchId: string;
      }
    >;

/** Payload de `CAMPAIGN_MATCH_POINTS`. */
export type CampaignMatchPointsPayload = Extract<
  CampaignWsEvent,
  { eventType: 'CAMPAIGN_MATCH_POINTS' }
>['payload'];

/**
 * Payload de `CAMPAIGN_BOT_UNLOCKED` (§9.6): el BE avisa que el jugador desbloqueó
 * un bot de campaña para el modo casual (historial neto `>= 3` a favor). El front
 * no calcula la condición; solo reacciona al push.
 */
export type CampaignBotUnlockedPayload = Extract<
  CampaignWsEvent,
  { eventType: 'CAMPAIGN_BOT_UNLOCKED' }
>['payload'];

/** Eventos del canal /user/queue/chat (§9.5d/§9.6). chatId top-level. */
export type ChatWsEvent =
  | {
      chatId: string;
      eventType: 'CHAT_CREATED';
      timestamp: number;
      payload: { parentType: Exclude<ChatParentType, 'FRIENDSHIP'>; parentId: string };
    }
  | {
      chatId: string;
      eventType: 'MESSAGE_SENT';
      timestamp: number;
      payload: { sender: string; content: string; sentAt: number };
    };

// Análogamente: LeagueWsEvent, CupWsEvent, SpectateWsEvent, PublicLobbyWsEvent
// se completan conforme se implementan las features correspondientes.

/** Unión discriminada general de eventos WebSocket. */
export type WsEvent =
  | MatchWsEvent
  | SocialWsEvent
  | ChatWsEvent
  | CampaignWsEvent /* | LeagueWsEvent | ... */;
