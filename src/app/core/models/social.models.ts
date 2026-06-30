// Modelos de dominio social (amistades) — feature 024-friends-system
// Fuente autoritativa: docs/CONTRATOS_API.md §7.5 (REST) y §8.2 (DTOs).
//
// El identificador público del otro jugador es SIEMPRE `username`.
// El backend no expone `friendshipId` por REST ni por WebSocket.

import type { SpectatableMatch } from './spectate.models';

// ─── Disponibilidad de amigos (feature 025) ──────────────────────────────────
// Fuente: docs/CONTRATOS_API.md §7.4.5 (friendships con disponibilidad) y §9.6.

/** Disponibilidad del amigo a efectos de invitación (§7.4.5). */
export type FriendAvailability = 'AVAILABLE' | 'BUSY';

/** Motivo de ocupación; `null` cuando `availability === 'AVAILABLE'` (§7.4.5). */
export type FriendBusyReason =
  | 'IN_MATCH'
  | 'IN_LEAGUE'
  | 'IN_CUP'
  | 'OPEN_REMATCH'
  | 'IN_QUICK_QUEUE'
  | 'PENDING_INVITATION'
  | 'PENDING_FRIEND_REQUEST'
  | 'SPECTATING'
  | 'UNKNOWN';

/** GET /api/social/friendships → FriendSummaryResponse[] (§7.4.5 / §8.2). */
export interface FriendSummary {
  friendUsername: string;
  /** Presencia aproximada por sesiones WS; gatea invitar junto con `availability`. */
  online: boolean;
  /** Gate de invitación: `AVAILABLE` + `online` → invitable. */
  availability: FriendAvailability;
  /** Motivo de ocupación; `null` si `AVAILABLE`. */
  busyReason: FriendBusyReason | null;
  /** Partida espectable activa del amigo; `null` si no hay (§7.4.5, feature 026). */
  spectatableMatch: SpectatableMatch | null;
}

// ─── Invitaciones a recurso (feature 025) ────────────────────────────────────
// Fuente: docs/CONTRATOS_API.md §7.4.7–7.4.13 y §8.1–8.2.

/** Tipo de recurso de una invitación (§8.1). En esta feature sólo se crea `MATCH`. */
export type ResourceInvitationTargetType = 'MATCH' | 'LEAGUE' | 'CUP';

/** Estado de una invitación a recurso (§8.2). */
export type ResourceInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

/** POST /api/social/invitations — body (§7.4.7). */
export interface CreateResourceInvitationPayload {
  recipientUsername: string;
  targetType: ResourceInvitationTargetType;
  targetId: string;
}

/** POST /api/social/invitations — respuesta 200 (§7.4.7). */
export interface CreateResourceInvitationResponse {
  invitationId: string;
  /** epochMillis. */
  expiresAt: number;
}

/** GET /api/social/invitations/incoming → item (§7.4.9 / §8.2). */
export interface IncomingResourceInvitation {
  invitationId: string;
  senderUsername: string;
  targetType: ResourceInvitationTargetType;
  targetId: string;
  status: ResourceInvitationStatus;
  /** epochMillis. */
  expiresAt: number;
}

/** GET /api/social/invitations/outgoing → item (§7.4.11 / §8.2). */
export interface OutgoingResourceInvitation {
  invitationId: string;
  recipientUsername: string;
  targetType: ResourceInvitationTargetType;
  targetId: string;
  status: ResourceInvitationStatus;
  /** epochMillis. */
  expiresAt: number;
}

/** GET /api/social/friendship-requests/incoming → IncomingFriendshipRequestResponse[] (§8.2). */
export interface IncomingFriendshipRequest {
  requesterUsername: string;
}

/** GET /api/social/friendship-requests/outgoing → OutgoingFriendshipRequestResponse[] (§8.2). */
export interface OutgoingFriendshipRequest {
  addresseeUsername: string;
}

/** POST /api/social/friendship-requests body. */
export interface CreateFriendshipRequestPayload {
  username: string;
}

// ─── Preferencias sociales (feature 027) ─────────────────────────────────────
// Fuente: docs/contratos/06-social.md §Preferencias sociales.

/** GET/PUT /api/social/preferences (§Preferencias sociales). */
export interface SocialPreferences {
  acceptsFriendRequests: boolean;
}
