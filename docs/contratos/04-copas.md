# API REST - Copas

> [← Volver al índice de contratos](../CONTRATOS_API.md)

Copa por eliminación directa (single elimination bracket).

## Crear copa

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

## Unirse a copa

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

## Listar copas publicas

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

## Unirse a copa publica

Auth: Bearer requerido.

El FE debe usar el `href` provisto en `_links.join` y ejecutar `POST /api/join/{joinCode}`.

## Salir de copa

`POST /api/cups/{cupId}/leave`

Auth: Bearer requerido.

Response `204` sin body.

Errores:

- `422` si la copa ya inició, o si el jugador es el creador (el creador no puede salir)

## Iniciar copa

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

## Obtener estado de copa

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
  "champion": null,
  "visibility": "PRIVATE",
  "joinCode": "ABCD2345",
  "lobbyTimeoutDeadline": null
}
```

Cuando la copa finaliza, `status` es `FINISHED` y `champion` contiene el `displayName` del
campeón.

Campos de sala de espera (para reconstruir el lobby al reconectar):

- `visibility` (`PUBLIC`/`PRIVATE`) y `joinCode` (solo visible para participantes) permiten
  re-mostrar y compartir la sala sin haber guardado el código de la respuesta de creación.
- `lobbyTimeoutDeadline` (`epochMillis`) es el instante en que la sala expira por inactividad
  (`lobby-timeout`, 600 s por defecto); `null` fuera de la fase de espera. El torneo en curso no
  tiene timeout propio: el tiempo lo controlan los matches internos.

Errores:

- `404` si la copa no existe
- `422` si el jugador no pertenece a la copa

## Estados de la copa (`status`)

| Estado                | Descripción                                                     |
|-----------------------|-----------------------------------------------------------------|
| `WAITING_FOR_PLAYERS` | Creada, esperando que se unan los jugadores                     |
| `WAITING_FOR_START`   | Todos los jugadores se unieron, esperando que el creador inicie |
| `IN_PROGRESS`         | Bracket generado y partidas en curso                            |
| `FINISHED`            | Copa finalizada, hay campeón                                    |

## Estados de un bout (`BoutStatus`)

| Estado     | Descripción                                                          |
|------------|----------------------------------------------------------------------|
| `AWAITING` | Ronda futura, aún sin jugadores asignados                            |
| `PENDING`  | Ambos jugadores asignados, match creado y en curso                   |
| `FINISHED` | Match terminado, hay ganador                                         |
| `BYE`      | Jugador sin rival (bye), avanza automáticamente a la siguiente ronda |

## Nombres de ronda (`roundName`)

El campo `roundName` es informativo según la distancia a la final:

| Rondas desde la final | `roundName`        |
|-----------------------|--------------------|
| 0                     | `Final`            |
| 1                     | `Semifinal`        |
| 2                     | `Cuartos de final` |
| 3+                    | `Ronda N`          |

## Flujo de avance automático

El bracket avanza automáticamente via eventos internos:

1. Cuando un match de copa termina -> el ganador avanza al siguiente bout
2. Cuando un jugador abandona un match de copa -> se registra como forfeit; el rival avanza
   automáticamente
3. Si el rival ya había forfeiteado -> el bout se resuelve sin crear match (cascade forfeit)
4. Al llegar a la final y resolverse -> la copa pasa a `FINISHED` con el `champion`

El FE no necesita llamar ningún endpoint adicional para el avance: solo suscribirse a los eventos
WebSocket del match activo y consultar `GET /api/cups/{cupId}` para ver el estado actualizado del
bracket.

## WebSocket

> Transporte (conexión, auth, envelope): ver [09-websocket.md](09-websocket.md).

Destinos:

- `/user/queue/cup` — eventos de copa hacia todos los participantes
- `/topic/public-cup-lobby` — stream compartido del lobby público de copas

Envelope de copa (no lleva `stateVersion`):

```json
{
  "cupId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "CUP_STARTED",
  "timestamp": 1772768158123,
  "payload": {}
}
```

### eventType - Copa (`/user/queue/cup`, todos los participantes de la copa)

- `CUP_PLAYER_JOINED` - un jugador se unió a la copa
- `CUP_PLAYER_LEFT` - un jugador no-creador abandonó la copa
- `CUP_CANCELLED` - la copa fue cancelada
- `CUP_STARTED` - la copa inició y se generó el bracket
- `CUP_BOUT_ACTIVATED` - un bout del bracket pasó a estado PENDING
- `CUP_MATCH_ACTIVATED` - un partido de copa fue creado y está listo
- `CUP_ADVANCED` - un resultado fue registrado y el bracket avanzó
- `CUP_PLAYER_FORFEITED` - un jugador fue declarado forfeit
- `CUP_FINISHED` - la copa terminó con un campeón

### eventType - Lobby público de copa (`/topic/public-cup-lobby`)

- `PUBLIC_CUP_LOBBY_UPSERT` - snapshot o actualizacion de una copa que sigue abierta en lobby
- `PUBLIC_CUP_LOBBY_REMOVED` - remocion de una copa que salio del lobby

Los eventos de lobby publico no llevan `cupId` top-level; el id va dentro de `payload.lobby` para
`UPSERT` o en `payload.id` para `REMOVED`. El cliente bootstrapea por REST y usa el topic solo para
reconciliar deltas.

### Payloads por evento (copa)

- `CUP_MATCH_ACTIVATED`: `{ cupId, matchId }` - se emite a todos los participantes cuando un partido
  de bracket es activado
- `CUP_PLAYER_JOINED`: `{ cupId, player }` - `player` contiene `displayName`
- `CUP_PLAYER_LEFT`: `{ cupId, player }` - `player` contiene `displayName`
- `CUP_CANCELLED`: `{ cupId }`
- `CUP_STARTED`: `{ cupId }`
- `CUP_BOUT_ACTIVATED`: `{ cupId, boutId }`
- `CUP_ADVANCED`: `{ cupId, matchId, winner }` - `winner` contiene `displayName`; `matchId` puede
  ser
  `null` cuando el avance es automático (por ejemplo, bye o forfeit del oponente)
- `CUP_PLAYER_FORFEITED`: `{ cupId, forfeiter }` - `forfeiter` contiene `displayName`
- `CUP_FINISHED`: `{ cupId, champion: displayName }`
- `PUBLIC_CUP_LOBBY_UPSERT`: `{ lobby }` - `lobby` respeta la forma de `GET /api/cups/public`
- `PUBLIC_CUP_LOBBY_REMOVED`: `{ id }`
