# Data Model: Sistema de amigos (MVP solo amistades)

**Feature**: 024-friends-system | **Date**: 2026-06-05

Fuente autoritativa del contrato: `docs/CONTRATOS_API.md §7.5`, `§8.2`, `§9.5e`, `§9.6`.
Identidad pública del otro jugador = `username` (el backend **no** expone `friendshipId`).

---

## 1. DTOs REST (respuestas del backend)

Tipados campo a campo contra `§8.2`. Van en `src/app/core/models/social.models.ts`.

```ts
/** GET /api/social/friendships → FriendSummaryResponse[] (§8.2) */
export interface FriendSummary {
  friendUsername: string;
}

/** GET /api/social/friendship-requests/incoming → IncomingFriendshipRequestResponse[] (§8.2) */
export interface IncomingFriendshipRequest {
  requesterUsername: string;
}

/** GET /api/social/friendship-requests/outgoing → OutgoingFriendshipRequestResponse[] (§8.2) */
export interface OutgoingFriendshipRequest {
  addresseeUsername: string;
}

/** POST /api/social/friendship-requests body */
export interface CreateFriendshipRequestPayload {
  username: string;
}
```

> Nota: los DTOs de invitaciones a recursos (`IncomingResourceInvitationResponse`, etc.) existen en
> el contrato pero quedan **fuera de alcance** (FR-018); no se tipan en esta entrega.

---

## 2. Eventos WebSocket — canal `/user/queue/social`

Tipados contra `§9.5e` (eventType) y `§9.6` (payload). Se añaden a
`src/app/core/models/ws.models.ts` definiendo `SocialWsEvent` (hoy es solo un comentario pendiente)
y sumándolo a la unión `WsEvent`.

```ts
interface WsEventBase<TType extends string, TPayload> {
  eventType: TType;
  timestamp: number;
  payload: TPayload;
}

export type SocialWsEvent =
  | WsEventBase<'FRIEND_REQUEST_RECEIVED', { requesterUsername: string; addresseeUsername: string }>
  | WsEventBase<'FRIEND_REQUEST_ACCEPTED', { requesterUsername: string; addresseeUsername: string }>
  | WsEventBase<'FRIEND_REQUEST_DECLINED', { requesterUsername: string; addresseeUsername: string }>
  | WsEventBase<'FRIEND_REQUEST_CANCELLED', { requesterUsername: string; addresseeUsername: string }>
  | WsEventBase<
      'FRIENDSHIP_REMOVED',
      { requesterUsername: string; addresseeUsername: string; removedByUsername: string }
    >;
```

> Los eventos `RESOURCE_INVITATION_*` del mismo canal (`§9.5e`) quedan fuera de alcance; el handler
> del store los ignora silenciosamente (default case) para no romper ante su llegada.

---

## 3. Entidades de dominio (estado del store)

`social.store.ts` mantiene:

| Señal | Tipo | Origen |
|-------|------|--------|
| `friends` | `FriendSummary[]` | bootstrap REST + reconciliación WS |
| `incoming` | `IncomingFriendshipRequest[]` | bootstrap REST + reconciliación WS |
| `outgoing` | `OutgoingFriendshipRequest[]` | bootstrap REST + reconciliación WS |
| `loading` | `boolean` | true durante el bootstrap |
| `error` | `string \| null` | copy de `getErrorCopy('SOCIAL', err)` |

**Clave de identidad / dedup**: el `username` del otro jugador en cada lista
(`friendUsername` / `requesterUsername` / `addresseeUsername`). Comparación case-sensitive según el
contrato (el backend hace lookups case-insensitive, pero devuelve el username canónico).

---

## 4. Transiciones — evento WS → mutación de listas

`self` = `authStore.username()`. Todas las mutaciones son **idempotentes** (FR-013).

| Evento | Quién lo recibe | Mutación |
|--------|-----------------|----------|
| `FRIEND_REQUEST_RECEIVED` | addressee | `incoming` ← upsert `{ requesterUsername }` |
| `FRIEND_REQUEST_ACCEPTED` | requester | `outgoing` ← remove `addresseeUsername`; `friends` ← upsert `{ friendUsername: addresseeUsername }` |
| `FRIEND_REQUEST_DECLINED` | requester | `outgoing` ← remove `addresseeUsername` |
| `FRIEND_REQUEST_CANCELLED` | addressee | `incoming` ← remove `requesterUsername` |
| `FRIENDSHIP_REMOVED` | ambos | `friends` ← remove `other(self, payload)` donde `other` = el username del par `{requesterUsername, addresseeUsername}` que no es `self` |

**Reglas de mutación**:
- `upsert(list, key)`: si ya existe una entrada con esa clave, no-op; si no, la agrega.
- `remove(list, key)`: filtra la entrada con esa clave; no-op si no está.

---

## 5. Transiciones — acción del usuario → REST → estado

| Acción (US) | REST | Éxito | Estado local |
|-------------|------|-------|--------------|
| Enviar solicitud (US1) | `POST /api/social/friendship-requests` `{username}` | `204` | `outgoing` ← upsert `{addresseeUsername: username}` |
| Aceptar (US2) | `POST /api/social/friendship-requests/{username}/accept` | `204` | `incoming` ← remove; `friends` ← upsert |
| Rechazar (US2) | `POST /api/social/friendship-requests/{username}/decline` | `204` | `incoming` ← remove |
| Cancelar (US4) | `POST /api/social/friendship-requests/{username}/cancel` | `204` | `outgoing` ← remove |
| Listar (US3/bootstrap) | `GET /api/social/friendships` + incoming + outgoing | `200` | set de las 3 listas |
| Eliminar amigo (US3) | `DELETE /api/social/friendships/{username}` | `204` | `friends` ← remove |

El WS confirma el mismo cambio en el otro extremo; por idempotencia, no genera duplicados aunque el
evento llegue a quien ya aplicó la mutación localmente.

**Validaciones de front previas al REST**:
- Enviar: `username` no vacío y `username !== self` (FR-003). El resto (existe, no-duplicado) lo
  valida el backend y se traduce con `getErrorCopy`.

---

## 6. Errores → copy (`getErrorCopy('SOCIAL', err)`)

| Status | Copy (borrador, afinar en impl) |
|--------|-------------------------------|
| `401` | `''` (interceptor) |
| `404` | "Ese usuario no existe o la solicitud ya no está disponible." |
| `409` / `422` | "No se pudo completar la acción: revisá el estado de la solicitud." |
| `0` / `5xx` | "No pudimos conectarnos. Reintentá en unos segundos." |
| otro | fallback genérico |

Nunca se muestra `ApiError.message` (FR-015, Constitution).

---

## 7. Estados de UI por lista (FR-017)

Cada tab maneja: **cargando** (bootstrap en curso), **vacío** (lista sin items, con copy guía) y
**poblado**. El error de bootstrap se muestra a nivel página con opción de reintento.
