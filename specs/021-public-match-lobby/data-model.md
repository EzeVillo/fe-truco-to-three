# Data Model — Lobby público de matches (021)

Phase 1. Entidades y DTOs del front. Fuente autoritativa de campos:
`docs/CONTRATOS_API.md §1.5` (visibilidad), `§4.1` (crear), `§4.3` (listar públicas), `§4.4` (join),
`§9.4` (eventos de topic público). Todo DTO se valida campo a campo contra esas secciones (Principio
II de la constitution) y se cubre con un contract test.

## Tipos genéricos del motor (`shared/public-lobby/public-lobby.types.ts`)

```ts
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
  idOf: (item: T) => string;
  loadPage: (cursor: string | null) => Observable<PublicLobbyPage<T>>;
  deltas$: Observable<PublicLobbyDelta<T>>;
}

export type PublicLobbyStatus = 'idle' | 'loading' | 'ready' | 'error';
```

Estado expuesto por `PublicLobbyStore<T>` (signals): `items: Signal<T[]>`,
`status: Signal<PublicLobbyStatus>`, `hasMore: Signal<boolean>`.
Métodos: `start()`, `loadMore()`, `retry()`, `stop()`.

## Entidad: Partida pública en lobby (`features/lobby/models/public-match-lobby.models.ts`)

DTO del item de `GET /api/matches/public` (`§4.3`) y del `payload.lobby` del evento
`PUBLIC_MATCH_LOBBY_UPSERT` (`§9.4`) — **mismo shape** en ambos transportes.

```ts
export interface PublicMatchLobbyItem {
  matchId: string;
  host: string;                 // username del anfitrión
  gamesToPlay: 1 | 3 | 5;       // partidas totales de la serie (mapea a SeriesFormat)
  totalSlots: number;           // 2 para matches 1v1
  occupiedSlots: number;        // 1 mientras espera rival
  status: 'WAITING_FOR_PLAYERS';
  /** joinCode extraído de _links.join.href = /api/join/{joinCode} (solo REST). */
  joinCode: string;
}
```

| Campo | Tipo | Origen | Notas |
|-------|------|--------|-------|
| `matchId` | string | REST item / `payload.lobby.matchId` | clave única (`idOf`) |
| `host` | string | REST / `payload.lobby.host` | se muestra en la card |
| `gamesToPlay` | `1\|3\|5` | REST / `payload.lobby` | label vía `SERIES_FORMAT_LABELS` (invertir con helper) |
| `totalSlots` | number | REST / `payload.lobby` | denominador "x/y" |
| `occupiedSlots` | number | REST / `payload.lobby` | numerador "x/y" |
| `status` | `'WAITING_FOR_PLAYERS'` | REST / `payload.lobby` | solo se listan abiertas |
| `joinCode` | string | `_links.join.href` (REST) | parseado del último segmento del path |

> **Nota**: el evento WS `UPSERT` no incluye `_links`. Para deltas, el `joinCode` se deriva del
> bootstrap o, si el item llega solo por WS, se puede reconstruir el href `/api/join/{joinCode}` solo
> si el backend lo provee. Si el payload WS no trae `joinCode` (a confirmar en integración), la card
> que aún no tiene `joinCode` deshabilita "Unirse" hasta reconciliar con REST. **Asunción**: el
> backend incluye lo necesario para unirse; verificar en `quickstart` contra backend real.

## DTOs de lista (`core/models/match.models.ts` — extender)

```ts
/** §4.3 GET /api/matches/public — página cursor-based. */
export interface PublicMatchesPage {
  items: PublicMatchLobbyItem[];
  nextCursor: string | null;   // derivado de _links.next.href (?after=…), null si no hay
}
```

## Eventos WS del topic `/topic/public-match-lobby` (`§9.4`)

```ts
export interface PublicMatchLobbyUpsertEvent {
  eventType: 'PUBLIC_MATCH_LOBBY_UPSERT';
  timestamp: number;           // epochMillis
  payload: { lobby: PublicMatchLobbyItem };  // sin _links; joinCode puede faltar (ver nota)
}

export interface PublicMatchLobbyRemovedEvent {
  eventType: 'PUBLIC_MATCH_LOBBY_REMOVED';
  timestamp: number;
  payload: { id: string };     // matchId removido
}

export type PublicMatchLobbyEvent =
  | PublicMatchLobbyUpsertEvent
  | PublicMatchLobbyRemovedEvent;
```

> **Excepción documentada (`§9.4`)**: los eventos de lobby público **no** llevan `matchId` top-level;
> el id va en `payload.lobby` (UPSERT) o `payload.id` (REMOVED). El mapeo al delta genérico:
> `UPSERT → { kind:'upsert', item: payload.lobby }`, `REMOVED → { kind:'removed', id: payload.id }`.

## DTO de creación (`core/models/match.models.ts` — ya existe, se reutiliza)

`CreateMatchRequest { gamesToPlay: 1|3|5; visibility: Visibility }` y
`CreateMatchResponse { matchId; joinCode; visibility }` ya están definidos (§4.1). Para `visibility:
'PUBLIC'` la respuesta también trae `joinCode` (§1.5). No requiere cambios de tipo, solo permitir
elegir `PUBLIC` en la UI.

## Configuración de creación (estado de UI, no DTO)

```ts
// online-match-page
visibility = signal<Visibility>('PRIVATE');   // default PRIVATE (D6)
seriesFormat = signal<SeriesFormat>(DEFAULT_SERIES_FORMAT); // BEST_OF_3
```

## Transiciones de estado del store

```text
idle --start()--> loading --(REST ok)--> ready --loadMore()--> loading --> ready
  loading --(REST error)--> error --retry()--> loading
  ready/loading --(delta UPSERT)--> (item insertado/reemplazado por id)
  ready/loading --(delta REMOVED)--> (item eliminado por id)
  (delta REMOVED durante loading) --> id registrado en removedIds; REST no lo re-inserta
```

## Reglas de validación / invariantes

- `idOf` = `matchId`; no puede haber dos items con el mismo `matchId` en `items()` (dedup por Map).
- Un `REMOVED` de un id inexistente es no-op (idempotente).
- El bootstrap nunca elimina items; solo los deltas `REMOVED` eliminan.
- `gamesToPlay` siempre ∈ {1,3,5}; cualquier otro valor del backend se descarta/loguea (no debería
  ocurrir según contrato).
- La partida propia del usuario (host === username actual) se marca "tuya"; su acción navega a la sala
  en lugar de re-unirse (edge case del spec).
