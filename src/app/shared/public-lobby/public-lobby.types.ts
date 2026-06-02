// Tipos genéricos del motor de lobby público — feature 021-public-match-lobby.
// El contrato del backend es simétrico para matches/copas/ligas
// (docs/CONTRATOS_API.md §1.5, §9.4): bootstrap REST + reconciliación con deltas
// de un topic. Este motor encapsula esa mecánica para reusarla sin reescribirla.

import type { Observable } from 'rxjs';

/** Página genérica devuelta por el bootstrap/paginación REST de un lobby público. */
export interface PublicLobbyPage<T> {
  items: T[];
  /** Cursor opaco para la siguiente página; null si no hay más. */
  nextCursor: string | null;
}

/** Delta normalizado proveniente del topic WS de un lobby público. */
export type PublicLobbyDelta<T> =
  | { kind: 'upsert'; item: T }
  | { kind: 'removed'; id: string };

/** Configuración con la que el caller instancia el motor genérico. */
export interface PublicLobbyConfig<T> {
  /** Clave única de cada item (p. ej. matchId). Usada para dedup e idempotencia. */
  idOf: (item: T) => string;
  /** Bootstrap/paginación REST. `cursor` null pide la primera página. */
  loadPage: (cursor: string | null) => Observable<PublicLobbyPage<T>>;
  /** Stream de upserts/removed ya mapeado desde el topic WS. */
  deltas$: Observable<PublicLobbyDelta<T>>;
}

export type PublicLobbyStatus = 'idle' | 'loading' | 'ready' | 'error';
