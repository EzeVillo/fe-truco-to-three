# Contrato de interfaces: Invitaciones a partida + disponibilidad de amigos

**Feature**: 025-invite-friends-match
**Fuente**: `docs/CONTRATOS_API.md` §7.4.5, §7.4.7–7.4.13, §8.1–8.2, §9.5e/§9.6.

Este documento fija el contrato que el front consume. Cada DTO/evento debe verificarse campo a
campo contra `docs/CONTRATOS_API.md` (guardarraíl de constitución) y cubrirse por el contract
test `src/tests/contract/social-invitations.contract.spec.ts`.

## 1. REST — capa `SocialApiService` (métodos nuevos)

| Método | HTTP | Path | Body | Respuesta |
|--------|------|------|------|-----------|
| `createInvitation(payload)` | POST | `/social/invitations` | `CreateResourceInvitationPayload` | `CreateResourceInvitationResponse` (200) |
| `acceptInvitation(id)` | POST | `/social/invitations/{id}/accept` | `null` | `void` (204) |
| `declineInvitation(id)` | POST | `/social/invitations/{id}/decline` | `null` | `void` (204) |
| `cancelInvitation(id)` | POST | `/social/invitations/{id}/cancel` | `null` | `void` (204) |
| `listIncomingInvitations()` | GET | `/social/invitations/incoming` | — | `IncomingResourceInvitation[]` (200) |
| `listOutgoingInvitations()` | GET | `/social/invitations/outgoing` | — | `OutgoingResourceInvitation[]` (200) |

> `{id}` se pasa por `encodeURIComponent`. Reusa `environment.apiUrl` y el `jwtInterceptor`.

### Reglas del BE relevantes para el cliente (no romper supuestos)
- Sólo amistades `ACCEPTED`; destinatario debe estar libre; recurso debe seguir admitiendo
  `join` y tener `joinCode`; una sola invitación `PENDING` por amigo y recurso.
- accept hace `join` directo; si el recurso ya no admite join → `EXPIRED` + error.
- Expiración match por defecto `PT10M`; `RESOURCE_INVITATION_EXPIRED` llega ≤1s del
  vencimiento.

### Errores esperados (mapear con `getErrorCopy('SOCIAL', err)`)
- `401` → '' (lo maneja el interceptor). `404` → invitación/usuario inexistente.
- `409`/`422` → no joinable / duplicada / destinatario ocupado / revancha abierta
  (`PlayerHasOpenRematchSessionException`, `PlayerAlreadyInMatchException`, etc.).
- `0`/`5xx` → red/servidor. **Nunca** mostrar `ApiError.message`.

## 2. REST — `GET /api/social/friendships` (forma extendida)

Respuesta `200`: `FriendSummary[]` donde cada item ahora incluye:

```jsonc
{
  "friendUsername": "martina",
  "online": true,
  "availability": "BUSY",     // "AVAILABLE" | "BUSY"
  "busyReason": "IN_MATCH",   // null si AVAILABLE
  "spectatableMatch": { /* IGNORADO en esta feature */ }
}
```

El front tipa `friendUsername`, `online`, `availability`, `busyReason`. `spectatableMatch` se
omite del tipo consumido.

## 3. WebSocket — `/user/queue/social` (eventos nuevos)

Se agregan a la unión `SocialWsEvent`. El consumidor (`SocialStore.applyEvent`) maneja sólo
los de `targetType === 'MATCH'` para invitaciones; el resto cae en el `default` (no-op).

| `eventType` | Payload | Efecto en el store |
|-------------|---------|--------------------|
| `RESOURCE_INVITATION_RECEIVED` | `{ invitationId, senderUsername, targetType, targetId, expiresAt }` | set `incomingInvitationToast` |
| `RESOURCE_INVITATION_ACCEPTED` | `{ invitationId, recipientUsername, targetType, targetId }` | remove de `outgoingInvitations` |
| `RESOURCE_INVITATION_DECLINED` | `{ invitationId, recipientUsername, targetType, targetId }` | remove de `outgoingInvitations` |
| `RESOURCE_INVITATION_CANCELLED` | `{ invitationId, senderUsername, targetType, targetId }` | limpiar toast si matchea |
| `RESOURCE_INVITATION_EXPIRED` | `{ invitationId, senderUsername, recipientUsername, targetType, targetId }` | remove de outgoing + limpiar toast si matchea |
| `FRIEND_AVAILABILITY_STATE` | `{ friends: FriendAvailabilitySnapshotItem[] }` | merge disponibilidad sobre `friends` |
| `FRIEND_AVAILABILITY_CHANGED` | `FriendAvailabilityDelta` | merge del amigo indicado |

## 4. Reuso (sin cambios de contrato)

- `GET /api/me/presence` → `UserPresenceResponse` (ya tipado en `presence.models.ts`); se usa
  `match.id` cuando `match.status === 'WAITING_FOR_PLAYERS'` como `targetId`.
- `POST /api/matches` → `CreateMatchResponse { matchId, joinCode }` (ya existente) para el
  flujo de crear partida desde la entrada de amigos.
- `/user/queue/presence` (`PRESENCE_UPDATED`) → redirección al aceptar (vía
  `PresenceCoordinatorService`).

## 5. Contract test (obligatorio)

`src/tests/contract/social-invitations.contract.spec.ts` debe:
- Parsear de `docs/CONTRATOS_API.md` los enums (`FriendAvailability`, `FriendBusyReason`,
  `ResourceInvitationStatus`, `ResourceInvitationTargetType`) y verificar paridad con los
  tipos TS vía `satisfies`.
- Verificar la forma de `CreateResourceInvitationPayload` / `CreateResourceInvitationResponse`
  / `IncomingResourceInvitation` / `OutgoingResourceInvitation` contra §8.2.
- Verificar los `eventType` y payloads de los 7 eventos nuevos contra §9.5e/§9.6.
