# API REST - Leagues

> [← Volver al índice de contratos](../CONTRATOS_API.md)

## Crear liga

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

## Unirse a liga

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

## Listar ligas publicas

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

## Join desde lobby publico

Auth: Bearer requerido.

El FE debe usar el `href` provisto en `_links.join` y ejecutar `POST /api/join/{joinCode}`.

## Salir de liga

`POST /api/leagues/{leagueId}/leave`

Auth: Bearer requerido (token del liga).

Response `204` sin body.

## Iniciar liga

`POST /api/leagues/{leagueId}/start`

Auth: Bearer requerido (solo el creador).

Response `204` sin body.

## Obtener estado de liga

`GET /api/leagues/{leagueId}`

Auth: Bearer requerido. Solo los participantes de la liga pueden consultarla.

Devuelve el estado completo de la liga: estado general, tabla de posiciones,
ganador(es) y el calendario completo por jornadas (fixtures). Es la fuente única
para renderizar la pantalla de liga (sala de espera, tabla de posiciones y
fixtures).

Response `200`:

```json
{
  "leagueId": "league-123",
  "status": "IN_PROGRESS",
  "host": "juancho",
  "totalSlots": 3,
  "occupiedSlots": 3,
  "canStart": false,
  "participants": [
    {
      "player": "juancho",
      "creator": true
    },
    {
      "player": "martina",
      "creator": false
    },
    {
      "player": "pedro",
      "creator": false
    }
  ],
  "standings": [
    {
      "player": "juancho",
      "wins": 3
    },
    {
      "player": "martina",
      "wins": 2
    },
    {
      "player": "pedro",
      "wins": 0
    }
  ],
  "winners": [],
  "matchdays": [
    {
      "matchdayNumber": 1,
      "fixtures": [
        {
          "fixtureId": "fixture-1",
          "matchdayNumber": 1,
          "playerOne": "juancho",
          "playerTwo": "martina",
          "matchId": "match-abc",
          "winner": "juancho",
          "status": "FINISHED"
        },
        {
          "fixtureId": "fixture-2",
          "matchdayNumber": 1,
          "playerOne": "pedro",
          "playerTwo": null,
          "matchId": null,
          "winner": null,
          "status": "LIBRE"
        }
      ]
    },
    {
      "matchdayNumber": 2,
      "fixtures": [
        {
          "fixtureId": "fixture-3",
          "matchdayNumber": 2,
          "playerOne": "juancho",
          "playerTwo": "pedro",
          "matchId": "match-def",
          "winner": null,
          "status": "PENDING"
        },
        {
          "fixtureId": "fixture-4",
          "matchdayNumber": 2,
          "playerOne": "martina",
          "playerTwo": null,
          "matchId": null,
          "winner": null,
          "status": "LIBRE"
        }
      ]
    }
  ],
  "visibility": "PRIVATE",
  "joinCode": "ABCD2345",
  "lobbyTimeoutDeadline": null
}
```

Campos de nivel raíz:

| Campo                  | Tipo            | Descripción                                                                                                             |
|------------------------|-----------------|-------------------------------------------------------------------------------------------------------------------------|
| `leagueId`             | `string`        | ID de la liga.                                                                                                          |
| `status`               | `string` (enum) | Estado de la liga. Ver tabla de estados abajo.                                                                          |
| `host`                 | `string`        | Nombre visible del creador de la sala.                                                                                  |
| `totalSlots`           | `int`           | Cupo total de jugadores configurado para la liga.                                                                       |
| `occupiedSlots`        | `int`           | Cantidad actual de participantes en la sala.                                                                            |
| `canStart`             | `boolean`       | `true` si el usuario autenticado puede iniciar la liga en este estado.                                                  |
| `participants`         | `array`         | Participantes actuales de la sala, en orden de ingreso.                                                                 |
| `standings`            | `array`         | Tabla de posiciones, ordenada por `wins` descendente.                                                                   |
| `winners`              | `array<string>` | Nombre(s) visible(s) del/los líder(es). Ver nota abajo.                                                                 |
| `matchdays`            | `array`         | Calendario completo, una entrada por jornada.                                                                           |
| `visibility`           | `string` (enum) | `PUBLIC` o `PRIVATE`. Para reconstruir la sala al reconectar.                                                           |
| `joinCode`             | `string`        | Código para invitar/unirse. Solo visible para participantes.                                                            |
| `lobbyTimeoutDeadline` | `epochMillis`   | Instante en que la sala expira por inactividad (`lobby-timeout`, 600 s por defecto). `null` fuera de la fase de espera. |

Nota para sala de espera: `participants`, `totalSlots`, `occupiedSlots`, `host`
y `canStart` son la fuente para renderizar la sala antes de iniciar. No inferir
participantes desde `standings`: antes de arrancar la liga, `standings` puede
venir vacio porque todavia no hay victorias inicializadas.

Estados de liga (`status`):

| Valor                 | Significado                                                   |
|-----------------------|---------------------------------------------------------------|
| `WAITING_FOR_PLAYERS` | Aún faltan jugadores para completar el cupo (sala de espera). |
| `WAITING_FOR_START`   | Cupo completo; el creador todavía no inició la liga.          |
| `IN_PROGRESS`         | Liga en curso; se están jugando las jornadas.                 |
| `FINISHED`            | Liga terminada; `winners` contiene al/los campeón(es).        |
| `CANCELLED`           | Liga cancelada.                                               |

Nota sobre `winners`: refleja al/los líder(es) actual(es) según la tabla. Mientras
la liga está `IN_PROGRESS` puede venir vacío (sin partidos resueltos) o contener
empates. Una vez `FINISHED`, contiene al/los campeón(es) (puede haber más de uno
en caso de empate).

Cada item de `standings` (`LeagueStandingResponse`):

| Campo    | Tipo     | Descripción                 |
|----------|----------|-----------------------------|
| `player` | `string` | Nombre visible del jugador. |
| `wins`   | `int`    | Cantidad de victorias.      |

Cada item de `participants` (`LeagueParticipantResponse`):

| Campo     | Tipo      | Descripcion                               |
|-----------|-----------|-------------------------------------------|
| `player`  | `string`  | Nombre visible del jugador.               |
| `creator` | `boolean` | `true` si este participante creo la sala. |

Cada item de `matchdays` (`LeagueMatchdayResponse`):

| Campo            | Tipo    | Descripción                  |
|------------------|---------|------------------------------|
| `matchdayNumber` | `int`   | Número de jornada (1-based). |
| `fixtures`       | `array` | Partidos de esa jornada.     |

Cada item de `fixtures` (`LeagueFixtureResponse`):

| Campo            | Tipo            | Nullable | Descripción                                                          |
|------------------|-----------------|----------|----------------------------------------------------------------------|
| `fixtureId`      | `string`        | No       | ID del fixture.                                                      |
| `matchdayNumber` | `int`           | No       | Número de jornada al que pertenece.                                  |
| `playerOne`      | `string`        | No       | Nombre visible del jugador local.                                    |
| `playerTwo`      | `string`        | Sí       | Nombre visible del rival. `null` cuando el fixture es `LIBRE` (bye). |
| `matchId`        | `string`        | Sí       | ID de la partida asociada. `null` hasta que la jornada se activa.    |
| `winner`         | `string`        | Sí       | Nombre visible del ganador. `null` hasta que el fixture termina.     |
| `status`         | `string` (enum) | No       | Estado del fixture. Ver tabla de estados abajo.                      |

Estados de fixture (`status`):

| Valor       | Significado                                                                            |
|-------------|----------------------------------------------------------------------------------------|
| `SCHEDULED` | Fixture programado; la jornada todavía no se activó (`matchId` aún `null`).            |
| `PENDING`   | Jornada activa; la partida está en juego (`matchId` ya presente, `winner` aún `null`). |
| `FINISHED`  | Fixture resuelto; `winner` contiene al ganador.                                        |
| `LIBRE`     | Bye: el jugador descansa esta jornada. `playerTwo`, `matchId` y `winner` son `null`.   |

Errores:

| Código | Causa                              |
|--------|------------------------------------|
| `401`  | Token ausente o inválido.          |
| `404`  | Liga no encontrada.                |
| `422`  | El jugador no pertenece a la liga. |

## WebSocket

> Transporte (conexión, auth, envelope): ver [09-websocket.md](09-websocket.md).

Destinos:

- `/user/queue/league` — eventos de liga hacia todos los participantes
- `/topic/public-league-lobby` — stream compartido del lobby público de ligas

Envelope de liga (no lleva `stateVersion`):

```json
{
  "leagueId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "LEAGUE_STARTED",
  "timestamp": 1772768158123,
  "payload": {}
}
```

### eventType - Liga (`/user/queue/league`, todos los participantes de la liga)

- `LEAGUE_PLAYER_JOINED` - un jugador se unió a la liga
- `LEAGUE_PLAYER_LEFT` - un jugador no-creador abandonó la liga
- `LEAGUE_CANCELLED` - la liga fue cancelada (creador abandona o timeout)
- `LEAGUE_STARTED` - la liga inició y se generaron los fixtures
- `LEAGUE_FIXTURE_ACTIVATED` - un fixture cambió de estado a PENDING
- `LEAGUE_MATCH_ACTIVATED` - un partido de liga fue creado y está listo
- `LEAGUE_ADVANCED` - un resultado fue registrado en la liga
- `LEAGUE_PLAYER_FORFEITED` - un jugador ha sido declarado forfeit
- `LEAGUE_FINISHED` - la liga terminó

### eventType - Lobby público de liga (`/topic/public-league-lobby`)

- `PUBLIC_LEAGUE_LOBBY_UPSERT` - snapshot o actualizacion de una liga que sigue abierta en lobby
- `PUBLIC_LEAGUE_LOBBY_REMOVED` - remocion de una liga que salio del lobby

Los eventos de lobby publico no llevan `leagueId` top-level; el id va dentro de `payload.lobby` para
`UPSERT` o en `payload.id` para `REMOVED`. El cliente bootstrapea por REST y usa el topic solo para
reconciliar deltas.

### Payloads por evento (liga)

- `LEAGUE_MATCH_ACTIVATED`: `{ leagueId, matchId }` - se emite a todos los participantes cuando un
  partido es activado. El FE debe navegar o actualizar al nuevo partido usando el `matchId`
- `LEAGUE_PLAYER_JOINED`: `{ leagueId, player }` - `player` contiene `displayName`
- `LEAGUE_PLAYER_LEFT`: `{ leagueId, player }` - `player` contiene `displayName`
- `LEAGUE_CANCELLED`: `{ leagueId }`
- `LEAGUE_STARTED`: `{ leagueId }`
- `LEAGUE_FIXTURE_ACTIVATED`: `{ leagueId, fixtureId }`
- `LEAGUE_ADVANCED`: `{ leagueId, matchId, winner }` - `winner` contiene `displayName`; `matchId`
  puede ser `null` cuando el avance es automático (por ejemplo, forfeit del oponente)
- `LEAGUE_PLAYER_FORFEITED`: `{ leagueId, forfeiter }` - `forfeiter` contiene `displayName`
- `LEAGUE_FINISHED`: `{ leagueId, leaders: [displayName, ...] }`
- `PUBLIC_LEAGUE_LOBBY_UPSERT`: `{ lobby }` - `lobby` respeta la forma de `GET /api/leagues/public`
- `PUBLIC_LEAGUE_LOBBY_REMOVED`: `{ id }`
