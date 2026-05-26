# Truco API - Contratos para Frontend

Este documento resume todos los contratos que expone el backend para el equipo de FE:

- REST HTTP (request/response)
- Autenticacion (JWT)
- WebSocket/STOMP (eventos en tiempo real)
- Estados, enums y formato de errores

Base URL (local):

- `http://localhost:8080`

## 1. Autenticacion y reglas generales

### 1.1 Tokens

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

### 1.2 Endpoints protegidos

Segun configuracion de seguridad:

- Publicos:
    - `POST /api/auth/register`
    - `POST /api/auth/login`
    - `POST /api/auth/guest`
    - `POST /api/auth/refresh`
    - `DELETE /api/auth/logout`
- Requieren Bearer token:
    - Todo `/api/**` no listado arriba (matches, leagues, etc.)

### 1.3 Regla de autorizacion en recursos de juego

En endpoints protegidos alcanza con un Bearer token valido.

La pertenencia al recurso y las reglas de acceso se validan dentro de los casos de uso:

- un jugador solo puede operar sobre partidas en las que participa
- un espectador solo puede consultar una partida si ya quedo registrado como espectador de esa
  partida
- spectate solo esta permitido para miembros de la misma liga o copa del match, nunca para uno de
  los dos jugadores activos

### 1.4 IDs

Aunque algunos ejemplos de anotaciones muestran `match-123`, en runtime se parsea UUID.
Enviar siempre UUID valido en:

- `matchId`
- `leagueId`
- `playerId` en auth, claims y referencias tecnicas donde aplique

En respuestas REST de lectura y payloads WebSocket orientados a UI, los actores visibles se
devuelven con identificadores publicos orientados a presentacion (`username` o `displayName`,
segun el contrato) en lugar de `playerId`.

### 1.5 Salas publicas y privadas

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

## 2. Contrato de errores

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

## 3. API REST - Auth

### 3.1 Registrar usuario

`POST /api/auth/register`

Request:

```json
{
  "username": "juancho",
  "password": "Clave1!"
}
```

Reglas:

- `username` solo puede contener letras ASCII (`A-Z`, `a-z`) y numeros (`0-9`)
- `username` debe contener al menos 3 letras
- `password` debe tener al menos 5 caracteres, al menos 1 numero y al menos 1 simbolo

Response `200`:

```json
{
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 2592000
}
```

Errores:

- `400` si el body es invalido o no cumple las reglas de validacion del request
- `422` si el username ya esta en uso

### 3.2 Login

`POST /api/auth/login`

Request:

```json
{
  "username": "juancho",
  "password": "Clave1!"
}
```

Response `200`:

```json
{
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 2592000
}
```

Errores:

- `401` si las credenciales son invalidas (username no existe o contraseÃƒÂ±a incorrecta)

- `400` si el body es invalido o no cumple las reglas de validacion del request

### 3.3 Acceso como invitado

`POST /api/auth/guest`

Request: sin body.

Response `200`:

```json
{
  "playerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 604800
}
```

No persiste cuenta. El `playerId` es efimero.

### 3.4 Refresh de sesion

`POST /api/auth/refresh`

Request:

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

Response `200`:

```json
{
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "accessToken": "<jwt>",
  "refreshToken": "<new-opaque-refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 2592000
}
```

Reglas:

- siempre rota el refresh token
- el refresh token anterior deja de ser valido inmediatamente
- si se reusa un refresh token rotado o revocado, la cadena de esa sesion queda revocada
- no afecta otras sesiones activas del mismo usuario

Errores:

- `401` si el refresh token es invalido, expirado, revocado o rotado

### 3.5 Logout de sesion

`DELETE /api/auth/logout`

Request:

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

Response `204` sin body.

Reglas:

- revoca solo la sesion asociada al refresh token enviado
- si el refresh token no existe, responde `204` igual

## 4. API REST - Matches

### 4.1 Crear partida

`POST /api/matches`

Request:

```json
{
  "gamesToPlay": 3,
  "visibility": "PRIVATE"
}
```

Reglas para `gamesToPlay`:

- Valores permitidos: `1`, `3`, `5`
- `gamesToWin` interno se calcula como `gamesToPlay / 2 + 1`

Response `200`:

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "joinCode": "ABC123",
  "visibility": "PRIVATE"
}
```

Si `visibility` es `PUBLIC`, la respuesta es:

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "joinCode": "PUB12345",
  "visibility": "PUBLIC"
}
```

### 4.2 Unirse a partida

`POST /api/join/{joinCode}`

Response `200`:

```json
{
  "targetType": "MATCH",
  "targetId": "8b9c5936-9a1f-45ec-a587-24306689f6f7"
}
```

Reglas:

- aplica tanto a matches `PUBLIC` como `PRIVATE`
- en `PUBLIC`, el segundo jugador entra, queda ready implícito y el match pasa a `IN_PROGRESS`
- en `PRIVATE`, el segundo jugador entra y el match queda en `READY`

### 4.3 Listar partidas publicas

`GET /api/matches/public`

Auth: Bearer requerido.

Semantica: devuelve una pagina cursor-based de matches publicos abiertos en lobby.

Query params:

- `limit` opcional, default `20`, maximo `100`
- `after` opcional, cursor opaco para pedir la siguiente pagina

Response `200`:

```json
{
  "items": [
    {
      "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
      "host": "juancho",
      "gamesToPlay": 3,
      "totalSlots": 2,
      "occupiedSlots": 1,
      "status": "WAITING_FOR_PLAYERS",
      "_links": {
        "join": {
          "href": "/api/join/ABC12345"
        }
      }
    }
  ],
  "_links": {
    "self": {
      "href": "/api/matches/public?limit=20"
    },
    "next": {
      "href": "/api/matches/public?limit=20&after=eyJjdXJzb3IiOiJvcGFxdWUifQ"
    }
  }
}
```

Response `400`:

- `limit < 1`
- `limit > 100`
- `after` invalido o mal formado

### 4.4 Join desde lobby publico

Auth: Bearer requerido.

El FE debe usar el `href` provisto en `_links.join` y ejecutar `POST /api/join/{joinCode}`.

### 4.5 Iniciar partida

`POST /api/matches/{matchId}/start`

Auth: Bearer requerido.

Response `204` sin body.

### 4.6 Jugar carta

`POST /api/matches/{matchId}/play-card`

Auth: Bearer requerido.

Request:

```json
{
  "suit": "ESPADA",
  "number": 1
}
```

Response `204` sin body.

Errores:

- `400` si `suit` no coincide exactamente con `ESPADA`, `BASTO`, `COPA` u `ORO`

### 4.7 Cantar truco

`POST /api/matches/{matchId}/truco`

Auth: Bearer requerido.

Request body: sin body.

Response `204` sin body.

### 4.8 Responder truco

`POST /api/matches/{matchId}/truco/respond`

Auth: Bearer requerido.

Request:

```json
{
  "response": "QUIERO"
}
```

Response `204` sin body.

Errores:

- `400` si `response` no coincide exactamente con `QUIERO`, `NO_QUIERO` o
  `QUIERO_Y_ME_VOY_AL_MAZO`

### 4.9 Cantar envido

`POST /api/matches/{matchId}/envido`

Auth: Bearer requerido.

Request:

```json
{
  "call": "ENVIDO"
}
```

Response `204` sin body.

Errores:

- `400` si `call` no coincide exactamente con `ENVIDO`, `REAL_ENVIDO` o `FALTA_ENVIDO`

### 4.10 Responder envido

`POST /api/matches/{matchId}/envido/respond`

Auth: Bearer requerido.

Request:

```json
{
  "response": "NO_QUIERO"
}
```

Response `204` sin body.

Errores:

- `400` si `response` no coincide exactamente con `QUIERO` o `NO_QUIERO`

### 4.11 Irse al mazo

`POST /api/matches/{matchId}/fold`

Auth: Bearer requerido.

Request body: sin body.

Response `204` sin body.

### 4.12 Abandonar partida

`POST /api/matches/{matchId}/abandon`

Auth: Bearer requerido.

Request body: sin body.

Response `204` sin body.

El jugador autenticado abandona voluntariamente la partida en curso. El oponente gana
automáticamente.

Errores:

- `422` si el jugador no pertenece a la partida o la partida no está en estado `IN_PROGRESS`

Nota: el abandono voluntario sincroniza automáticamente el resultado a la liga si la partida
pertenece a una (igual que el timeout automático y el fin normal de partida).

### 4.13 Salir de partida

`POST /api/matches/{matchId}/leave`

Auth: Bearer requerido.

Request body: sin body.

Response `204` sin body.

El jugador autenticado se retira de la partida antes de que comience.

- Si es el **creador** (playerOne): la partida queda `CANCELLED` y se notifica `MATCH_CANCELLED`.
- Si es el **segundo jugador** (playerTwo): vuelve a `WAITING_FOR_PLAYERS` y se notifica
  `MATCH_PLAYER_LEFT`.

Errores:

- `422` si el jugador no pertenece a la partida
- `422` si la partida no está en estado `WAITING_FOR_PLAYERS` o `READY`
- `422` si la partida pertenece a una copa o liga (usar `/cups/{id}/leave` o `/leagues/{id}/leave`)

### 4.14 Obtener estado de partida

`GET /api/matches/{matchId}`

Auth: Bearer requerido.

Response `200`:

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "status": "IN_PROGRESS",
  "viewerSeat": "PLAYER_ONE",
  "playerOneUsername": "juancho",
  "playerTwoUsername": "martina",
  "gamesToPlay": 3,
  "scorePlayerOne": 2,
  "scorePlayerTwo": 1,
  "gamesWonPlayerOne": 1,
  "gamesWonPlayerTwo": 0,
  "matchWinner": null,
  "stateVersion": 5,
  "roundGame": {
    "status": "IN_PROGRESS",
    "currentTurn": "juancho",
    "myCards": [
      {
        "suit": "ESPADA",
        "number": 1
      },
      {
        "suit": "BASTO",
        "number": 7
      }
    ],
    "roundStatus": "PLAYING",
    "currentTrucoCall": null,
    "winner": null,
    "availableActions": [
      {
        "type": "PLAY_CARD"
      },
      {
        "type": "CALL_TRUCO"
      }
    ],
    "playedHands": [
      {
        "cardPlayerOne": {
          "suit": "ORO",
          "number": 3
        },
        "cardPlayerTwo": {
          "suit": "COPA",
          "number": 5
        },
        "winner": "juancho"
      }
    ],
    "currentHand": {
      "cardPlayerOne": null,
      "cardPlayerTwo": null,
      "mano": "juancho"
    }
  }
}
```

- `viewerSeat` indica el asiento del jugador autenticado (`PLAYER_ONE` o `PLAYER_TWO`); `null` si
  el caller no pertenece al match (no debería suceder en este endpoint, que valida pertenencia)
- `playerOneUsername` y `playerTwoUsername` son los usernames (o displayName para guests) de cada
  asiento; `playerTwoUsername` puede ser `null` mientras la partida esté en `WAITING_FOR_PLAYERS`
- `gamesToPlay` es el formato de la serie (mejor de N): `1`, `3` o `5`
- `scorePlayerOne` y `scorePlayerTwo` representan el puntaje del game actual y viven a nivel
  `match`
- `roundGame` es `null` si la partida no está `IN_PROGRESS`
- `myCards` contiene solo las cartas del jugador autenticado
- `availableActions` refleja las acciones disponibles para el jugador autenticado

Errores:

- `404` si la partida no existe
- `422` si el jugador no pertenece a la partida

### 4.15 Obtener estado de partida como espectador

`GET /api/matches/{matchId}/spectate`

Auth: Bearer requerido.

Request body: sin body.

Response `200`:

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "status": "IN_PROGRESS",
  "scorePlayerOne": 2,
  "scorePlayerTwo": 1,
  "gamesWonPlayerOne": 1,
  "gamesWonPlayerTwo": 0,
  "matchWinner": null,
  "stateVersion": 5,
  "currentRound": {
    "status": "IN_PROGRESS",
    "currentTurn": "juancho",
    "roundStatus": "PLAYING",
    "currentTrucoCall": "TRUCO",
    "winner": null,
    "playedHands": [
      {
        "cardPlayerOne": {
          "suit": "ORO",
          "number": 3
        },
        "cardPlayerTwo": {
          "suit": "COPA",
          "number": 5
        },
        "winner": "juancho"
      }
    ],
    "currentHand": {
      "cardPlayerOne": null,
      "cardPlayerTwo": null,
      "mano": "martina"
    }
  },
  "spectatorCount": 3
}
```

Reglas:

- devuelve una vista publica del match: no incluye `myCards` ni `availableActions`
- `scorePlayerOne` y `scorePlayerTwo` representan el puntaje del game actual y viven a nivel
  `match`
- solo funciona si el jugador ya esta registrado como espectador de ese match
- hoy ese registro se produce al suscribirse por STOMP a `/user/queue/match-spectate` enviando el
  header nativo `matchId`

Errores:

- `404` si la partida no existe
- `422` si el jugador no esta registrado como espectador de esa partida

### 4.16 Flujo de spectate

El flujo actual de spectate es WebSocket-first:

1. Conectar STOMP con `Authorization: Bearer <jwt>`.
2. Suscribirse a `/user/queue/match-spectate`.
3. En esa `SUBSCRIBE`, enviar header nativo `matchId: <uuid-del-match>`.
4. Si el alta es valida, el backend registra el espectador y envia `SPECTATE_STATE`.
5. Desde ese momento, `GET /api/matches/{matchId}/spectate` devuelve el snapshot REST del mismo
   estado de espectador.

Restricciones de negocio:

- el match debe estar `IN_PROGRESS`
- el espectador debe pertenecer a la misma liga o copa del match
- un jugador no puede spectear su propio match
- un jugador no puede spectear dos matches al mismo tiempo
- al terminar el match, o si el espectador pasa a ser jugador activo en una liga/copa, el backend
  lo desregistra automaticamente

### 4.17 Revancha (Rematch)

Solo aplica a matches **casuales** (no pertenecientes a liga ni copa).
Al terminar un match casual, el backend abre automaticamente una sesion de revancha.

#### 4.17.1 Aceptar revancha

`POST /api/matches/{matchId}/rematch/choose`

El jugador autenticado acepta la revancha. El `matchId` es el de la partida **original** (
terminada).

Response `204`: sin body.

Errores:

- `401` sin token
- `404` si no existe sesion de revancha para ese `matchId`
- `422` en cualquiera de los siguientes casos: sesion no esta en estado `OPEN`, sesion expirada,
  jugador no es participante de la sesion

#### 4.17.2 Abandonar revancha

`POST /api/matches/{matchId}/rematch/leave`

El jugador autenticado abandona la sesion. El bot no puede ser actor de esta accion.

Response `204`: sin body.

Errores:

- `401` sin token
- `404` si no existe sesion de revancha para ese `matchId`
- `422` si la sesion no esta `OPEN`, el jugador no es participante, el bot intenta abandonar

#### 4.17.3 Consultar sesion de revancha

`GET /api/matches/{matchId}/rematch`

Response `200`:

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "originMatchId": "550e8400-e29b-41d4-a716-446655440001",
  "status": "OPEN",
  "playerOneChoice": "UNDECIDED",
  "playerTwoChoice": "WANTS_REMATCH",
  "expiresAt": "2026-05-16T18:00:00Z",
  "resultMatchId": null
}
```

- `expiresAt` es un `Instant` ISO-8601 (distinto de los payloads WS donde se envia `epochMillis`)
- `resultMatchId` es el UUID de la nueva partida; solo no-null cuando `status == CONFIRMED`
- Solo los participantes de la sesion pueden consultar su estado

Errores:

- `401` sin token
- `404` si no existe sesion de revancha para ese `matchId`
- `422` si el jugador no es participante de la sesion

## 5. API REST - Leagues

### 5.1 Crear liga

`POST /api/leagues`

Request:

```json
{
  "numberOfPlayers": 4,
  "gamesToPlay": 3,
  "visibility": "PRIVATE"
}
```

Reglas para `numberOfPlayers`:

- Valores permitidos: entre `3` y `8`
- El `playerId` del creador se genera internamente (igual que en matches)

Reglas para `gamesToPlay`:

- Valores permitidos: `1`, `3`, `5`
- Define la cantidad de partidas por fixture del liga
- `gamesToWin` interno se calcula como `gamesToPlay / 2 + 1`

Response `200`:

```json
{
  "leagueId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "joinCode": "ABCD1234",
  "visibility": "PRIVATE"
}
```

Si `visibility` es `PUBLIC`, la respuesta es:

```json
{
  "leagueId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "joinCode": "PUBL1234",
  "visibility": "PUBLIC"
}
```

### 5.2 Unirse a liga

`POST /api/join/{joinCode}`

Response `200`:

```json
{
  "targetType": "LEAGUE",
  "targetId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

Reglas:

- aplica tanto a ligas `PUBLIC` como `PRIVATE`
- en `PUBLIC`, al completar el cupo la liga pasa a `IN_PROGRESS` y crea/activa fixtures y matches
- en `PRIVATE`, al completar el cupo queda en `WAITING_FOR_START`

### 5.3 Listar ligas publicas

`GET /api/leagues/public`

Auth: Bearer requerido.

Semantica: devuelve una pagina cursor-based de ligas publicas abiertas en lobby.

Query params:

- `limit` opcional, default `20`, maximo `100`
- `after` opcional, cursor opaco para pedir la siguiente pagina

Response `200`:

```json
{
  "items": [
    {
      "leagueId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "host": "juancho",
      "gamesToPlay": 3,
      "totalSlots": 4,
      "occupiedSlots": 2,
      "status": "WAITING_FOR_PLAYERS",
      "_links": {
        "join": {
          "href": "/api/join/ABCD1234"
        }
      }
    }
  ],
  "_links": {
    "self": {
      "href": "/api/leagues/public?limit=20"
    },
    "next": {
      "href": "/api/leagues/public?limit=20&after=eyJjdXJzb3IiOiJvcGFxdWUifQ"
    }
  }
}
```

### 5.4 Join desde lobby publico

Auth: Bearer requerido.

El FE debe usar el `href` provisto en `_links.join` y ejecutar `POST /api/join/{joinCode}`.

### 5.5 Salir de liga

`POST /api/leagues/{leagueId}/leave`

Auth: Bearer requerido (token del liga).

Response `204` sin body.

### 5.6 Iniciar liga

`POST /api/leagues/{leagueId}/start`

Auth: Bearer requerido (solo el creador).

Response `204` sin body.

### 5.7 Obtener estado de liga

`GET /api/leagues/{leagueId}`

Response `200`: estado completo, tabla y fixtures del liga.

## 6. API REST - Copas

Copa por eliminación directa (single elimination bracket).

### 6.1 Crear copa

`POST /api/cups`

Auth: Bearer requerido.

Request:

```json
{
  "numberOfPlayers": 4,
  "gamesToPlay": 3,
  "visibility": "PRIVATE"
}
```

Reglas para `numberOfPlayers`:

- Valores permitidos: entre `4` y `8`
- El creador se une automáticamente

Reglas para `gamesToPlay`:

- Valores permitidos: `1`, `3`, `5`
- Define la cantidad de partidas por cruce (bout)

Response `200`:

```json
{
  "cupId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "joinCode": "ABCD1234",
  "visibility": "PRIVATE"
}
```

Si `visibility` es `PUBLIC`, la respuesta es:

```json
{
  "cupId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "joinCode": "CUP12345",
  "visibility": "PUBLIC"
}
```

### 6.2 Unirse a copa

`POST /api/join/{joinCode}`

Auth: Bearer requerido.

Response `200`:

```json
{
  "targetType": "CUP",
  "targetId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

Errores:

- `404` si no existe un recurso con ese `joinCode`
- `422` si la copa no está en estado `WAITING_FOR_PLAYERS`, ya está llena o el jugador ya está en
  ella

Reglas:

- aplica tanto a copas `PUBLIC` como `PRIVATE`
- en `PUBLIC`, al completar el cupo la copa pasa a `IN_PROGRESS` y crea/activa bouts y matches
- en `PRIVATE`, al completar el cupo queda en `WAITING_FOR_START`

### 6.3 Listar copas publicas

`GET /api/cups/public`

Auth: Bearer requerido.

Semantica: devuelve una pagina cursor-based de copas publicas abiertas en lobby.

Query params:

- `limit` opcional, default `20`, maximo `100`
- `after` opcional, cursor opaco para pedir la siguiente pagina

Response `200`:

```json
{
  "items": [
    {
      "cupId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "host": "juancho",
      "gamesToPlay": 3,
      "totalSlots": 8,
      "occupiedSlots": 5,
      "status": "WAITING_FOR_PLAYERS",
      "_links": {
        "join": {
          "href": "/api/join/CUP12345"
        }
      }
    }
  ],
  "_links": {
    "self": {
      "href": "/api/cups/public?limit=20"
    },
    "next": {
      "href": "/api/cups/public?limit=20&after=eyJjdXJzb3IiOiJvcGFxdWUifQ"
    }
  }
}
```

### 6.4 Unirse a copa publica

Auth: Bearer requerido.

El FE debe usar el `href` provisto en `_links.join` y ejecutar `POST /api/join/{joinCode}`.

### 6.5 Salir de copa

`POST /api/cups/{cupId}/leave`

Auth: Bearer requerido.

Response `204` sin body.

Errores:

- `422` si la copa ya inició, o si el jugador es el creador (el creador no puede salir)

### 6.6 Iniciar copa

`POST /api/cups/{cupId}/start`

Auth: Bearer requerido (solo el creador).

Response `204` sin body.

Al iniciar:

- Se genera el bracket aleatoriamente
- Se crean automáticamente los matches de la primera ronda (bouts `PENDING`)
- Si hay byes (n de jugadores no es potencia de 2), los jugadores con bye avanzan solos a la
  siguiente ronda

Errores:

- `422` si no es el creador, o la copa no tiene todos los jugadores (`WAITING_FOR_PLAYERS`)

### 6.7 Obtener estado de copa

`GET /api/cups/{cupId}`

Auth: Bearer requerido (solo participantes).

Response `200`:

```json
{
  "cupId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "IN_PROGRESS",
  "rounds": [
    {
      "roundNumber": 1,
      "roundName": "Semifinal",
      "bouts": [
        {
          "boutId": "b1c2d3e4-...",
          "roundNumber": 1,
          "bracketPosition": 0,
          "playerOne": "juancho",
          "playerTwo": "martina",
          "matchId": "uuid-match",
          "winner": null,
          "status": "PENDING"
        }
      ]
    },
    {
      "roundNumber": 2,
      "roundName": "Final",
      "bouts": [
        {
          "boutId": "c2d3e4f5-...",
          "roundNumber": 2,
          "bracketPosition": 0,
          "playerOne": null,
          "playerTwo": null,
          "matchId": null,
          "winner": null,
          "status": "AWAITING"
        }
      ]
    }
  ],
  "champion": null
}
```

Cuando la copa finaliza, `status` es `FINISHED` y `champion` contiene el `displayName` del
campeón.

Errores:

- `404` si la copa no existe
- `422` si el jugador no pertenece a la copa

### 6.8 Estados de la copa (`status`)

| Estado                | Descripción                                                     |
|-----------------------|-----------------------------------------------------------------|
| `WAITING_FOR_PLAYERS` | Creada, esperando que se unan los jugadores                     |
| `WAITING_FOR_START`   | Todos los jugadores se unieron, esperando que el creador inicie |
| `IN_PROGRESS`         | Bracket generado y partidas en curso                            |
| `FINISHED`            | Copa finalizada, hay campeón                                    |

### 6.9 Estados de un bout (`BoutStatus`)

| Estado     | Descripción                                                          |
|------------|----------------------------------------------------------------------|
| `AWAITING` | Ronda futura, aún sin jugadores asignados                            |
| `PENDING`  | Ambos jugadores asignados, match creado y en curso                   |
| `FINISHED` | Match terminado, hay ganador                                         |
| `BYE`      | Jugador sin rival (bye), avanza automáticamente a la siguiente ronda |

### 6.10 Nombres de ronda (`roundName`)

El campo `roundName` es informativo según la distancia a la final:

| Rondas desde la final | `roundName`        |
|-----------------------|--------------------|
| 0                     | `Final`            |
| 1                     | `Semifinal`        |
| 2                     | `Cuartos de final` |
| 3+                    | `Ronda N`          |

### 6.11 Flujo de avance automático

El bracket avanza automáticamente via eventos internos:

1. Cuando un match de copa termina -> el ganador avanza al siguiente bout
2. Cuando un jugador abandona un match de copa -> se registra como forfeit; el rival avanza
   automáticamente
3. Si el rival ya había forfeiteado -> el bout se resuelve sin crear match (cascade forfeit)
4. Al llegar a la final y resolverse -> la copa pasa a `FINISHED` con el `champion`

El FE no necesita llamar ningún endpoint adicional para el avance: solo suscribirse a los eventos
WebSocket del match activo y consultar `GET /api/cups/{cupId}` para ver el estado actualizado del
bracket.

## 7. API REST - Chat

Ademas del chat de `MATCH`, `LEAGUE` y `CUP`, existe `FRIENDSHIP` como DM efimero entre amigos
aceptados. Ese chat vive solo en memoria: si la app reinicia, el historial se pierde y se recrea
vacio al volver a abrirlo.

Chat en tiempo real asociado a un match, liga o copa. Se crea automáticamente al iniciar el recurso
padre y se elimina al finalizar o cancelarse.

- **Match**: chat creado en `GameStartedEvent` (primer game), eliminado en `MatchFinishedEvent` o
  `MatchForfeitedEvent`
- **Liga**: chat creado en `LeagueStartedEvent`, eliminado en `LeagueFinishedEvent` o
  `LeagueCancelledEvent`
- **Copa**: chat creado en `CupStartedEvent`, eliminado en `CupFinishedEvent` o
  `CupCancelledEvent`

Reglas de negocio:

- Máximo **50 mensajes** por chat (buffer circular: al llegar al límite se descarta el más antiguo)
- Máximo **500 caracteres** por mensaje
- **Rate limit**: 2 segundos mínimo entre mensajes del mismo jugador
- Solo **participantes** del recurso padre pueden enviar y leer mensajes

### 7.1 Enviar mensaje

`POST /api/chats/{chatId}/messages`

Auth: Bearer requerido.

Request:

```json
{
  "content": "Buena mano!"
}
```

Response `204` sin body.

Errores:

- `404` si el chat no existe
- `422` si el jugador no pertenece al chat, el mensaje está vacío, excede 500 caracteres, o
  viola el rate limit (2 segundos)

### 7.2 Obtener mensajes por chatId

`GET /api/chats/{chatId}/messages`

Auth: Bearer requerido.

Response `200`:

```json
{
  "chatId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "parentType": "MATCH",
  "parentId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "messages": [
    {
      "messageId": "d4e5f6a7-b8c9-0123-4567-89abcdef0123",
      "sender": "juancho",
      "content": "Buena mano!",
      "sentAt": 1772768158123
    }
  ]
}
```

Errores:

- `404` si el chat no existe
- `422` si el jugador no pertenece al chat

### 7.3 Buscar chat por recurso padre

`GET /api/chats/by-parent/{parentType}/{parentId}`

Auth: Bearer requerido.

Path params:

- `parentType`: `MATCH`, `LEAGUE`, `CUP` o `FRIENDSHIP`
- `parentId`: UUID del match, liga, copa o amistad

Response `200`: misma estructura que 7.2.

Errores:

- `400` si `parentType` no coincide exactamente con `MATCH`, `LEAGUE`, `CUP` o `FRIENDSHIP`
- `404` si no existe chat para ese recurso
- `422` si el jugador no pertenece al chat

Regla especial para `FRIENDSHIP`:

- si la amistad existe, esta `ACCEPTED` y el jugador autenticado participa, el backend crea el chat
  lazily la primera vez que se consulta (no persiste entre reinicios)

### 7.4 Enviar mensaje por recurso padre

`POST /api/chats/by-parent/{parentType}/{parentId}/messages`

Auth: Bearer requerido.

Path params:

- `parentType`: `MATCH`, `LEAGUE`, `CUP` o `FRIENDSHIP`
- `parentId`: UUID del match, liga, copa o amistad

Request:

```json
{
  "content": "Buena mano!"
}
```

Response `201`:

```json
{
  "chatId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

El `chatId` retornado permite al cliente navegar directamente al chat sin un GET extra. Para
`FRIENDSHIP`, el chat se crea lazily en el primer mensaje; para `MATCH`, `LEAGUE` y `CUP`, el chat
ya existe y se retorna su ID.

Errores:

- `404` si el chat no existe (para `MATCH`/`LEAGUE`/`CUP`) o la amistad no aceptada (para
  `FRIENDSHIP`)
- `422` si el jugador no pertenece al chat, el mensaje esta vacio, excede 500 caracteres, o viola
  el rate limit (2 segundos)

## 7.5 API REST - Social

La capa social agrega amistades e invitaciones rapidas entre usuarios registrados. Los guests
quedan fuera de estas capacidades.

En todo el contrato publico social, el identificador del otro usuario es siempre `username`.
`friendshipId` sigue existiendo solo a nivel interno de dominio y persistencia; no se expone por
REST ni por WebSocket.

### 7.4.1 Solicitar amistad

`POST /api/social/friendship-requests`

Request:

```json
{
  "username": "martina"
}
```

Response `204`: sin body.

### 7.4.2 Aceptar amistad

`POST /api/social/friendship-requests/{username}/accept`

Response `204`: sin body.

### 7.4.3 Rechazar amistad

`POST /api/social/friendship-requests/{username}/decline`

Response `204`: sin body.

### 7.4.4 Cancelar solicitud de amistad

`POST /api/social/friendship-requests/{username}/cancel`

Response `204`: sin body.

Solo puede llamarlo el requester (quien envió la solicitud). El addressee recibe una notificación
WebSocket `FRIEND_REQUEST_CANCELLED`.

### 7.4.4b Eliminar amigo

`DELETE /api/social/friendships/{username}`

Response `204`: sin body.

Cualquiera de los dos jugadores puede eliminar una amistad `ACCEPTED`. Ambos reciben una
notificacion WebSocket `FRIENDSHIP_REMOVED`. Una vez eliminada, es posible re-enviar una solicitud
de amistad al mismo usuario.

Errores:

- `404` si la amistad no existe
- `422` si la amistad no en estado `ACCEPTED`

### 7.4.5 Listar amigos

`GET /api/social/friendships`

Response `200`:

```json
[
  {
    "friendUsername": "martina"
  }
]
```

### 7.4.6 Listar solicitudes recibidas

`GET /api/social/friendship-requests/incoming`

Response `200`:

```json
[
  {
    "requesterUsername": "juancho"
  }
]
```

### 7.4.7 Crear invitacion social

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

### 7.4.7 Aceptar invitacion social

`POST /api/social/invitations/{id}/accept`

Response `204`: sin body.

Semantica:

- el backend hace `join` directo sobre el recurso destino
- si el recurso ya no admite join, la invitacion pasa a `EXPIRED` y responde error

### 7.4.8 Rechazar invitacion social

`POST /api/social/invitations/{id}/decline`

Response `204`: sin body.

### 7.4.9 Listar invitaciones recibidas

`GET /api/social/invitations/incoming`

Devuelve las invitaciones a recurso pendientes recibidas por el jugador autenticado.

Response `200`: arreglo de `IncomingResourceInvitationResponse`.

### 7.4.10 Listar solicitudes de amistad enviadas

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

### 7.4.11 Listar invitaciones enviadas

`GET /api/social/invitations/outgoing`

Devuelve las invitaciones a recurso pendientes enviadas por el jugador autenticado.

Response `200`: arreglo de `OutgoingResourceInvitationResponse`.

### 7.4.12 Cancelar invitacion enviada

`POST /api/social/invitations/{id}/cancel`

Cancela una invitacion pendiente enviada por el jugador autenticado.

- `204` si se cancela correctamente
- `401` si el token es invalido o esta ausente
- `404` si la invitacion no existe
- `422` si no se puede cancelar (ya fue aceptada, rechazada o expirada)

### 7.4.13 Expiracion configurable de invitaciones

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

## 7.5 Perfil de jugador

### 7.5.1 Obtener perfil de jugador

`GET /api/profile/{username}` — requiere Bearer token.

Devuelve el username, logros desbloqueados y estadísticas agregadas del jugador indicado. Mismo
payload para el propio perfil o para el de otro jugador.

**Path params:**

| Campo      | Tipo     | Descripcion                                                                |
|------------|----------|----------------------------------------------------------------------------|
| `username` | `String` | Username del jugador (ASCII alfanumérico, mínimo 3 letras, case-sensitive) |

**Respuesta 200:**

```json
{
  "achievements": [
    {
      "achievementCode": "WIN_RETRUCO_FROM_0_0_TO_3",
      "unlockedAt": 1772768158123,
      "matchId": "550e8400-e29b-41d4-a716-446655440001",
      "gameNumber": 1
    }
  ],
  "stats": {
    "matchesPlayed": 42,
    "matchesWon": 24,
    "matchesLost": 18,
    "winRate": 57
  }
}
```

**Errores:**

| Codigo | Descripcion                                       |
|--------|---------------------------------------------------|
| 401    | Token ausente o inválido                          |
| 404    | `username` no corresponde a un usuario registrado |

**Notas:**

- Los guests no tienen perfil (devuelve 404 si se consulta uno).
- La búsqueda es case-sensitive: `Juancho` y `juancho` son usernames distintos.
- Las stats son eventual-consistent: se actualizan después de que el evento
  `MATCH_FINISHED`, `MATCH_ABANDONED` o `MATCH_FORFEITED` es procesado por el backend.
- Solo se computan partidas PvP humanas (bots excluidos).
- El abandono cuenta como derrota para el abandoner y victoria para el rival.

## 8. Enums y valores permitidos

Estos valores son case-sensitive y deben enviarse exactamente igual, en mayusculas y con guiones
bajos cuando aplique. Si el valor no coincide, la API responde `400` con
`InvalidEnumValueException`.

### 8.1 Requests

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

### 8.2 Estados en respuestas

- `MatchStateResponse.status`:
    - `WAITING_FOR_PLAYERS`, `IN_PROGRESS`, `FINISHED`
- `RoundStateResponse.roundStatus`:
    - `PLAYING`, `ENVIDO_IN_PROGRESS`, `TRUCO_IN_PROGRESS`, `FINISHED`
- `RoundStateResponse.currentTrucoCall`:
    - `TRUCO`, `RETRUCO`, `VALE_CUATRO` (o `null`)
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

## 9. WebSocket / STOMP

### 9.1 Endpoints de conexion

- WebSocket nativo: `/ws`
- SockJS: `/ws-sockjs`

Broker/prefijos:

- `setApplicationDestinationPrefixes`: `/app`
- `setUserDestinationPrefix`: `/user`
- Broker habilitado en: `/topic`, `/queue`

Nota: no hay `@MessageMapping` para mensajes cliente->server.

### 9.2 Autenticacion WS

En frame STOMP `CONNECT` enviar header:

- `Authorization: Bearer <jwt>`

El token debe contener `sub` (playerId).

### 9.3 Suscripciones permitidas

Suscripciones permitidas por interceptor:

- `/user/queue/match` - eventos de match
- `/user/queue/match-derived` - notificaciones derivadas de match (acciones disponibles, cartas)
- `/user/queue/match-spectate` - alta y eventos de espectador
- `/user/queue/league` - eventos de liga
- `/user/queue/cup` - eventos de copa
- `/user/queue/chat` - eventos de chat en tiempo real
- `/user/queue/social` - eventos de amistades e invitaciones
- `/user/queue/profile` - eventos de logros del perfil

- `/topic/public-match-lobby` - stream compartido del lobby publico de matches
- `/topic/public-cup-lobby` - stream compartido del lobby publico de copas
- `/topic/public-league-lobby` - stream compartido del lobby publico de ligas

Cualquier otro destino se rechaza

Para `/user/queue/match-spectate`, ademas del destino hay que enviar en la `SUBSCRIBE`:

- header nativo `matchId: <uuid>`

### 9.4 Forma del evento WS

Cada tipo de recurso tiene su propia estructura de evento:

**Match** (`/user/queue/match`):

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "eventType": "CARD_PLAYED",
  "timestamp": 1772768158123,
  "payload": {
    "seat": "PLAYER_ONE",
    "card": {
      "suit": "ESPADA",
      "number": 1
    }
  },
  "stateVersion": 5
}
```

- `stateVersion` es un contador monotónicamente creciente por match que se incrementa exactamente en
  uno por cada evento transicional. El cliente lo usa como cursor para reconciliar snapshot +
  stream:
  descarta eventos con `stateVersion <= snapshot.stateVersion`, detecta huecos cuando recibe
  `stateVersion > ultimo + 1`, y trata duplicados (`stateVersion == ultimo`) como no-op.

**Match derivado** (`/user/queue/match-derived`):

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "eventType": "AVAILABLE_ACTIONS_UPDATED",
  "timestamp": 1772768158123,
  "payload": {
    "seat": "PLAYER_ONE",
    "availableActions": [
      {
        "type": "PLAY_CARD"
      }
    ]
  }
}
```

- Los eventos derivados **no** llevan `stateVersion` y no deben usarse para detectar huecos en la
  secuencia transicional.

**Liga** (`/user/queue/league`):

```json
{
  "leagueId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "LEAGUE_STARTED",
  "timestamp": 1772768158123,
  "payload": {}
}
```

**Copa** (`/user/queue/cup`):

```json
{
  "cupId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "CUP_STARTED",
  "timestamp": 1772768158123,
  "payload": {}
}
```

**Chat** (`/user/queue/chat`):

```json
{
  "chatId": "d4e5f6a7-b8c9-0123-4567-89abcdef0123",
  "eventType": "MESSAGE_SENT",
  "timestamp": 1772768158123,
  "payload": {
    "sender": "juancho",
    "content": "Buena mano!",
    "sentAt": 1772768158123
  }
}
```

**Social** (`/user/queue/social`):

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

**Profile** (`/user/queue/profile`):

```json
{
  "eventType": "ACHIEVEMENT_UNLOCKED",
  "timestamp": 1772768158123,
  "payload": {
    "achievementCode": "WIN_RETRUCO_FROM_0_0_TO_3",
    "unlockedAt": 1772768158123,
    "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
    "gameNumber": 1
  }
}
```

**Spectate** (`/user/queue/match-spectate`):

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "eventType": "SPECTATE_STATE",
  "timestamp": 1772768158123,
  "payload": {
    "matchState": {
      "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
      "status": "IN_PROGRESS",
      "scorePlayerOne": 2,
      "scorePlayerTwo": 1,
      "gamesWonPlayerOne": 1,
      "gamesWonPlayerTwo": 0,
      "matchWinner": null,
      "currentRound": null,
      "spectatorCount": 3
    }
  }
}
```

**Public lobby** (`/topic/public-match-lobby`, `/topic/public-cup-lobby`,
`/topic/public-league-lobby`):

El cliente debe bootstrapear por REST y usar estos topics solo para reconciliar deltas.

```json
{
  "eventType": "PUBLIC_MATCH_LOBBY_UPSERT",
  "timestamp": 1772768158123,
  "payload": {
    "lobby": {
      "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
      "host": "juancho",
      "gamesToPlay": 3,
      "totalSlots": 2,
      "occupiedSlots": 1,
      "status": "WAITING_FOR_PLAYERS"
    }
  }
}
```

Nota: los IDs de recurso (`matchId`, `leagueId`, `cupId`, `chatId`) son campos top-level del
evento, no dentro del `payload`.
Excepcion: los eventos de lobby publico no llevan `matchId`/`leagueId`/`cupId` top-level; el id va
dentro de `payload.lobby` para `UPSERT` o en `payload.id` para `REMOVED`.

### 9.5 eventType posibles - Match (`/user/queue/match`, 2 jugadores del partido)

Eventos transicionales (consumen `stateVersion`):

- `CARD_PLAYED`
- `TURN_CHANGED`
- `TRUCO_CALLED`
- `TRUCO_RESPONDED`
- `ENVIDO_CALLED`
- `ENVIDO_RESOLVED`
- `SCORE_CHANGED`
- `ROUND_STARTED`
- `ROUND_ENDED`
- `GAME_STARTED`
- `GAME_SCORE_CHANGED`
- `MATCH_FINISHED`
- `MATCH_ABANDONED`
- `MATCH_CANCELLED`
- `MATCH_PLAYER_LEFT`
- `FOLDED`
- `MATCH_FORFEITED`
- `PLAYER_JOINED`
- `PLAYER_READY`
- `HAND_RESOLVED`
- `HAND_DEALT`
- `HAND_CHANGED`
- `SPECTATOR_COUNT_CHANGED`
- `REMATCH_AVAILABLE` - sesion de revancha abierta (se envia al terminar el match casual)
- `REMATCH_OPPONENT_WANTS` - el oponente eligio revancha
- `REMATCH_CONFIRMED` - ambos confirmaron; nueva partida lista
- `REMATCH_CLOSED_BY_LEAVE` - el oponente abandono la sesion
- `REMATCH_EXPIRED` - la sesion expiro por TTL

#### Notificaciones derivadas (`/user/queue/match-derived`, no avanzan `stateVersion`)

- `AVAILABLE_ACTIONS_UPDATED`
- `PLAYER_HAND_UPDATED`

Nota: los eventos `REMATCH_*` viajan por `/user/queue/match` con el `matchId` top-level igual al
`originMatchId` de la sesion (el match que termino, no el nuevo).

### 9.5b eventType posibles - Liga (`/user/queue/league`, todos los participantes de la liga)

- `LEAGUE_PLAYER_JOINED` - un jugador se unió a la liga
- `LEAGUE_PLAYER_LEFT` - un jugador no-creador abandonó la liga
- `LEAGUE_CANCELLED` - la liga fue cancelada (creador abandona o timeout)
- `LEAGUE_STARTED` - la liga inició y se generaron los fixtures
- `LEAGUE_FIXTURE_ACTIVATED` - un fixture cambió de estado a PENDING
- `LEAGUE_MATCH_ACTIVATED` - un partido de liga fue creado y está listo
- `LEAGUE_ADVANCED` - un resultado fue registrado en la liga
- `LEAGUE_PLAYER_FORFEITED` - un jugador ha sido declarado forfeit
- `LEAGUE_FINISHED` - la liga terminó

### 9.5c eventType posibles - Copa (`/user/queue/cup`, todos los participantes de la copa)

- `CUP_PLAYER_JOINED` - un jugador se unió a la copa
- `CUP_PLAYER_LEFT` - un jugador no-creador abandonó la copa
- `CUP_CANCELLED` - la copa fue cancelada
- `CUP_STARTED` - la copa inició y se generó el bracket
- `CUP_BOUT_ACTIVATED` - un bout del bracket pasó a estado PENDING
- `CUP_MATCH_ACTIVATED` - un partido de copa fue creado y está listo
- `CUP_ADVANCED` - un resultado fue registrado y el bracket avanzó
- `CUP_PLAYER_FORFEITED` - un jugador fue declarado forfeit
- `CUP_FINISHED` - la copa terminó con un campeón

### 9.5d eventType posibles - Chat (`/user/queue/chat`, participantes del chat)

- `CHAT_CREATED` - chat creado automáticamente al iniciar match/liga/copa
- `MESSAGE_SENT` - un participante envió un mensaje

### 9.5e eventType posibles - Social (`/user/queue/social`, usuarios registrados)

- `FRIEND_REQUEST_RECEIVED` - el usuario recibió una solicitud de amistad
- `FRIEND_REQUEST_ACCEPTED` - el destinatario aceptó la solicitud enviada por el usuario
- `RESOURCE_INVITATION_RECEIVED` - el usuario recibió una invitación social a match/liga/copa
- `RESOURCE_INVITATION_ACCEPTED` - el destinatario aceptó una invitación enviada por el usuario
- `RESOURCE_INVITATION_CANCELLED` - el remitente cancela una invitacion pendiente y la recibe el
  destinatario
- `FRIENDSHIP_REMOVED` - alguno de los dos jugadores elimino la amistad (ambos lo reciben)
- `RESOURCE_INVITATION_DECLINED` - el destinatario rechazó una invitación enviada por el usuario
- `RESOURCE_INVITATION_EXPIRED` - una invitación pendiente expiró por tiempo o por recurso no
  joinable

### 9.5f eventType posibles - Profile (`/user/queue/profile`, usuarios registrados)

- `ACHIEVEMENT_UNLOCKED` - logro desbloqueado para el usuario autenticado

Reglas:

- solo se evalúa en matches `human vs human`
- las partidas contra bots no generan tracking ni unlocks
- el abandono cuenta como derrota para el abandoner y victoria para el rival

### 9.5g eventType posibles - Spectate (

`/user/queue/match-spectate`, espectadores activos del match)

- `SPECTATE_STATE` - snapshot inicial enviado al completar la suscripcion
- `SPECTATE_ERROR` - error al intentar registrarse como espectador
- `SPECTATOR_COUNT_CHANGED` - cambia la cantidad de espectadores del match
- ademas se reenvian los eventos publicos del match que no estan atados a un asiento concreto

No se reenvian al espectador los eventos privados por asiento:

- `PLAYER_HAND_UPDATED`
- `AVAILABLE_ACTIONS_UPDATED`

### 9.5h eventType posibles - Lobby publico (`/topic/public-*`)

- `PUBLIC_MATCH_LOBBY_UPSERT` - snapshot o actualizacion de un match que sigue abierto en lobby
- `PUBLIC_MATCH_LOBBY_REMOVED` - remocion de un match que salio del lobby
- `PUBLIC_CUP_LOBBY_UPSERT` - snapshot o actualizacion de una copa que sigue abierta en lobby
- `PUBLIC_CUP_LOBBY_REMOVED` - remocion de una copa que salio del lobby
- `PUBLIC_LEAGUE_LOBBY_UPSERT` - snapshot o actualizacion de una liga que sigue abierta en lobby
- `PUBLIC_LEAGUE_LOBBY_REMOVED` - remocion de una liga que salio del lobby

### 9.6 Payload por evento (resumen)

- `CARD_PLAYED`:
    - `{ seat, card: { suit, number } }`
- `HAND_DEALT`:
    - `{ seat, cards: [ { suit, number }, ... ] }`
    - payload redactado por destinatario: cada jugador ve solo sus propias cartas
- `HAND_RESOLVED`:
    - `{ cardPlayerOne, cardPlayerTwo, winnerSeat }`
    - en el cierre anticipado puntual por `1 de espada`, la carta del rival puede llegar en `null`
- `TURN_CHANGED`:
    - `{ seat }`
- `TRUCO_CALLED`:
    - `{ callerSeat, call }`
- `TRUCO_RESPONDED`:
    - `{ responderSeat, response, call }`
- `ENVIDO_CALLED`:
    - `{ callerSeat, call }`
- `ENVIDO_RESOLVED`:
    - `{ response, winnerSeat, pointsMano?, pointsPie? }`
- `SCORE_CHANGED`:
    - `{ scorePlayerOne, scorePlayerTwo }`
- `ROUND_STARTED`:
    - `{ roundNumber, manoSeat }`
- `ROUND_ENDED`:
    - `{ winnerSeat }`
- `GAME_STARTED`:
    - `{ gameNumber }`
- `GAME_SCORE_CHANGED`:
    - `{ gamesWonPlayerOne, gamesWonPlayerTwo }`
- `MATCH_FINISHED`:
    - `{ winnerSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`
- `MATCH_ABANDONED`:
    - abandono voluntario del jugador; cierra solo el match actual
    - `{ winnerSeat, abandonerSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`
- `MATCH_CANCELLED`:
    - el creador salió antes de que la partida comenzara (via `/leave`), o la partida fue
      cancelada por timeout
    - `{}`
- `MATCH_PLAYER_LEFT`:
    - el segundo jugador salió antes de que la partida comenzara; vuelve a `WAITING_FOR_PLAYERS`
    - `{ leaverSeat }` - siempre `PLAYER_TWO`
- `FOLDED`:
    - `{ seat }`
- `MATCH_FORFEITED`:
    - forfeit administrativo por AFK/timeout; puede disparar forfeit de competición
    - `{ winnerSeat, loserSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`
- `PLAYER_HAND_UPDATED`:
    - `{ seat, cards: [{ suit, number }] }`
- `AVAILABLE_ACTIONS_UPDATED`:
    - `{ seat, availableActions: [{ type, parameter? }] }`
- `SPECTATOR_COUNT_CHANGED`:
    - `{ spectatorCount }`
- `PLAYER_READY`:
    - `{ seat }`
- `PLAYER_JOINED`:
    - `{}`
- `HAND_CHANGED`:
    - actualmente no mapeado explicitamente en `MatchWsEvent`, por lo que puede llegar con
      `payload: {}`.
- `FRIEND_REQUEST_RECEIVED`:
    - `{ requesterUsername, addresseeUsername }` - `status` omitido (siempre PENDING por
      tipo de evento)
- `FRIEND_REQUEST_ACCEPTED`:
    - `{ requesterUsername, addresseeUsername }` - `status` omitido (siempre ACCEPTED por tipo de
      evento)
- `FRIEND_REQUEST_DECLINED`:
    - `{ requesterUsername, addresseeUsername }` - se envía al **requester** cuando el
      addressee rechaza la solicitud
- `FRIEND_REQUEST_CANCELLED`:
    - `{ requesterUsername, addresseeUsername }` - se envía al **addressee** cuando el
      requester cancela la solicitud pendiente
- `FRIENDSHIP_REMOVED`:
    - `{ requesterUsername, addresseeUsername, removedByUsername }`
- `RESOURCE_INVITATION_RECEIVED`:
    - `{ invitationId, senderUsername, targetType, targetId, expiresAt }`
- `RESOURCE_INVITATION_ACCEPTED`:
    - `{ invitationId, recipientUsername, targetType, targetId }`
- `RESOURCE_INVITATION_CANCELLED`:
    - `{ invitationId, senderUsername, targetType, targetId }`
- `RESOURCE_INVITATION_DECLINED`:
    - `{ invitationId, recipientUsername, targetType, targetId }`
- `RESOURCE_INVITATION_EXPIRED`:
    - `{ invitationId, senderUsername, recipientUsername, targetType, targetId }`
- `ACHIEVEMENT_UNLOCKED`:
    - `{ achievementCode, unlockedAt, matchId, gameNumber }`
- `LEAGUE_MATCH_ACTIVATED`:
    - `{ leagueId, matchId }` - se emite a todos los participantes de la liga cuando un partido
      es activado. El FE debe navegar o actualizar al nuevo partido usando el `matchId`.
- `CUP_MATCH_ACTIVATED`:
    - `{ cupId, matchId }` - se emite a todos los participantes de la copa cuando un partido de
      bracket es activado.
- `LEAGUE_PLAYER_JOINED` / `CUP_PLAYER_JOINED`:
    - `{ leagueId/cupId, player }` - `player` contiene `displayName`
- `LEAGUE_PLAYER_LEFT` / `CUP_PLAYER_LEFT`:
    - `{ leagueId/cupId, player }` - `player` contiene `displayName`
- `LEAGUE_CANCELLED` / `CUP_CANCELLED`:
    - `{ leagueId/cupId }`
- `LEAGUE_STARTED` / `CUP_STARTED`:
    - `{ leagueId/cupId }`
- `LEAGUE_FIXTURE_ACTIVATED`:
    - `{ leagueId, fixtureId }`
- `CUP_BOUT_ACTIVATED`:
    - `{ cupId, boutId }`
- `LEAGUE_ADVANCED`:
    - `{ leagueId, matchId, winner }` - `winner` contiene `displayName`; `matchId` puede ser `null`
      cuando el avance es automático
      (por ejemplo, forfeit del oponente)
- `CUP_ADVANCED`:
    - `{ cupId, matchId, winner }` - `winner` contiene `displayName`; `matchId` puede ser `null`
      cuando el avance es automático
      (por ejemplo, bye o forfeit del oponente)
- `LEAGUE_PLAYER_FORFEITED`:
    - `{ leagueId, forfeiter }` - `forfeiter` contiene `displayName`
- `CUP_PLAYER_FORFEITED`:
    - `{ cupId, forfeiter }` - `forfeiter` contiene `displayName`
- `LEAGUE_FINISHED`:
    - `{ leagueId, leaders: [displayName, ...] }`
- `CUP_FINISHED`:
    - `{ cupId, champion: displayName }`
- `SPECTATE_STATE`:
    - `{ matchState }` - `matchState` respeta la forma de `GET /api/matches/{matchId}/spectate`
- `SPECTATE_ERROR`:
    - `{ error }`
- `PUBLIC_MATCH_LOBBY_UPSERT` / `PUBLIC_CUP_LOBBY_UPSERT` / `PUBLIC_LEAGUE_LOBBY_UPSERT`:
    - `{ lobby }` - `lobby` respeta la forma de `GET /api/*/public`
- `PUBLIC_MATCH_LOBBY_REMOVED` / `PUBLIC_CUP_LOBBY_REMOVED` / `PUBLIC_LEAGUE_LOBBY_REMOVED`:
    - `{ id }`
- `REMATCH_AVAILABLE`:
    - `{ sessionId, originMatchId, expiresAt }` — `expiresAt` en `epochMillis`
    - Destinatarios: jugador 1, jugador 2 (si no es bot)
- `REMATCH_OPPONENT_WANTS`:
    - `{ sessionId, originMatchId, actor }` — `actor` es el username/displayName del que aceptó
    - Destinatario: el otro jugador
- `REMATCH_CONFIRMED`:
    - `{ sessionId, originMatchId, newMatchId, newPlayerOne, newPlayerTwo }` — `newMatchId` es UUID
      string; `newPlayerOne`/`newPlayerTwo` son username/displayName
    - Destinatarios: ambos jugadores (con asientos invertidos respecto al match original)
    - El nuevo match ya está `IN_PROGRESS` cuando llega este evento; inmediatamente después llegan
      `GAME_STARTED`, `ROUND_STARTED`, `TURN_CHANGED`, etc. para el `newMatchId`
    - No hace falta llamar a `POST /start`; la partida arranca automáticamente
- `REMATCH_CLOSED_BY_LEAVE`:
    - `{ sessionId, originMatchId, actor }` — `actor` es el username/displayName del que abandonó
    - Destinatario: el otro jugador
- `REMATCH_EXPIRED`:
    - `{ sessionId, originMatchId }`
    - Destinatarios: ambos jugadores

## 9. API REST - Bots

### 9.1 Listar bots disponibles

`GET /api/bots`

No requiere autenticacion.

Response `200`:

```json
[
  {
    "botId": "00000000-0000-0000-0000-000000000001",
    "name": "El Mentiroso",
    "personality": {
      "mentiroso": 90,
      "pescador": 20,
      "temerario": 70,
      "envidoso": 50,
      "aguantador": 30
    }
  },
  {
    "botId": "00000000-0000-0000-0000-000000000002",
    "name": "El Pescador",
    "personality": {
      "mentiroso": 30,
      "pescador": 90,
      "temerario": 40,
      "envidoso": 60,
      "aguantador": 70
    }
  },
  {
    "botId": "00000000-0000-0000-0000-000000000003",
    "name": "El Temerario",
    "personality": {
      "mentiroso": 60,
      "pescador": 30,
      "temerario": 95,
      "envidoso": 70,
      "aguantador": 15
    }
  },
  {
    "botId": "00000000-0000-0000-0000-000000000004",
    "name": "El Cauteloso",
    "personality": {
      "mentiroso": 15,
      "pescador": 50,
      "temerario": 20,
      "envidoso": 40,
      "aguantador": 85
    }
  },
  {
    "botId": "00000000-0000-0000-0000-000000000005",
    "name": "El Equilibrado",
    "personality": {
      "mentiroso": 50,
      "pescador": 50,
      "temerario": 50,
      "envidoso": 50,
      "aguantador": 50
    }
  }
]
```

Parametros de personalidad (todos en rango 1-100):

| Campo        | Descripcion                                                    |
|--------------|----------------------------------------------------------------|
| `mentiroso`  | Tendencia a bluffear (cantar truco/envido con mano debil)      |
| `pescador`   | Espera que el rival cante envido primero para subir la apuesta |
| `temerario`  | Velocidad para escalar apuestas (retruco, vale cuatro)         |
| `envidoso`   | Agresividad al cantar envido                                   |
| `aguantador` | Reserva las cartas fuertes para manos posteriores              |

### 9.2 Crear partida contra bot

`POST /api/matches/bot`

Requiere Bearer token.

Request:

```json
{
  "gamesToPlay": 3,
  "botId": "00000000-0000-0000-0000-000000000001"
}
```

| Campo         | Tipo            | Descripcion                                                               |
|---------------|-----------------|---------------------------------------------------------------------------|
| `gamesToPlay` | `integer`       | Partidas totales de la serie (mejor de N). Valores válidos: `1`, `3`, `5` |
| `botId`       | `string (UUID)` | ID del bot elegido (obtenido de `GET /api/bots`)                          |

Response `200`:

```json
{
  "matchId": "550e8400-e29b-41d4-a716-446655440000"
}
```

La partida se crea directamente en estado `IN_PROGRESS`. El jugador recibe eventos WebSocket de la
misma forma que en una partida normal. El bot actua automaticamente cuando es su turno.

Errores:

| Codigo | Descripcion                                                                                                                        |
|--------|------------------------------------------------------------------------------------------------------------------------------------|
| `404`  | El `botId` no existe en el catalogo de bots                                                                                        |
| `422`  | `gamesToPlay` fuera del conjunto `{1, 3, 5}`, el jugador ya tiene una partida activa, tiene una revancha `OPEN`, o ya está en cola |

### 9.3 Quick Match (emparejamiento automatico)

#### Entrar a la cola

`POST /api/matches/quick`

Requiere Bearer token.

Request:

```json
{
  "gamesToPlay": 3
}
```

| Campo         | Tipo      | Descripcion                                        |
|---------------|-----------|----------------------------------------------------|
| `gamesToPlay` | `integer` | Partidas a ganar para terminar el match (minimo 1) |

Response `200`:

```json
{
  "status": "SEARCHING",
  "matchId": null,
  "enqueuedAt": "2026-05-20T10:00:00Z"
}
```

o si habia oponente esperando:

```json
{
  "status": "MATCHED",
  "matchId": "550e8400-e29b-41d4-a716-446655440000",
  "enqueuedAt": "2026-05-20T10:00:00Z"
}
```

| Campo        | Tipo                    | Descripcion                                       |
|--------------|-------------------------|---------------------------------------------------|
| `status`     | `SEARCHING` / `MATCHED` | `SEARCHING`: en cola. `MATCHED`: match creado.    |
| `matchId`    | `string (UUID)` / null  | ID del match creado; `null` si aun esta buscando. |
| `enqueuedAt` | `string (ISO-8601)`     | Momento en que el jugador entro a la cola.        |

Si `status = MATCHED`, el jugador tambien recibe el evento WebSocket `GAME_STARTED` en
`/user/queue/match` con el `matchId`.

La llamada es idempotente: si el jugador ya estaba en cola, devuelve `SEARCHING` con el
`enqueuedAt` original sin modificar su posicion en la cola.

Errores:

| Codigo | Descripcion                                                                                           |
|--------|-------------------------------------------------------------------------------------------------------|
| `422`  | `gamesToPlay` invalido, el jugador ya tiene una partida activa, o tiene una revancha `OPEN` pendiente |

#### Cancelar busqueda

`DELETE /api/matches/quick`

Requiere Bearer token. No tiene body.

Response `204 No Content`.

La operacion es idempotente: si el jugador no estaba en cola, devuelve `204` igual.

---

## 10. Flujo de autenticacion recomendado

### 10.1 Usuarios persistidos

1. El FE llama a `/api/auth/register` o `/api/auth/login`.
2. Guarda `accessToken` y `refreshToken`.
3. Usa el `accessToken` como `Bearer` en todos los endpoints protegidos.
4. Antes de que expire, o al recibir `401`, llama a `/api/auth/refresh` con el `refreshToken`.
5. Reemplaza ambos tokens por los nuevos valores devueltos.
6. Si habia una conexion WebSocket activa, reconecta con el nuevo `accessToken`.

### 10.2 Guest

1. El FE llama a `/api/auth/guest`.
2. Guarda solo `accessToken`.
3. Usa ese `accessToken` como `Bearer` y para el frame STOMP `CONNECT`.
4. Guest no soporta refresh. Si expira, debe pedir una nueva sesion guest.

## 11. Notas para FE

- Tratar enums como case-sensitive.
- Manejar `204 No Content` en acciones de juego (sin body).
- Los eventos de liga (`LEAGUE_*`) llegan a **todos los participantes** de la liga, no solo a los
  dos jugadores de cada partido.
- Los eventos de copa (`CUP_*`) llegan a **todos los participantes** de la copa.
- El lobby publico es broadcast por `/topic/public-match-lobby`, `/topic/public-cup-lobby` y
  `/topic/public-league-lobby`.
- El snapshot inicial del lobby se obtiene por REST (`GET /api/*/public`); los topics publicos
  solo emiten deltas `PUBLIC_*_LOBBY_UPSERT` y `PUBLIC_*_LOBBY_REMOVED`.
- Las novedades sociales llegan por `/user/queue/social`; no reemplazan el flujo existente de
  `joinCode`, solo agregan targeting y UX mas rapida entre amigos.
- Los logros llegan por `/user/queue/profile` con evento `ACHIEVEMENT_UNLOCKED` y payload
  `{ achievementCode, unlockedAt, matchId, gameNumber }`.
- El FE debe suscribirse al lobby solo mientras esa pantalla este activa y desuscribirse al
  crear/unirse/navegar a un match, liga o copa.
- El backend no suprime eventos del lobby segun `playerId`; si el creador o participante no debe
  ver un item, esa exclusion es responsabilidad del lifecycle del cliente.
- Spectate se activa por WebSocket, no por REST: para empezar a mirar un match hay que suscribirse
  a `/user/queue/match-spectate` con header `matchId`.
- Si la conexion WebSocket del espectador se corta o hace `UNSUBSCRIBE`, el backend deja de
  registrarlo como espectador de ese match.
- `GET /api/matches/{matchId}/spectate` sirve para refrescar el snapshot de un espectador ya
  registrado. Si se consulta despues de perder la sesion de spectate, responde `422`.
- En ligas, los partidos se crean **on-demand**: al iniciar la liga solo se crea el partido de la
  fecha 1. Cuando ese partido termina (o es forfeiteado), la liga activa automáticamente el
  siguiente partido elegible y envía un evento `LEAGUE_MATCH_ACTIVATED` a todos los participantes.
  Los fixtures con estado `SCHEDULED` son partidos futuros aún no creados.
- En copas, el bracket avanza automáticamente: cuando un partido termina se emite
  `CUP_MATCH_ACTIVATED` a todos los participantes con el siguiente partido a jugar.
  El FE puede consultar `GET /api/cups/{cupId}` para ver el estado completo del bracket.
- El **chat** se crea automáticamente al iniciar un match, liga o copa. Se elimina al finalizar
  o cancelarse el recurso padre. Para obtener el chat, usar
  `GET /api/chats/by-parent/{MATCH|LEAGUE|CUP|FRIENDSHIP}/{parentId}`. Los eventos de chat llegan
  por `/user/queue/chat`. El chat tiene un buffer circular de 50 mensajes y rate limit de 2
  segundos entre mensajes del mismo jugador.
- El DM de `FRIENDSHIP` es efimero: no persiste mensajes ni metadata. Se crea lazily la primera vez
  que se consulta y se pierde al reiniciar la aplicacion.
- El perfil de jugador se consulta por REST: `GET /api/profile/{username}` devuelve username,
  logros y stats agregados (sin `playerId` en la respuesta). Las stats son eventual-consistent
  (se actualizan al recibir `MATCH_FINISHED`/`MATCH_ABANDONED`/`MATCH_FORFEITED`). Los logros
  en tiempo real siguen llegando por WebSocket (`/user/queue/profile`). Los guests no tienen
  perfil (404). La búsqueda es case-sensitive.

### 11.1 Reconexión WebSocket

Flujo recomendado para reconectar tras una desconexión:

1. Reconectar al WebSocket (`/ws` o `/ws-sockjs`) con el JWT en el frame STOMP `CONNECT`
2. Re-suscribirse a los canales relevantes (`/user/queue/match`, `/user/queue/league`, etc.)
3. **Bufferar** los eventos entrantes sin procesarlos todavía
4. Hacer `GET` del estado actual:

    - Match: `GET /api/matches/{matchId}`
    - Liga: `GET /api/leagues/{leagueId}`
    - Copa: `GET /api/cups/{cupId}`
    - Chat: `GET /api/chats/by-parent/{parentType}/{parentId}`

5. Aplicar el estado del GET como base autoritativa
6. Descartar eventos bufferados con `timestamp` anterior al GET; aplicar los posteriores

### 11.2 Nota especifica para spectate

Si el cliente estaba en modo espectador y la conexion se cae:

1. Reconectar STOMP con el JWT vigente.
2. Re-suscribirse a `/user/queue/match-spectate` enviando otra vez `matchId` en la `SUBSCRIBE`.
3. Esperar el evento `SPECTATE_STATE`, que vuelve a registrar al espectador y trae el snapshot
   inicial.

No asumir que la sesion de spectate sigue viva tras una desconexion: el backend la limpia al
procesar `UNSUBSCRIBE` o `DISCONNECT`.

### 11.3 Revancha (Rematch)

- La revancha se abre automaticamente solo en matches **casuales** (no de liga ni copa). Despues de
  un `MATCH_FINISHED` en esos contextos no llega `REMATCH_AVAILABLE`.
- El evento `REMATCH_AVAILABLE` llega por `/user/queue/match` con el `matchId` de la partida que
  **termino** (no de la nueva). No hay canal WS separado para revancha.
- `expiresAt` en los payloads WS de revancha llega en `epochMillis`. En la respuesta REST
  (`GET /api/matches/{matchId}/rematch`) llega en `ISO-8601`. Prestar atencion al canal para
  parsear correctamente.
- Cuando el FE recibe `REMATCH_CONFIRMED`, el `newMatchId` viene directamente en el payload. El
  nuevo match ya está `IN_PROGRESS`; inmediatamente después llegan los eventos del nuevo match
  (`GAME_STARTED`, `ROUND_STARTED`, `TURN_CHANGED`, etc.) para ese `newMatchId`. No es necesario
  llamar a `POST /start` ni a `GET /api/matches/{matchId}/rematch` para obtener el id.
- Mientras la sesion este `OPEN`, el jugador tiene disponibilidad bloqueada: cualquier intento de
  crear o unirse a otra partida, liga, copa o aceptar una invitacion social devolvera `422` con
  `PlayerHasOpenRematchSessionException`. Mostrar mensaje orientativo.
- Si el bot es oponente, acepta automaticamente al abrirse la sesion (`REMATCH_OPPONENT_WANTS` no
  se emite). El bot no puede abandonar. El FE puede ignorar el estado `playerTwoChoice` en
  partidas contra bot.
- La sesion expira por TTL configurable (por defecto `PT2M`). Tras `REMATCH_EXPIRED` la
  disponibilidad del jugador se libera automaticamente.
