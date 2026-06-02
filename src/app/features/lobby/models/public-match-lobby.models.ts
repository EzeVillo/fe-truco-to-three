// Modelos del lobby público de matches — feature 021-public-match-lobby
// Fuente del contrato: docs/CONTRATOS_API.md §4.3 (listar públicas) y §9.4 (eventos de topic).
// Mismo shape de item en REST (§4.3) y en el payload.lobby del UPSERT (§9.4).

import type { MatchStatus } from '../../../core/models/enums';

/**
 * Una partida pública abierta visible en el lobby. Unidad que se lista, se
 * actualiza por deltas y desde la que se ejecuta "Unirse".
 *
 * `joinCode` se deriva en el front a partir de `_links.join.href`
 * (`/api/join/{joinCode}`) en la respuesta REST. En los eventos WS puede no venir
 * (ver nota en data-model.md): una card sin `joinCode` deshabilita "Unirse" hasta
 * reconciliar con REST.
 */
export interface PublicMatchLobbyItem {
  matchId: string;
  host: string;
  gamesToPlay: 1 | 3 | 5;
  totalSlots: number;
  occupiedSlots: number;
  status: MatchStatus; // en el lobby siempre 'WAITING_FOR_PLAYERS'
  joinCode: string | null;
}

/** §4.3 GET /api/matches/public — página cursor-based ya normalizada para el front. */
export interface PublicMatchesPage {
  items: PublicMatchLobbyItem[];
  /** Cursor opaco para la siguiente página; null si no hay más. */
  nextCursor: string | null;
}

// ---------- Eventos del topic /topic/public-match-lobby (§9.4) ----------

export interface PublicMatchLobbyUpsertEvent {
  eventType: 'PUBLIC_MATCH_LOBBY_UPSERT';
  timestamp: number; // epochMillis
  payload: { lobby: PublicMatchLobbyItem };
}

export interface PublicMatchLobbyRemovedEvent {
  eventType: 'PUBLIC_MATCH_LOBBY_REMOVED';
  timestamp: number;
  payload: { id: string };
}

export type PublicMatchLobbyEvent =
  | PublicMatchLobbyUpsertEvent
  | PublicMatchLobbyRemovedEvent;
