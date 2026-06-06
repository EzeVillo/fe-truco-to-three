# Contrato consumido por el front — Social (amistades)

**Feature**: 024-friends-system
**Fuente autoritativa**: `docs/CONTRATOS_API.md §7.5` (REST), `§8.2` (DTOs), `§9.5e`/`§9.6` (WS).

Este documento lista **solo** lo que el front consume en el MVP de amistades. Las invitaciones a
recursos (`/api/social/invitations*`) y el DM de amistad quedan fuera de alcance (FR-018).

> Base URL: `http://localhost:8080/api`. Todos los endpoints requieren `Authorization: Bearer <jwt>`
> (lo agrega `jwtInterceptor`). El other-user se identifica siempre por `username`.

---

## REST

### Amistades

| Acción | Método | Path | Body | Éxito | Errores relevantes |
|--------|--------|------|------|-------|--------------------|
| Listar amigos | GET | `/social/friendships` | — | `200` `FriendSummaryResponse[]` | 401 |
| Eliminar amigo | DELETE | `/social/friendships/{username}` | — | `204` | 404 (no existe), 422 (no `ACCEPTED`) |

### Solicitudes de amistad

| Acción | Método | Path | Body | Éxito | Errores relevantes |
|--------|--------|------|------|-------|--------------------|
| Enviar solicitud | POST | `/social/friendship-requests` | `{ "username": "martina" }` | `204` | 404/409/422 (inexistente, duplicada, self) |
| Aceptar | POST | `/social/friendship-requests/{username}/accept` | — | `204` | 404/422 |
| Rechazar | POST | `/social/friendship-requests/{username}/decline` | — | `204` | 404/422 |
| Cancelar (solo requester) | POST | `/social/friendship-requests/{username}/cancel` | — | `204` | 404/422 |
| Listar recibidas | GET | `/social/friendship-requests/incoming` | — | `200` `IncomingFriendshipRequestResponse[]` | 401 |
| Listar enviadas | GET | `/social/friendship-requests/outgoing` | — | `200` `OutgoingFriendshipRequestResponse[]` | 401 |

### Formas de respuesta (§8.2)

```jsonc
// FriendSummaryResponse
{ "friendUsername": "martina" }

// IncomingFriendshipRequestResponse
{ "requesterUsername": "juancho" }

// OutgoingFriendshipRequestResponse
{ "addresseeUsername": "martina" }
```

> Los códigos de error exactos por endpoint no están todos enumerados en el contrato para cada caso;
> el front mapea por status HTTP genérico vía `getErrorCopy('SOCIAL', err)` y nunca muestra el
> `message` crudo del backend. El catálogo de copy se documenta en `data-model.md §6`.

---

## WebSocket — `/user/queue/social`

Suscripción permitida (`§9.3`). Frame `SUBSCRIBE` sin headers extra (a diferencia de
`match-spectate`). Autenticación por el `CONNECT` con `Authorization: Bearer <jwt>` (ya lo maneja
`WebSocketService`).

### eventType (subset de amistades, §9.5e)

| eventType | Receptor | Payload (§9.6) |
|-----------|----------|----------------|
| `FRIEND_REQUEST_RECEIVED` | addressee | `{ requesterUsername, addresseeUsername }` |
| `FRIEND_REQUEST_ACCEPTED` | requester | `{ requesterUsername, addresseeUsername }` |
| `FRIEND_REQUEST_DECLINED` | requester | `{ requesterUsername, addresseeUsername }` |
| `FRIEND_REQUEST_CANCELLED` | addressee | `{ requesterUsername, addresseeUsername }` |
| `FRIENDSHIP_REMOVED` | ambos | `{ requesterUsername, addresseeUsername, removedByUsername }` |

> El mismo canal emite también `RESOURCE_INVITATION_*` (§9.5e). El handler del store los **ignora**
> (default case) en esta entrega.

### Mapeo evento → estado

Ver tabla de transición en `data-model.md §4`. Todas las mutaciones son idempotentes (dedup por
`username`), de modo que el orden de llegada REST vs WS no afecta el estado final.

---

## Contract test (sugerido)

Replicar el patrón de `src/tests/contract/`: un test que afirme (vía `satisfies`) que los tipos
`FriendSummary`, `IncomingFriendshipRequest`, `OutgoingFriendshipRequest` y la unión `SocialWsEvent`
coinciden con las formas documentadas en `§8.2`/`§9.6`. Falla si el contrato y el tipo divergen.
