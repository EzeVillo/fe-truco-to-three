# Data Model: Invitar a partida a los amigos

**Feature**: 025-invite-friends-match
**Fecha**: 2026-06-06
**Fuente autoritativa**: `docs/CONTRATOS_API.md` §7.4.5 (friendships con disponibilidad),
§7.4.7–7.4.13 (invitaciones), §8.1–8.2 (enums/estados), §9.5e/§9.6 (eventos sociales).

> Regla del proyecto: tipar **campo a campo** contra el contrato. Los enums son
> **case-sensitive**. Se ignoran campos fuera de alcance (`spectatableMatch`).

## 1. Enums

```ts
/** §7.4.5 — disponibilidad del amigo a efectos de invitación. */
export type FriendAvailability = 'AVAILABLE' | 'BUSY';

/** §7.4.5 — motivo de ocupación; null si AVAILABLE. */
export type FriendBusyReason =
  | 'IN_MATCH'
  | 'IN_LEAGUE'
  | 'IN_CUP'
  | 'OPEN_REMATCH'
  | 'IN_QUICK_QUEUE'
  | 'PENDING_INVITATION'
  | 'PENDING_FRIEND_REQUEST'
  | 'UNKNOWN';

/** §8.1 — targetType de invitación a recurso. En esta feature sólo se crea MATCH. */
export type ResourceInvitationTargetType = 'MATCH' | 'LEAGUE' | 'CUP';

/** §8.2 — estado de una invitación a recurso. */
export type ResourceInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';
```

## 2. Amigo con disponibilidad (extensión de `FriendSummary`)

`GET /api/social/friendships` ahora devuelve disponibilidad por amigo. Se extiende
`FriendSummary` en `src/app/core/models/social.models.ts`.

| Campo | Tipo | Notas |
|-------|------|-------|
| `friendUsername` | `string` | Identidad del amigo (case-insensitive en BE). Clave en la lista. |
| `online` | `boolean` | Presencia aproximada. **Gate (junto con `availability`)**: si es `false` no se permite invitar y se muestra "Desconectado". |
| `availability` | `FriendAvailability` | Gate de invitación. `AVAILABLE` + `online` → invitable. |
| `busyReason` | `FriendBusyReason \| null` | `null` si `AVAILABLE`. |

> `spectatableMatch` del contrato **se ignora** (FR-018): no se tipa ni se consume en esta
> feature.

**Reglas de validación / derivadas**:
- Acción "Invitar a partida" habilitada ⇔ `online === true && availability === 'AVAILABLE'`.
- Etiqueta de motivo: si `online === false` → "Desconectado" (prevalece sobre el
  `busyReason`); si `online === true && availability === 'BUSY'` →
  `busyReasonCopy(busyReason)` (catálogo del front); `UNKNOWN` o no catalogado → copy
  genérico "No disponible".

## 3. Invitación a partida — DTOs REST

```ts
/** POST /api/social/invitations — body. (targetType siempre 'MATCH' en esta feature.) */
export interface CreateResourceInvitationPayload {
  recipientUsername: string;
  targetType: ResourceInvitationTargetType; // 'MATCH'
  targetId: string;                          // matchId de la partida propia joinable
}

/** POST /api/social/invitations — 200. */
export interface CreateResourceInvitationResponse {
  invitationId: string;
  expiresAt: number; // epochMillis
}

/** GET /api/social/invitations/incoming — item. */
export interface IncomingResourceInvitation {
  invitationId: string;
  senderUsername: string;
  targetType: ResourceInvitationTargetType;
  targetId: string;
  status: ResourceInvitationStatus;
  expiresAt: number; // epochMillis
}

/** GET /api/social/invitations/outgoing — item. */
export interface OutgoingResourceInvitation {
  invitationId: string;
  recipientUsername: string;
  targetType: ResourceInvitationTargetType;
  targetId: string;
  status: ResourceInvitationStatus;
  expiresAt: number; // epochMillis
}
```

> accept / decline / cancel responden **204** sin body (igual que las acciones de amistad).

## 4. Eventos WebSocket — extensión de `SocialWsEvent`

Canal `/user/queue/social` (mismo que amistades). Se agregan a la unión discriminada en
`src/app/core/models/ws.models.ts`. Payloads exactos del contrato §9.6:

```ts
// Invitaciones a recurso
| WsEventBase<'RESOURCE_INVITATION_RECEIVED',
    { invitationId: string; senderUsername: string;
      targetType: ResourceInvitationTargetType; targetId: string; expiresAt: number }>
| WsEventBase<'RESOURCE_INVITATION_ACCEPTED',
    { invitationId: string; recipientUsername: string;
      targetType: ResourceInvitationTargetType; targetId: string }>
| WsEventBase<'RESOURCE_INVITATION_DECLINED',
    { invitationId: string; recipientUsername: string;
      targetType: ResourceInvitationTargetType; targetId: string }>
| WsEventBase<'RESOURCE_INVITATION_CANCELLED',
    { invitationId: string; senderUsername: string;
      targetType: ResourceInvitationTargetType; targetId: string }>
| WsEventBase<'RESOURCE_INVITATION_EXPIRED',
    { invitationId: string; senderUsername: string; recipientUsername: string;
      targetType: ResourceInvitationTargetType; targetId: string }>

// Disponibilidad de amigos
| WsEventBase<'FRIEND_AVAILABILITY_STATE',
    { friends: FriendAvailabilitySnapshotItem[] }>
| WsEventBase<'FRIEND_AVAILABILITY_CHANGED', FriendAvailabilityDelta>
```

```ts
/** Item del snapshot FRIEND_AVAILABILITY_STATE (spectatableMatch ignorado). */
export interface FriendAvailabilitySnapshotItem {
  friendUsername: string;
  online: boolean;
  availability: FriendAvailability;
  busyReason: FriendBusyReason | null;
}

/** Delta FRIEND_AVAILABILITY_CHANGED (un amigo). */
export interface FriendAvailabilityDelta {
  friendUsername: string;
  online: boolean;
  availability: FriendAvailability;
  busyReason: FriendBusyReason | null;
}
```

## 5. Estado del store (extensión de `SocialState`)

Campos nuevos en `SocialStore`:

| Campo | Tipo | Propósito |
|-------|------|-----------|
| `friends` | `FriendSummary[]` (ext.) | Ahora con disponibilidad por amigo. |
| `outgoingInvitations` | `OutgoingResourceInvitation[]` | Invitaciones enviadas pendientes (US3). |
| `incomingInvitationToast` | `IncomingResourceInvitation \| null` | Invitación recibida a mostrar como toast (D5). |
| `inviteActionError` | `string \| null` | Error de la última acción de invitar/cancelar (copy del front). |

> No se agrega lista persistente de invitaciones recibidas (D5).

## 6. Transiciones de estado (reconciliación en el store)

Identidad: `invitationId` para invitaciones; `friendUsername` (case-insensitive) para
disponibilidad. Todas las operaciones son **idempotentes** y **resistentes al orden** (igual
que el store social actual).

### Disponibilidad de amigos
- `FRIEND_AVAILABILITY_STATE` (snapshot): para cada item, hacer merge de
  `online/availability/busyReason` sobre el amigo existente por `friendUsername`. No crea ni
  borra amistades (eso lo manejan los eventos de amistad).
- `FRIEND_AVAILABILITY_CHANGED` (delta): merge del amigo indicado; no-op si el username no
  está en la lista.
- Bootstrap REST de `listFriends()` ya trae la disponibilidad inicial; el snapshot WS la
  reconcilia tras (re)conectar.

### Invitaciones enviadas (`outgoingInvitations`)
- Acción `createInvitation` OK → upsert por `invitationId` (estado `PENDING`).
- `RESOURCE_INVITATION_ACCEPTED` / `_DECLINED` / `_EXPIRED` → remove por `invitationId`.
- Acción `cancelInvitation` OK (o `RESOURCE_INVITATION_CANCELLED` reflejado al remitente) →
  remove por `invitationId`. (Optimista con rollback ante fallo de la acción.)

### Invitación recibida (`incomingInvitationToast`)
- `RESOURCE_INVITATION_RECEIVED` → set toast con el payload (sólo `targetType === 'MATCH'`;
  otros targetType se ignoran en esta feature).
- `RESOURCE_INVITATION_CANCELLED` / `_EXPIRED` que matchee el toast actual por `invitationId`
  → limpiar toast.
- Aceptar/rechazar desde el toast → limpiar toast.
- Bootstrap/reconexión: `listIncomingInvitations()`; si hay una `PENDING` de tipo `MATCH`,
  set como toast (re-surface, D5).

## 7. Mapeo de errores (catálogo del front)

- Acciones de invitación (crear/aceptar/cancelar/rechazar): `getErrorCopy('SOCIAL', err)`
  reusando el scope social existente. Casos relevantes: `404` (invitación/usuario no
  existe), `409`/`422` (no joinable, duplicada, destinatario ocupado, revancha abierta),
  `0`/`5xx` (red/servidor). **Nunca** `ApiError.message`.
- `busyReason` → función `busyReasonCopy(reason)` en el catálogo del front (español):
  `IN_MATCH` → "En partida", `IN_LEAGUE` → "En una liga", `IN_CUP` → "En una copa",
  `OPEN_REMATCH` → "Con revancha pendiente", `IN_QUICK_QUEUE` → "Buscando rival",
  `PENDING_INVITATION` → "Con una invitación pendiente",
  `PENDING_FRIEND_REQUEST` → "Con una solicitud pendiente",
  `UNKNOWN`/otro → "No disponible".
