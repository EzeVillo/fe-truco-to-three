# API REST - Matches

> [← Volver al índice de contratos](../CONTRATOS_API.md)

## Crear partida

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

## Unirse a partida

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
- en `PRIVATE`, el segundo jugador entra y el match queda en `READY`, esperando que ambos jugadores
  confirmen con `POST /api/matches/{matchId}/start`

## Listar partidas publicas

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

## Join desde lobby publico

Auth: Bearer requerido.

El FE debe usar el `href` provisto en `_links.join` y ejecutar `POST /api/join/{joinCode}`.

## Iniciar partida

`POST /api/matches/{matchId}/start`

Auth: Bearer requerido.

Response `204` sin body.

Comportamiento según visibilidad:

- **`PUBLIC`**: no necesario llamar a este endpoint. El match pasa a `IN_PROGRESS` automáticamente
  cuando entra el segundo jugador.
- **`PRIVATE`**: ambos jugadores deben llamar a este endpoint para que el match pase a
  `IN_PROGRESS`.
    - Cuando el segundo jugador se une mediante `POST /api/join/{joinCode}`, el match pasa a estado
      `READY`
    - Cada jugador que llama a `/start` se marca como "listo" (`PLAYER_READY` event)
    - Solo cuando ambos jugadores han llamado a `/start`, el match inicia en `IN_PROGRESS`

## Jugar carta

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

## Cantar truco

`POST /api/matches/{matchId}/truco`

Auth: Bearer requerido.

Request body: sin body.

Response `204` sin body.

## Responder truco

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

## Cantar envido

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

## Responder envido

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

## Irse al mazo

`POST /api/matches/{matchId}/fold`

Auth: Bearer requerido.

Request body: sin body.

Response `204` sin body.

## Abandonar partida

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

## Salir de partida

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

## Obtener estado de partida

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
  "spectatorCount": 3,
  "stateVersion": 5,
  "lobby": null,
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
    "currentEnvidoCall": null,
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
    },
    "actionDeadline": 1772768188123,
    "turnDurationMillis": 30000,
    "actionDeadlineSeat": "PLAYER_ONE"
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
- `spectatorCount` es la cantidad de espectadores activos en la partida al momento de la consulta.
  Permite que el jugador conozca el conteo al entrar/reconectar sin esperar el próximo push WS
  `SPECTATOR_COUNT_CHANGED` (ver [WebSocket](#websocket)), que lo mantiene actualizado en vivo. Es
  el mismo
  valor que ve el espectador en `GET /api/matches/{matchId}/spectate` (`countActiveByMatchId`)
- `roundGame` es `null` si la partida no está `IN_PROGRESS`
- `lobby` es la **vista de sala de espera**: `null` salvo que la partida esté en
  `WAITING_FOR_PLAYERS` o `READY`. Es mutuamente excluyente con `roundGame` (nunca ambos no-null).
  Permite reconstruir la sala al reconectar sin haber guardado el `joinCode` de la respuesta de
  creación. Shape cuando la partida está esperando:

  ```json
  "lobby": {
    "visibility": "PRIVATE",
    "joinCode": "ABCD2345",
    "lobbyTimeoutDeadline": 1772768488123,
    "readyPlayerOne": true,
    "readyPlayerTwo": false
  }
  ```

    - `joinCode` solo se devuelve a quien ya está sentado en la partida (el endpoint valida
      pertenencia), por lo que no expone el código de un match privado a terceros.
    - `lobbyTimeoutDeadline` (`epochMillis`, absoluto) es el instante en que la sala se cancela por
      inactividad (`lastActivityAt + lobby-timeout`, 5 min por defecto). `null` si no corre reloj.
      Es independiente del temporizador de turno (_Temporizador de turno_), que solo aplica en
      juego.
- `myCards` contiene solo las cartas del jugador autenticado
- `availableActions` refleja las acciones disponibles para el jugador autenticado
- `actionDeadline`, `turnDurationMillis` y `actionDeadlineSeat` describen el temporizador de
  inactividad del turno.
  Ver [Temporizador de turno](#temporizador-de-turno-timeout-por-inactividad).

Errores:

- `404` si la partida no existe
- `422` si el jugador no pertenece a la partida

## Obtener estado de partida como espectador

`GET /api/matches/{matchId}/spectate`

Auth: Bearer requerido.

Request body: sin body.

Response `200`:

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "status": "IN_PROGRESS",
  "playerOneUsername": "juancho",
  "playerTwoUsername": "martina",
  "scorePlayerOne": 2,
  "scorePlayerTwo": 1,
  "gamesWonPlayerOne": 1,
  "gamesWonPlayerTwo": 0,
  "gamesToPlay": 3,
  "matchWinner": null,
  "stateVersion": 5,
  "currentRound": {
    "status": "IN_PROGRESS",
    "currentTurn": "juancho",
    "roundStatus": "PLAYING",
    "currentTrucoCall": "TRUCO",
    "currentTrucoCaller": "martina",
    "currentEnvidoCall": null,
    "currentEnvidoCaller": null,
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
    },
    "actionDeadline": 1772768188123,
    "turnDurationMillis": 30000,
    "actionDeadlineSeat": "PLAYER_ONE",
    "handPlayerOne": null,
    "handPlayerTwo": null
  },
  "spectatorCount": 3
}
```

Reglas:

- devuelve una vista publica del match: no incluye `myCards` ni `availableActions`
- `currentRound.currentTrucoCaller` y `currentRound.currentEnvidoCaller` indican **quién cantó** el
  truco/envido que está pendiente de respuesta (el oponente del que figura en `currentTurn`); son
  `null` cuando no hay ese canto en curso. Pensado para que el espectador sepa quién cantó sin poder
  inferirlo de `availableActions` (que no se expone en spectate)
- `currentRound.handPlayerOne` y `currentRound.handPlayerTwo` exponen las **cartas en mano** de cada
  asiento **solo en partidas bot-vs-bot** (_Crear partida entre dos
  bots_ ([08-bots.md](08-bots.md))), para que el creador vea ambas manos; en cualquier
  otra partida (con humanos) ambos campos son `null`. En bot-vs-bot solo el **creador** puede
  espectar (un no-creador es rechazado al suscribirse por WS, ver _eventType - Spectate_
  en [09-websocket.md](09-websocket.md))
- `playerOneUsername` y `playerTwoUsername` son el roster asiento->nombre, para que el tablero
  etiquete ambos lados; `playerTwoUsername` es `null` si todavia no hay rival sentado
- `gamesToPlay` es la cantidad de games necesarios para ganar el match (best-of); coincide con el
  `gamesToPlay` de la vista de jugador
- `actionDeadline`, `turnDurationMillis` y `actionDeadlineSeat` se exponen igual que en _Obtener
  estado de partida_, para
  que el espectador renderice el temporizador del turno sobre el asiento que debe actuar (
  _Temporizador de turno_)
- `scorePlayerOne` y `scorePlayerTwo` representan el puntaje del game actual y viven a nivel
  `match`
- solo funciona si el jugador ya esta registrado como espectador de ese match
- hoy ese registro se produce al suscribirse por STOMP a `/user/queue/match-spectate` enviando el
  header nativo `matchId`

Errores:

- `404` si la partida no existe
- `422` si el jugador no esta registrado como espectador de esa partida

## Flujo de spectate

El flujo actual de spectate es WebSocket-first:

1. Conectar STOMP con `Authorization: Bearer <jwt>`.
2. Suscribirse a `/user/queue/match-spectate`.
3. En esa `SUBSCRIBE`, enviar header nativo `matchId: <uuid-del-match>`.
4. Si el alta es valida, el backend registra el espectador y envia `SPECTATE_STATE`.
5. Desde ese momento, `GET /api/matches/{matchId}/spectate` devuelve el snapshot REST del mismo
   estado de espectador.

Restricciones de negocio:

- el match debe estar `IN_PROGRESS`
- el espectador debe pertenecer a la misma liga/copa del match o tener amistad confirmada con
  alguno de los jugadores
- un jugador no puede spectear su propio match
- un jugador no puede spectear dos matches al mismo tiempo
- al terminar el match, si el espectador pasa a ser jugador activo en una liga/copa, o si se elimina
  la amistad que era su unico motivo de elegibilidad, el backend lo desregistra automaticamente
- estar especteando deja al jugador en estado `busy = true`: no puede crear partidas, ligas, copas,
  buscar Quick Match ni aceptar invitaciones sociales mientras tenga una suscripcion de spectate
  activa

Comportamiento multi-dispositivo:

- si el mismo jugador se suscribe a `/user/queue/match-spectate` con el mismo `matchId` desde
  un segundo dispositivo/pestaña, el backend lo registra una sola vez (idempotente en la sesion de
  spectatorship) y devuelve `SPECTATE_STATE` a la nueva sesion
- el jugador deja de ser espectador **solo cuando se desconecta la ultima sesion activa** que
  tenia abierta para ese match; desconectarse de un dispositivo no corta la sesion en los demas
- el frontend puede detectar que el usuario estaba especteando desde `GET /api/me/presence`
  (`spectating.matchId`) y redirigirlo al match correspondiente al cargar en un nuevo dispositivo

## Revancha (Rematch)

Solo aplica a matches **casuales** (no pertenecientes a liga ni copa).
Al terminar un match casual, el backend abre automaticamente una sesion de revancha.

### Aceptar revancha

`POST /api/matches/{matchId}/rematch/choose`

El jugador autenticado acepta la revancha. El `matchId` es el de la partida **original** (
terminada).

Response `204`: sin body.

Errores:

- `401` sin token
- `404` si no existe sesion de revancha para ese `matchId`
- `422` en cualquiera de los siguientes casos: sesion no esta en estado `OPEN`, sesion expirada,
  jugador no es participante de la sesion

### Abandonar revancha

`POST /api/matches/{matchId}/rematch/leave`

El jugador autenticado abandona la sesion. El bot no puede ser actor de esta accion.

Response `204`: sin body.

Errores:

- `401` sin token
- `404` si no existe sesion de revancha para ese `matchId`
- `422` si la sesion no esta `OPEN`, el jugador no es participante, el bot intenta abandonar

### Consultar sesion de revancha

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

## Temporizador de turno (timeout por inactividad)

El timeout de una partida tiene **dos relojes según la fase**, configurables por separado:

| Fase                                           | Propiedad                           | Default     | Acción al vencer                                                                                                       |
|------------------------------------------------|-------------------------------------|-------------|------------------------------------------------------------------------------------------------------------------------|
| Sala de espera (`WAITING_FOR_PLAYERS`/`READY`) | `truco.match.lobby-timeout-seconds` | 300 (5 min) | La sala se **cancela** (`MATCH_CANCELLED`). Se expone como `lobby.lobbyTimeoutDeadline` (_Obtener estado de partida_). |
| En juego (`IN_PROGRESS`)                       | `truco.match.play-timeout-seconds`  | 30          | Forfeit del que debe actuar (`MATCH_FORFEITED`). Es el reloj de turno descrito abajo.                                  |

Mientras la partida está `IN_PROGRESS`, el jugador que debe actuar (jugar carta o responder un
canto) dispone de un plazo limitado. Si lo agota, el backend declara forfeit administrativo y emite
`MATCH_FORFEITED` (ver _Payload por evento_ en [09-websocket.md](09-websocket.md)). El backend es el
árbitro: el cliente **no** debe forzar el vencimiento
por su cuenta, solo representar la cuenta regresiva.

El plazo se expone con tres campos, tanto en el snapshot REST (`roundGame` en _Obtener estado de
partida_, `currentRound`
en _Obtener estado de partida como espectador_) como en los eventos WebSocket
`ACTION_DEADLINE_SET` (_Payload por evento_ ([09-websocket.md](09-websocket.md))):

| Campo                | Tipo                         | Descripción                                                                                                                                                  |
|----------------------|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `actionDeadline`     | `epochMillis` (absoluto)     | Instante exacto en que el jugador que debe actuar pierde por timeout. Fuente de verdad del restante. `null` si no corre reloj.                               |
| `turnDurationMillis` | `long` (relativo)            | Duración total del plazo del turno. Sirve como denominador para el progreso del temporizador (anillo/barra).                                                 |
| `actionDeadlineSeat` | `PLAYER_ONE` \| `PLAYER_TWO` | Asiento que debe actuar y al que aplica el reloj. Puede no coincidir con `currentTurn` cuando hay un canto pendiente de respuesta. `null` si no corre reloj. |

Notas de consumo:

- El plazo aplica a **ambos** asientos: el reloj se renderiza sobre `actionDeadlineSeat`, y tanto
  los dos jugadores como los espectadores lo ven en el lado correcto.
- El plazo se reinicia cada vez que cambia el asiento que debe actuar (cambio de turno, canto de
  truco/envido, respuesta que devuelve el juego al rival, nueva ronda).
- `actionDeadline` es un instante absoluto en la zona horaria del servidor (epochMillis), igual que
  `expiresAt` en los WS de revancha e invitaciones. Para neutralizar el desfase de reloj del
  cliente, calcular un offset servidor↔cliente una sola vez al conectar (a partir del `timestamp`
  de cualquier evento WS, que también viaja en epochMillis) y aplicar
  `restante = actionDeadline - (Date.now() + offset)`.

## WebSocket

> Transporte (conexión, auth, envelope, `stateVersion`): ver [09-websocket.md](09-websocket.md).

Destinos:

- `/user/queue/match` — eventos del partido hacia los 2 jugadores
- `/user/queue/match-derived` — notificaciones derivadas (privadas por asiento)
- `/user/queue/match-spectate` — alta y eventos de espectador
- `/topic/public-match-lobby` — stream compartido del lobby público de matches

Envelope de match (lleva `stateVersion`):

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
  "eventType": "CARD_PLAYED",
  "timestamp": 1772768158123,
  "payload": { "seat": "PLAYER_ONE", "card": { "suit": "ESPADA", "number": 1 } },
  "stateVersion": 5
}
```

### eventType - Match (`/user/queue/match`, 2 jugadores del partido)

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

Nota: los eventos `REMATCH_*` viajan por `/user/queue/match` con el `matchId` top-level igual al
`originMatchId` de la sesion (el match que termino, no el nuevo).

#### Notificaciones derivadas (`/user/queue/match-derived`, no avanzan `stateVersion`)

- `AVAILABLE_ACTIONS_UPDATED`
- `PLAYER_HAND_UPDATED`

#### Eventos derivados del temporizador (viajan por `/user/queue/match`, no avanzan `stateVersion`)

- `ACTION_DEADLINE_SET`
- `ACTION_DEADLINE_CLEARED`

A diferencia de `AVAILABLE_ACTIONS_UPDATED`/`PLAYER_HAND_UPDATED` (que son privados por asiento y
viajan por `/user/queue/match-derived`), los eventos del temporizador son **públicos**: viajan por
`/user/queue/match` hacia ambos jugadores y se reenvían a espectadores (ver _eventType - Spectate_
abajo). **No** llevan `stateVersion` (llega `null`); el cliente no debe usarlos para detectar huecos
en la secuencia transicional.
Ver [Temporizador de turno](#temporizador-de-turno-timeout-por-inactividad).

### eventType - Spectate (`/user/queue/match-spectate`, espectadores activos del match)

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

- `SPECTATE_STATE` - snapshot inicial enviado al completar la suscripcion. En partidas **bot-vs-bot
  **
  (_Crear partida entre dos bots_ ([08-bots.md](08-bots.md))) su `matchState.currentRound` incluye
  `handPlayerOne` y `handPlayerTwo` (las manos de ambos bots); en el resto de las partidas ambos
  campos son `null`
- `SPECTATE_ERROR` - error al intentar registrarse como espectador. En bot-vs-bot se devuelve si un
  usuario que **no es el creador** intenta suscribirse (espectado owner-only)
- `SPECTATOR_COUNT_CHANGED` - cambia la cantidad de espectadores del match
- ademas se reenvian los eventos publicos del match que no estan atados a un asiento concreto
- `ACTION_DEADLINE_SET` / `ACTION_DEADLINE_CLEARED` tambien se reenvian: son publicos (indican el
  asiento que debe actuar via `seat`, no son privados por destinatario), asi el espectador puede
  renderizar el temporizador del turno

**Manos en vivo (solo bot-vs-bot):** al creador que espectea una partida bot-vs-bot se le reenvian,
como a un jugador normal, los eventos de mano de **ambos** asientos:

- `HAND_DEALT` - en cada reparto, con `{ player_one: [...], player_two: [...] }`
- `PLAYER_HAND_UPDATED` - por asiento (`{ seat, cards }`) cuando una mano cambia al jugarse una
  carta

No se reenvian al espectador los eventos privados por asiento (regla general, fuera de bot-vs-bot):

- `HAND_DEALT` - en partidas **con humanos** ya **no** se reenvía a espectadores.
- Solo se reenvía en bot-vs-bot
- `PLAYER_HAND_UPDATED` - solo se reenvía en bot-vs-bot (nunca en partidas con humanos)
- `AVAILABLE_ACTIONS_UPDATED` - nunca se reenvía a ningún espectador, tampoco en bot-vs-bot

### eventType - Lobby público de match (`/topic/public-match-lobby`)

El cliente debe bootstrapear por REST y usar este topic solo para reconciliar deltas.

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

- `PUBLIC_MATCH_LOBBY_UPSERT` - snapshot o actualizacion de un match que sigue abierto en lobby
- `PUBLIC_MATCH_LOBBY_REMOVED` - remocion de un match que salio del lobby

Los eventos de lobby publico **no** llevan `matchId` top-level; el id va dentro de `payload.lobby`
para `UPSERT` o en `payload.id` para `REMOVED`.

### Payloads por evento (match)

- `CARD_PLAYED`: `{ seat, card: { suit, number } }`
- `HAND_DEALT`: `{ seat, cards: [ { suit, number }, ... ] }` — payload redactado por destinatario:
  cada jugador ve solo sus propias cartas
- `HAND_RESOLVED`: `{ cardPlayerOne, cardPlayerTwo, winnerSeat }` — en el cierre anticipado puntual
  por `1 de espada`, la carta del rival puede llegar en `null`
- `TURN_CHANGED`: `{ seat }`
- `TRUCO_CALLED`: `{ callerSeat, call }`
- `TRUCO_RESPONDED`: `{ responderSeat, response, call }`
- `ENVIDO_CALLED`: `{ callerSeat, call }`
- `ENVIDO_RESOLVED`: `{ response, winnerSeat, pointsMano?, pointsPie? }`
- `SCORE_CHANGED`: `{ scorePlayerOne, scorePlayerTwo }`
- `ROUND_STARTED`: `{ roundNumber, manoSeat }`
- `ROUND_ENDED`: `{ winnerSeat }`
- `GAME_STARTED`: `{ gameNumber }`
- `GAME_SCORE_CHANGED`: `{ gamesWonPlayerOne, gamesWonPlayerTwo }`
- `MATCH_FINISHED`: `{ winnerSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`
- `MATCH_ABANDONED`: abandono voluntario del jugador; cierra solo el match actual —
  `{ winnerSeat, abandonerSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`
- `MATCH_CANCELLED`: el creador salió antes de que la partida comenzara (via `/leave`), o la partida
  fue cancelada por timeout — `{}`
- `MATCH_PLAYER_LEFT`: el segundo jugador salió antes de que la partida comenzara; vuelve a
  `WAITING_FOR_PLAYERS` — `{ leaverSeat }` (siempre `PLAYER_TWO`)
- `FOLDED`: `{ seat }`
- `MATCH_FORFEITED`: forfeit administrativo por AFK/timeout; puede disparar forfeit de competición —
  `{ winnerSeat, loserSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`
- `ACTION_DEADLINE_SET`: `{ seat, actionDeadline, turnDurationMillis }` — `seat` = asiento que debe
  actuar (`PLAYER_ONE` | `PLAYER_TWO`); `actionDeadline` en `epochMillis` absoluto;
  `turnDurationMillis` = plazo total del turno. Se emite cada vez que se (re)inicia el reloj porque
  cambió el asiento que debe actuar.
  Ver [Temporizador de turno](#temporizador-de-turno-timeout-por-inactividad).
- `ACTION_DEADLINE_CLEARED`: `{}` - el reloj deja de correr (mano resuelta, esperando
  animaciones/resolución del servidor, o estado donde ningún asiento debe actuar)
- `PLAYER_HAND_UPDATED`: `{ seat, cards: [{ suit, number }] }`
- `AVAILABLE_ACTIONS_UPDATED`: `{ seat, availableActions: [{ type, parameter? }] }`
- `SPECTATOR_COUNT_CHANGED`: `{ spectatorCount }`
- `PLAYER_READY`: `{ seat }`
- `PLAYER_JOINED`: `{}`
- `HAND_CHANGED`: actualmente no mapeado explicitamente en `MatchWsEvent`, por lo que puede llegar
  con `payload: {}`
- `SPECTATE_STATE`: `{ matchState }` - `matchState` respeta la forma de
  `GET /api/matches/{matchId}/spectate`
- `SPECTATE_ERROR`: `{ error }`
- `PUBLIC_MATCH_LOBBY_UPSERT`: `{ lobby }` - `lobby` respeta la forma de `GET /api/matches/public`
- `PUBLIC_MATCH_LOBBY_REMOVED`: `{ id }`
- `REMATCH_AVAILABLE`: `{ sessionId, originMatchId, expiresAt }` — `expiresAt` en `epochMillis`.
  Destinatarios: jugador 1, jugador 2 (si no es bot)
- `REMATCH_OPPONENT_WANTS`: `{ sessionId, originMatchId, actor }` — `actor` es el
  username/displayName del que aceptó. Destinatario: el otro jugador
- `REMATCH_CONFIRMED`: `{ sessionId, originMatchId, newMatchId, newPlayerOne, newPlayerTwo }` —
  `newMatchId` es UUID string; `newPlayerOne`/`newPlayerTwo` son username/displayName.
  Destinatarios:
  ambos jugadores (con asientos invertidos respecto al match original). El nuevo match ya está
  `IN_PROGRESS` cuando llega este evento; inmediatamente después llegan `GAME_STARTED`,
  `ROUND_STARTED`, `TURN_CHANGED`, etc. para el `newMatchId`. No hace falta llamar a `POST /start`;
  la partida arranca automáticamente
- `REMATCH_CLOSED_BY_LEAVE`: `{ sessionId, originMatchId, actor }` — `actor` es el
  username/displayName del que abandonó. Destinatario: el otro jugador
- `REMATCH_EXPIRED`: `{ sessionId, originMatchId }`. Destinatarios: ambos jugadores
