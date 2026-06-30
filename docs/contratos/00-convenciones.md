# Convenciones generales

> [← Volver al índice de contratos](../CONTRATOS_API.md)

## Autenticacion y reglas generales

### Tokens

- Access token:
    - tipo: `Bearer <JWT>`
    - uso: endpoints protegidos REST y autenticacion WebSocket/STOMP
    - se obtiene en:
        - `POST /api/auth/register`
        - `POST /api/auth/login`
        - `POST /api/auth/refresh`
        - `POST /api/auth/guest`
- Refresh token:
    - tipo: token opaco
    - uso: body JSON de `POST /api/auth/refresh` y `DELETE /api/auth/logout`
    - se obtiene en:
        - `POST /api/auth/register`
        - `POST /api/auth/login`
        - `POST /api/auth/refresh`
    - no existe para guest
- Claims relevantes del access token:
    - `sub`: `playerId` (UUID)
    - `iss`, `aud`, `iat`, `exp`
    - `token_use`: `user` o `guest`

### Endpoints protegidos

Segun configuracion de seguridad:

- Publicos:
    - `POST /api/auth/register`
    - `POST /api/auth/login`
    - `POST /api/auth/guest`
    - `POST /api/auth/refresh`
    - `DELETE /api/auth/logout`
- Requieren Bearer token:
    - `GET /api/auth/me`
    - Todo `/api/**` no listado arriba (matches, leagues, etc.)

### Regla de autorizacion en recursos de juego

En endpoints protegidos alcanza con un Bearer token valido.

La pertenencia al recurso y las reglas de acceso se validan dentro de los casos de uso:

- un jugador solo puede operar sobre partidas en las que participa
- un espectador solo puede consultar una partida si ya quedo registrado como espectador de esa
  partida
- spectate esta permitido para miembros de la misma liga/copa del match o para amigos confirmados
  de alguno de los jugadores, nunca para uno de los dos jugadores activos

### IDs

Aunque algunos ejemplos de anotaciones muestran `match-123`, en runtime se parsea UUID.
Enviar siempre UUID valido en:

- `matchId`
- `leagueId`
- `playerId` en auth, claims y referencias tecnicas donde aplique

En respuestas REST de lectura y payloads WebSocket orientados a UI, los actores visibles se
devuelven con identificadores publicos orientados a presentacion (`username` o `displayName`,
segun el contrato) en lugar de `playerId`.

### Salas publicas y privadas

`matches`, `leagues` y `cups` aceptan `visibility: PUBLIC | PRIVATE` en creacion.

- `PRIVATE`:
    - devuelve `joinCode`
    - no aparece en lobby
    - se entra por `POST /api/join/{joinCode}`
- `PUBLIC`:
    - tambien devuelve `joinCode`
    - aparece en lobby
    - se entra por el mismo `POST /api/join/{joinCode}`
- unicidad global de join code:
    - `joinCode` es unico entre `MATCH`, `LEAGUE` y `CUP`
    - `POST /api/join/{joinCode}` siempre resuelve un unico target (`targetType` + `targetId`)
- listados de lobby:
    - `GET /api/matches/public`
    - `GET /api/leagues/public`
    - `GET /api/cups/public`
    - cada item expone `_links.join.href = /api/join/{joinCode}`
- autostart:
    - una partida publica pasa a `IN_PROGRESS` al entrar el segundo jugador
    - una liga/copa publica arranca automaticamente al completarse el cupo y crea/linkea los
      matches hijos en la misma operacion
- restricciones del lobby:
    - usuarios ocupados no pueden listar ni usar el lobby publico
    - si un jugador ya fue eliminado de una liga/copa en progreso, vuelve a ser elegible
    - REST devuelve una ventana cursor-based del lobby, no el listado completo
    - `limit` default `20`, maximo `100`
    - la navegacion es solo hacia adelante con `_links.next`
    - el stream WS del lobby tambien es compartido; el backend no excluye creador ni participantes

## Contrato de errores

Formato estandar para errores (`ErrorResponse`):

```json
{
  "errorCode": "UnauthorizedAccessException",
  "message": "Missing authentication token",
  "timestamp": "2026-03-06T03:15:30Z"
}
```

HTTP status usados:

- `400` Bad Request
- `401` Unauthorized
- `409` Conflict
- `404` Not Found
- `405` Method Not Allowed
- `422` Unprocessable Content
- `500` Internal Server Error

Caso comun de `409`:

- en `POST /api/join/{joinCode}`, otro request ocupo el ultimo lugar antes del retry final de un
  recurso publico
- en `POST /api/matches`, `POST /api/leagues` y `POST /api/cups`, el backend puede responder
  `409` con `JoinCodeRegistryConflictException` si se agotan los reintentos internos por colision
  del `joinCode` generado con otro recurso

Casos comunes de `422` relacionados a disponibilidad del jugador:

- `PlayerAlreadyInMatchException` — el jugador ya tiene un match activo
- `PlayerAlreadyInLeagueException` — el jugador ya esta en un torneo activo
- `PlayerHasOpenRematchSessionException` — el jugador tiene una sesion de revancha `OPEN` pendiente.
  Se devuelve en `POST /api/matches`, `POST /api/leagues`, `POST /api/cups`,
  `POST /api/matches/bot` y al aceptar una invitacion social (
  `POST /api/social/invitations/{id}/accept`).
- `PlayerAlreadyInQueueException` — el jugador ya esta en la cola de Quick Match.
  Se devuelve en `POST /api/matches`, `POST /api/leagues`, `POST /api/cups`,
  `POST /api/matches/bot`, `POST /api/matches/quick` y al aceptar una invitacion social.
- `PlayerIsSpectatingException` — el jugador esta especteando un match activamente.
  Se devuelve en `POST /api/matches`, `POST /api/leagues`, `POST /api/cups`,
  `POST /api/matches/bot`, `POST /api/matches/quick` y al aceptar una invitacion social.

Casos comunes de `400`:

- body faltante o malformado
- validaciones de bean validation sobre el request
- valor de enum invalido en campos string tipados por contrato

Cuando se envia un enum invalido, el backend responde con `InvalidEnumValueException` y detalla el
campo, el valor recibido y los valores permitidos.

Ejemplo:

```json
{
  "errorCode": "InvalidEnumValueException",
  "message": "Invalid value 'INVALIDO' for field 'response'. Allowed values: QUIERO, NO_QUIERO",
  "timestamp": "2026-03-30T18:00:00Z",
  "requestId": "b1f4d7a0-2f29-4e8f-b8ea-a302f9084f3b"
}
```

### Errores de social y amistad

La capa social (`/api/social/**`) usa los siguientes `errorCode` adicionales. Todos los endpoints
sociales requieren un usuario registrado; un token de guest devuelve `401`
(`SocialFeatureRequiresRegisteredUserException`).

| errorCode                                            | HTTP  | Significado                                                                          |
|------------------------------------------------------|-------|--------------------------------------------------------------------------------------|
| `SocialFeatureRequiresRegisteredUserException`       | `401` | La funcionalidad social requiere un usuario registrado (no guest).                   |
| `SocialUserNotFoundException`                        | `404` | El `username` indicado no corresponde a un usuario registrado.                       |
| `FriendshipNotFoundException`                        | `404` | No existe la amistad/solicitud buscada para el par de jugadores.                     |
| `InvitableResourceNotFoundException`                 | `404` | El recurso destino de una invitacion social (`MATCH`, `LEAGUE`, `CUP`) no existe.    |
| `ResourceInvitationNotFoundException`                | `404` | La invitacion social no existe.                                                      |
| `FriendshipRequestAlreadyPendingException`           | `409` | Ya existe una solicitud de amistad pendiente entre ambos usuarios.                   |
| `FriendshipAlreadyExistsException`                   | `409` | Ya existe una amistad aceptada entre ambos usuarios.                                 |
| `ResourceInvitationAlreadyExistsException`           | `409` | Ya existe una invitacion social pendiente para ese amigo y recurso.                  |
| `ResourceInvitationTargetUnavailableException`       | `409` | El recurso destino ya no admite joins.                                               |
| `FriendshipRequiredException`                        | `409` | Se requiere una amistad aceptada para realizar la accion.                            |
| `CannotFriendYourselfException`                      | `422` | Un jugador intento enviarse una solicitud de amistad a si mismo.                     |
| `FriendshipNotPendingException`                      | `422` | La solicitud de amistad no esta en estado `PENDING` cuando la operacion lo requiere. |
| `FriendshipNotAcceptedException`                     | `422` | La amistad no esta en estado `ACCEPTED` cuando la operacion lo requiere.             |
| `OnlyAddresseeCanRespondFriendRequestException`      | `422` | Solo el destinatario puede aceptar/rechazar una solicitud de amistad.                |
| `OnlyRequesterCanCancelFriendRequestException`       | `422` | Solo el solicitante puede cancelar una solicitud de amistad.                         |
| `PlayerNotPartOfFriendshipException`                 | `422` | El jugador autenticado no participa de la amistad.                                   |
| `OnlyRecipientCanRespondResourceInvitationException` | `422` | Solo el destinatario puede aceptar/rechazar una invitacion social.                   |
| `OnlySenderCanCancelResourceInvitationException`     | `422` | Solo el remitente puede cancelar una invitacion social.                              |
| `ResourceInvitationNotPendingException`              | `422` | La invitacion social no esta en estado `PENDING` cuando la operacion lo requiere.    |

## Enums y valores permitidos

Estos valores son case-sensitive y deben enviarse exactamente igual, en mayusculas y con guiones
bajos cuando aplique. Si el valor no coincide, la API responde `400` con
`InvalidEnumValueException`.

### Requests

- `PlayCardRequest.suit`:
    - `ESPADA`, `BASTO`, `COPA`, `ORO`
- `CallEnvidoRequest.call`:
    - `ENVIDO`, `REAL_ENVIDO`, `FALTA_ENVIDO`
- `RespondEnvidoRequest.response`:
    - `QUIERO`, `NO_QUIERO`
- `RespondTrucoRequest.response`:
    - `QUIERO`, `NO_QUIERO`, `QUIERO_Y_ME_VOY_AL_MAZO`
- `CreateResourceInvitationHttpRequest.targetType`:
    - `MATCH`, `LEAGUE`, `CUP`

### Estados en respuestas

- `MatchStateResponse.status`:
    - `WAITING_FOR_PLAYERS`, `READY`, `IN_PROGRESS`, `FINISHED`, `CANCELLED`
- `RoundStateResponse.roundStatus`:
    - `PLAYING`, `ENVIDO_IN_PROGRESS`, `TRUCO_IN_PROGRESS`, `FINISHED`
- `RoundStateResponse.currentTrucoCall`:
    - `TRUCO`, `RETRUCO`, `VALE_CUATRO` (o `null`)
- `RoundStateResponse.currentEnvidoCall`:
    - `ENVIDO`, `REAL_ENVIDO`, `FALTA_ENVIDO` (o `null`). Refleja el canto de envido **pendiente de
      respuesta**; es `null` si no hay envido en curso o si ya se resolvió (aceptado/rechazado). El
      mismo campo existe en `SpectatorRoundStateResponse.currentEnvidoCall`.
- `AvailableActionResponse.type`:
    - `PLAY_CARD`, `CALL_TRUCO`, `CALL_ENVIDO`, `RESPOND_TRUCO`, `RESPOND_ENVIDO`, `FOLD`
- `FriendSummaryResponse`:
    - expone `{ friendUsername }`
- `IncomingFriendshipRequestResponse`:
    - expone `{ requesterUsername }`
- `OutgoingFriendshipRequestResponse`:
    - expone `{ addresseeUsername }`
- `IncomingResourceInvitationResponse`:
    - expone `{ invitationId, senderUsername, targetType, targetId, status, expiresAt }`
- `OutgoingResourceInvitationResponse`:
    - expone `{ invitationId, recipientUsername, targetType, targetId, status, expiresAt }`
- `IncomingResourceInvitationResponse.status` / `OutgoingResourceInvitationResponse.status`:
    - `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`
- `IncomingResourceInvitationResponse.targetType` / `OutgoingResourceInvitationResponse.targetType`:
    - `MATCH`, `LEAGUE`, `CUP`
- `ChatParentType`:
    - `MATCH`, `LEAGUE`, `CUP`, `FRIENDSHIP`
- `RematchSessionResponse.status`:
    - `OPEN`, `CONFIRMED`, `CLOSED_BY_LEAVE`, `EXPIRED`
- `RematchSessionResponse.playerOneChoice` / `playerTwoChoice`:
    - `UNDECIDED`, `WANTS_REMATCH`, `LEFT`

### Logros (`AchievementCode`)

- `WIN_GAME_AS_PIE_MANO_BUSTS_ON_ENVIDO_WITH_0_0_AT_2_2`
- `WIN_GAME_AS_MANO_VIA_FALTA_ENVIDO_WITH_33_33_AT_2_2`
- `WIN_GAME_BUST_OPPONENT_VIA_QUIERO_Y_ME_VOY_AL_MAZO`
- `WIN_HAND_UNCONTESTED_WITH_ANCHO_DE_ESPADA`
- `FOLD_BEFORE_ANY_CARD_IS_PLAYED`
- `WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO`
- `WIN_GAME_THREE_ZERO_VIA_REAL_OR_FALTA_ENVIDO`
- `WIN_GAME_FROM_2_2_WITHOUT_CALLS_IN_ROUND`
- `WIN_GAME_BUST_OPPONENT_VIA_VALE_CUATRO_LOSS_AT_0_0`
- `WIN_GAME_BUST_RIVAL_VIA_FOLD_AFTER_ACCEPTED_TRUCO_WITH_NO_CARDS`
- `REACH_CAMPAIGN_TOP_ONE`
- `DEFEAT_ALL_CAMPAIGN_RIVALS`
- `UNLOCK_ALL_CAMPAIGN_BOTS_IN_CASUAL`

