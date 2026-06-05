// Modelos de dominio social (amistades) — feature 024-friends-system
// Fuente autoritativa: docs/CONTRATOS_API.md §7.5 (REST) y §8.2 (DTOs).
//
// El identificador público del otro jugador es SIEMPRE `username`.
// El backend no expone `friendshipId` por REST ni por WebSocket.

/** GET /api/social/friendships → FriendSummaryResponse[] (§8.2). */
export interface FriendSummary {
  friendUsername: string;
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
