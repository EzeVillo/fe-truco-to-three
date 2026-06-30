# API REST - Social

> [← Volver al índice de contratos](../CONTRATOS_API.md)

La capa social agrega amistades e invitaciones rapidas entre usuarios registrados. Los guests
quedan fuera de estas capacidades.

En todo el contrato publico social, el identificador del otro usuario es siempre `username`.
`friendshipId` sigue existiendo solo a nivel interno de dominio y persistencia; no se expone por
REST ni por WebSocket.

## Solicitar amistad

`POST /api/social/friendship-requests`

Request:

```json
{
  "username": "martina"
}
```

Response `204`: sin body.

Errores:

- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si el `username` no existe (`SocialUserNotFoundException`)
- `409` si ya existe una solicitud pendiente (`FriendshipRequestAlreadyPendingException`) o una
  amistad aceptada (`FriendshipAlreadyExistsException`) entre ambos usuarios
- `422` si se envia una solicitud a si mismo (`CannotFriendYourselfException`)

## Aceptar amistad

`POST /api/social/friendship-requests/{username}/accept`

Response `204`: sin body.

Errores:

- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si el `username` no existe (`SocialUserNotFoundException`) o no hay una solicitud pendiente
  de ese usuario (`FriendshipNotFoundException`)
- `422` si la solicitud no esta `PENDING` (`FriendshipNotPendingException`) o el usuario
  autenticado no es el destinatario (`OnlyAddresseeCanRespondFriendRequestException`)

## Rechazar amistad

`POST /api/social/friendship-requests/{username}/decline`

Response `204`: sin body.

Errores:

- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si el `username` no existe (`SocialUserNotFoundException`) o no hay una solicitud pendiente
  de ese usuario (`FriendshipNotFoundException`)
- `422` si la solicitud no esta `PENDING` (`FriendshipNotPendingException`) o el usuario
  autenticado no es el destinatario (`OnlyAddresseeCanRespondFriendRequestException`)

## Cancelar solicitud de amistad

`POST /api/social/friendship-requests/{username}/cancel`

Response `204`: sin body.

Solo puede llamarlo el requester (quien envió la solicitud). El addressee recibe una notificación
WebSocket `FRIEND_REQUEST_CANCELLED`.

Errores:

- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si el `username` no existe (`SocialUserNotFoundException`) o no hay una solicitud pendiente
  hacia ese usuario (`FriendshipNotFoundException`)
- `422` si la solicitud no esta `PENDING` (`FriendshipNotPendingException`) o el usuario
  autenticado no es el solicitante (`OnlyRequesterCanCancelFriendRequestException`)

## Eliminar amigo

`DELETE /api/social/friendships/{username}`

Response `204`: sin body.

Cualquiera de los dos jugadores puede eliminar una amistad `ACCEPTED`. Ambos reciben una
notificacion WebSocket `FRIENDSHIP_REMOVED`. Una vez eliminada, es posible re-enviar una solicitud
de amistad al mismo usuario.

Errores:

- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si el `username` no existe (`SocialUserNotFoundException`) o no hay una amistad aceptada
  con ese usuario (`FriendshipNotFoundException`)
- `422` si la amistad no esta `ACCEPTED` (`FriendshipNotAcceptedException`) o el usuario
  autenticado no participa de ella (`PlayerNotPartOfFriendshipException`)

## Listar amigos

`GET /api/social/friendships`

Response `200`:

```json
[
  {
    "friendUsername": "martina",
    "online": true,
    "availability": "BUSY",
    "busyReason": "IN_MATCH",
    "spectatableMatch": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "IN_PROGRESS"
    }
  },
  {
    "friendUsername": "agus",
    "online": false,
    "availability": "AVAILABLE",
    "busyReason": null,
    "spectatableMatch": null
  }
]
```

Notas:

- `availability` indica si el amigo puede recibir o aceptar una invitacion a partida:
  `AVAILABLE` o `BUSY`.
- `busyReason` es `null` si `availability = AVAILABLE`; si esta `BUSY`, puede ser `IN_MATCH`,
  `IN_LEAGUE`, `IN_CUP`, `OPEN_REMATCH`, `IN_QUICK_QUEUE`, `SPECTATING`, `PENDING_INVITATION`,
  `PENDING_FRIEND_REQUEST` o `UNKNOWN`.
- `online` es presencia aproximada por sesiones WebSocket activas conocidas y no cambia por si
  misma la disponibilidad para invitar.
- `spectatableMatch` es `null` cuando el amigo no tiene una partida `IN_PROGRESS`.
- `spectatableMatch.id` se usa como header `matchId` al suscribirse a
  `/user/queue/match-spectate`.
- El alta de espectador sigue siendo WebSocket-first; este endpoint solo permite descubrir partidas
  espectables de amigos.
- El estado inicial puede reconciliarse luego por `/user/queue/social` con
  `FRIEND_AVAILABILITY_STATE`, y los cambios posteriores llegan como
  `FRIEND_AVAILABILITY_CHANGED`.

## Listar solicitudes recibidas

`GET /api/social/friendship-requests/incoming`

Response `200`:

```json
[
  {
    "requesterUsername": "juancho"
  }
]
```

## Crear invitacion social

`POST /api/social/invitations`

Request:

```json
{
  "recipientUsername": "martina",
  "targetType": "MATCH",
  "targetId": "8b9c5936-9a1f-45ec-a587-24306689f6f7"
}
```

Reglas:

- `targetType`: `MATCH`, `LEAGUE` o `CUP`
- solo se puede invitar a amistades `ACCEPTED`
- el destinatario debe estar libre: sin match sin finalizar ni torneos activos/pendientes
- solo puede existir una invitacion `PENDING` por amigo y recurso
- el recurso debe seguir admitiendo `join` y tener `joinCode`

Response `200`:

```json
{
  "invitationId": "c21f5f0a-0a0a-41cc-9c63-3e04b0ff8b4f",
  "expiresAt": 1775304600000
}
```

Errores:

- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si el `recipientUsername` no existe (`SocialUserNotFoundException`)
- `409` si no hay amistad aceptada con el destinatario (`FriendshipRequiredException`), el
  destinatario no esta disponible (`PlayerAlreadyInActiveMatchException`,
  `PlayerHasOpenRematchSessionException`, `PlayerAlreadyInQueueException`,
  `PlayerIsSpectatingException`, `PlayerBusyInLeagueException`,
  `PlayerAlreadyInWaitingLeagueException`, `PlayerBusyInCupException`,
  `PlayerAlreadyInWaitingCupException`), ya existe una invitacion pendiente para ese amigo y
  recurso (`ResourceInvitationAlreadyExistsException`), el recurso no existe
  (`InvitableResourceNotFoundException`) o el recurso ya no admite joins
  (`ResourceInvitationTargetUnavailableException`)

## Aceptar invitacion social

`POST /api/social/invitations/{id}/accept`

Response `204`: sin body.

Semantica:

- el backend hace `join` directo sobre el recurso destino
- si el recurso ya no admite join, la invitacion pasa a `EXPIRED` y responde error

Errores:

- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si la invitacion no existe (`ResourceInvitationNotFoundException`)
- `409` si el recurso ya no admite joins (`ResourceInvitationTargetUnavailableException`)
- `422` si la invitacion no esta `PENDING` (`ResourceInvitationNotPendingException`) o el usuario
  autenticado no es el destinatario (`OnlyRecipientCanRespondResourceInvitationException`)

## Rechazar invitacion social

`POST /api/social/invitations/{id}/decline`

Response `204`: sin body.

Errores:

- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si la invitacion no existe (`ResourceInvitationNotFoundException`)
- `422` si la invitacion no esta `PENDING` (`ResourceInvitationNotPendingException`) o el usuario
  autenticado no es el destinatario (`OnlyRecipientCanRespondResourceInvitationException`)

## Listar invitaciones recibidas

`GET /api/social/invitations/incoming`

Devuelve las invitaciones a recurso pendientes recibidas por el jugador autenticado.

Response `200`: arreglo de `IncomingResourceInvitationResponse`.

## Listar solicitudes de amistad enviadas

`GET /api/social/friendship-requests/outgoing`

Devuelve las solicitudes de amistad pendientes enviadas por el jugador autenticado.

Response `200`:

```json
[
  {
    "addresseeUsername": "martina"
  }
]
```

## Listar invitaciones enviadas

`GET /api/social/invitations/outgoing`

Devuelve las invitaciones a recurso pendientes enviadas por el jugador autenticado.

Response `200`: arreglo de `OutgoingResourceInvitationResponse`.

## Cancelar invitacion enviada

`POST /api/social/invitations/{id}/cancel`

Cancela una invitacion pendiente enviada por el jugador autenticado.

Errores:

- `204` si se cancela correctamente
- `401` si el token es invalido, esta ausente o pertenece a un guest
  (`SocialFeatureRequiresRegisteredUserException`)
- `404` si la invitacion no existe (`ResourceInvitationNotFoundException`)
- `422` si la invitacion no esta `PENDING` (`ResourceInvitationNotPendingException`) o el usuario
  autenticado no es el remitente (`OnlySenderCanCancelResourceInvitationException`)

## Expiracion configurable de invitaciones

Properties operativas:

- `truco.social.invitation-expiration.match`
- `truco.social.invitation-expiration.league`
- `truco.social.invitation-expiration.cup`

Defaults en `application.yaml`:

- match: `PT10M`
- league: `PT30M`
- cup: `PT30M`

El backend programa el timeout de cada invitacion en el instante exacto de `expiresAt`; el evento
WebSocket `INVITATION_EXPIRED` se emite dentro de los 1000 ms del vencimiento configurado. Las
invitaciones tambien expiran si el recurso deja de admitir join.

## WebSocket

> Transporte (conexión, auth, envelope): ver [09-websocket.md](09-websocket.md).

Destino: `/user/queue/social` — eventos de amistades e invitaciones hacia usuarios registrados. Los
eventos sociales no llevan id de recurso top-level ni `stateVersion`.

Envelope de invitación social:

```json
{
  "eventType": "RESOURCE_INVITATION_RECEIVED",
  "timestamp": 1772768158123,
  "payload": {
    "invitationId": "c21f5f0a-0a0a-41cc-9c63-3e04b0ff8b4f",
    "senderUsername": "juancho",
    "targetType": "MATCH",
    "targetId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
    "expiresAt": 1775304600000
  }
}
```

Disponibilidad de amigos, snapshot al suscribirse a `/user/queue/social`:

```json
{
  "eventType": "FRIEND_AVAILABILITY_STATE",
  "timestamp": 1772768158123,
  "payload": {
    "friends": [
      {
        "friendUsername": "martina",
        "online": true,
        "availability": "BUSY",
        "busyReason": "IN_MATCH",
        "spectatableMatch": { "id": "8b9c5936-9a1f-45ec-a587-24306689f6f7", "status": "IN_PROGRESS" }
      },
      {
        "friendUsername": "agus",
        "online": false,
        "availability": "AVAILABLE",
        "busyReason": null,
        "spectatableMatch": null
      }
    ]
  }
}
```

Disponibilidad de amigos, delta:

```json
{
  "eventType": "FRIEND_AVAILABILITY_CHANGED",
  "timestamp": 1772768158123,
  "payload": {
    "friendUsername": "martina",
    "online": true,
    "availability": "AVAILABLE",
    "busyReason": null,
    "spectatableMatch": null
  }
}
```

### eventType - Social (`/user/queue/social`, usuarios registrados)

- `FRIEND_REQUEST_RECEIVED` - el usuario recibió una solicitud de amistad
- `FRIEND_REQUEST_ACCEPTED` - el destinatario aceptó la solicitud enviada por el usuario
- `FRIEND_REQUEST_DECLINED` - el destinatario rechazó la solicitud enviada por el usuario
- `FRIEND_REQUEST_CANCELLED` - el remitente canceló la solicitud pendiente
- `FRIENDSHIP_REMOVED` - alguno de los dos jugadores elimino la amistad (ambos lo reciben)
- `RESOURCE_INVITATION_RECEIVED` - el usuario recibió una invitación social a match/liga/copa
- `RESOURCE_INVITATION_ACCEPTED` - el destinatario aceptó una invitación enviada por el usuario
- `RESOURCE_INVITATION_CANCELLED` - el remitente cancela una invitacion pendiente y la recibe el
  destinatario
- `RESOURCE_INVITATION_DECLINED` - el destinatario rechazó una invitación enviada por el usuario
- `RESOURCE_INVITATION_EXPIRED` - una invitación pendiente expiró por tiempo o por recurso no
  joinable
- `FRIEND_AVAILABILITY_STATE` - snapshot completo de disponibilidad de amigos aceptados enviado al
  suscribirse a `/user/queue/social`
- `FRIEND_AVAILABILITY_CHANGED` - delta de un amigo cuando cambia disponibilidad, online o
  `spectatableMatch`

### Payloads por evento (social)

- `FRIEND_REQUEST_RECEIVED`: `{ requesterUsername, addresseeUsername }` - `status` omitido (siempre
  PENDING por tipo de evento)
- `FRIEND_REQUEST_ACCEPTED`: `{ requesterUsername, addresseeUsername }` - `status` omitido (siempre
  ACCEPTED por tipo de evento)
- `FRIEND_REQUEST_DECLINED`: `{ requesterUsername, addresseeUsername }` - se envía al **requester**
  cuando el addressee rechaza la solicitud
- `FRIEND_REQUEST_CANCELLED`: `{ requesterUsername, addresseeUsername }` - se envía al **addressee**
  cuando el requester cancela la solicitud pendiente
- `FRIENDSHIP_REMOVED`: `{ requesterUsername, addresseeUsername, removedByUsername }`
- `RESOURCE_INVITATION_RECEIVED`:
  `{ invitationId, senderUsername, targetType, targetId, expiresAt }`
- `RESOURCE_INVITATION_ACCEPTED`: `{ invitationId, recipientUsername, targetType, targetId }`
- `RESOURCE_INVITATION_CANCELLED`: `{ invitationId, senderUsername, targetType, targetId }`
- `RESOURCE_INVITATION_DECLINED`: `{ invitationId, recipientUsername, targetType, targetId }`
- `RESOURCE_INVITATION_EXPIRED`:
  `{ invitationId, senderUsername, recipientUsername, targetType, targetId }`
- `FRIEND_AVAILABILITY_STATE`: `{ friends: [...] }` - ver ejemplo arriba
- `FRIEND_AVAILABILITY_CHANGED`:
  `{ friendUsername, online, availability, busyReason, spectatableMatch }`
