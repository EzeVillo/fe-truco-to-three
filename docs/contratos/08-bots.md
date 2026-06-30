# API REST - Bots

> [← Volver al índice de contratos](../CONTRATOS_API.md)

## Listar bots disponibles

`GET /api/bots`

Requiere Bearer token (la respuesta depende del jugador: incluye los bots de campaña que **ese**
jugador haya desbloqueado).

Response `200`: objeto con dos listas. `casual` son los bots del modo casual de siempre;
`campaignUnlocked` son los bots de campaña que el jugador desbloqueó (historial neto `>= 3` a favor;
ver _Modo Campaña_ en [07-perfil-presencia.md](07-perfil-presencia.md)). Ambas listas usan el mismo
formato de bot. Un bot de campaña nunca aparece en `casual`.

```json
{
  "casual": [
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
  ],
  "campaignUnlocked": [
    {
      "botId": "c0000000-0000-0000-0000-000000000042",
      "name": "Cacho Medina",
      "personality": {
        "mentiroso": 58,
        "pescador": 47,
        "temerario": 61,
        "envidoso": 44,
        "aguantador": 35
      }
    }
  ]
}
```

Parametros de personalidad (todos en rango 1-100):

| Campo        | Descripcion                                                    |
|--------------|----------------------------------------------------------------|
| `mentiroso`  | Tendencia a bluffear (cantar truco/envido con mano debil)      |
| `pescador`   | Espera que el rival cante envido primero para subir la apuesta |
| `temerario`  | Velocidad para escalar apuestas (retruco, vale cuatro)         |
| `envidoso`   | Agresividad al cantar envido                                   |
| `aguantador` | Reserva las cartas fuertes para manos posteriores              |

## Crear partida contra bot

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

## Crear partida entre dos bots (bot vs bot)

`POST /api/matches/bot-vs-bot`

Requiere Bearer token. Crea una partida entre **dos bots**. A diferencia de las partidas contra un
bot, **no avanza sola**: cada jugada se dispara con una request del dueño (ver _Avanzar una jugada_
más abajo). El usuario que la crea es su **dueño**: queda **ocupado por autoría** (busy total) hasta
que la partida termine —la mire o no— y es el **único** habilitado para espectarla.

Request:

```json
{
  "botOneId": "00000000-0000-0000-0000-000000000001",
  "botTwoId": "00000000-0000-0000-0000-000000000002",
  "gamesToPlay": 3
}
```

| Campo         | Tipo            | Descripcion                                                               |
|---------------|-----------------|---------------------------------------------------------------------------|
| `botOneId`    | `string (UUID)` | ID del primer bot (de `GET /api/bots`)                                    |
| `botTwoId`    | `string (UUID)` | ID del segundo bot, **distinto** de `botOneId`                            |
| `gamesToPlay` | `integer`       | Partidas totales de la serie (mejor de N). Valores válidos: `1`, `3`, `5` |

Response `200`:

```json
{
  "matchId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- La partida se crea directamente en estado `IN_PROGRESS` y es `PRIVATE`: **no** aparece en el lobby
  público. No genera chat ni sesión de revancha.
- Crear la partida deja al solicitante **busy total**: no puede crear otra bot-match, partida
  normal,
  Quick Match, liga ni copa hasta que la actual termine.
- Para espectarla (viendo las cartas de ambos bots) el creador se suscribe por WebSocket (ver
  _Obtener estado de partida como espectador_ en [02-matches.md](02-matches.md)
  y _eventType - Spectate_ ([09-websocket.md](09-websocket.md))). La ocupación es por autoría, no
  por estar mirando.

Errores:

| Codigo | Descripcion                                                                                                                         |
|--------|-------------------------------------------------------------------------------------------------------------------------------------|
| `400`  | Body inválido o faltante                                                                                                            |
| `404`  | Alguno de los `botId` no existe en el catálogo de bots                                                                              |
| `422`  | `gamesToPlay` fuera de `{1, 3, 5}`, ambos bots iguales, o el usuario ya está ocupado (incluye ser dueño de otra bot-match en curso) |

### Avanzar una jugada (bot vs bot)

`POST /api/matches/bot-vs-bot/{matchId}/advance`

Requiere Bearer token. Las partidas bot-vs-bot **no avanzan solas**: cada llamada ejecuta
**exactamente la próxima acción** del bot al que le toca (jugar carta, cantar truco/envido o
responder). El servidor resuelve internamente qué bot debe actuar; el cliente no manda ningún bot.

- Solo el **creador** puede avanzarla; cualquier otro usuario es rechazado con `422`.
- Es **idempotente**: si la serie ya terminó (o no hay acción pendiente), devuelve `204` sin
  avanzar.
- La carga del match se serializa con un lock de escritura, de modo que dos requests simultáneas (o
  un `advance` que compite con un `abandon`) no pisan el estado.
- El cliente conoce de quién es el turno por el estado de espectado (`currentRound.currentTurn`, ver
  _eventType - Spectate_ ([09-websocket.md](09-websocket.md))) y recibe el nuevo estado por el canal
  de espectado en tiempo real tras cada avance.

Response `204` sin cuerpo.

Errores:

| Codigo | Descripcion                                           |
|--------|-------------------------------------------------------|
| `401`  | Token ausente o inválido                              |
| `404`  | La partida no existe                                  |
| `422`  | El usuario autenticado no es el creador de la partida |

### Abandonar una partida bot vs bot

`POST /api/matches/bot-vs-bot/{matchId}/abandon`

Requiere Bearer token. El **creador** corta anticipadamente su partida bot-vs-bot en curso. La serie
termina (uno de los bots gana administrativamente) y la **ocupación por autoría** del creador se
libera automáticamente, dejándolo disponible para crear o sumarse a otras actividades.

- Solo el **creador** puede abandonarla; cualquier otro usuario es rechazado con `422`.
- Es **idempotente**: si la serie ya estaba terminada, devuelve `204` igual.
- La carga del match se serializa con un lock de escritura, de modo que el abandono siempre gana la
  carrera contra un `advance` en vuelo.

Response `204` sin cuerpo.

Errores:

| Codigo | Descripcion                                           |
|--------|-------------------------------------------------------|
| `401`  | Token ausente o inválido                              |
| `404`  | La partida no existe                                  |
| `422`  | El usuario autenticado no es el creador de la partida |

## Quick Match (emparejamiento automatico)

### Entrar a la cola

`POST /api/matches/quick`

Requiere Bearer token.

Header opcional:

| Header                   | Tipo     | Descripcion                                                                  |
|--------------------------|----------|------------------------------------------------------------------------------|
| `X-WebSocket-Session-Id` | `string` | ID de sesion STOMP que queda asociado al ticket para cleanup al desconectar. |

Request:

```json
{
  "gamesToPlay": 3
}
```

| Campo         | Tipo      | Descripcion                                                  |
|---------------|-----------|--------------------------------------------------------------|
| `gamesToPlay` | `integer` | Partidas totales de la serie. Valores validos: `1`, `3`, `5` |

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

Si el ticket fue creado con `X-WebSocket-Session-Id`, al desconectarse esa sesion STOMP el backend
lo elimina de la cola y emite `PRESENCE_UPDATED`/`FRIEND_AVAILABILITY_CHANGED`. Para compatibilidad,
los tickets sin session id se limpian al desconectarse cualquier sesion STOMP del usuario.

Errores:

| Codigo | Descripcion                                                                                           |
|--------|-------------------------------------------------------------------------------------------------------|
| `422`  | `gamesToPlay` invalido, el jugador ya tiene una partida activa, o tiene una revancha `OPEN` pendiente |

### Cancelar busqueda

`DELETE /api/matches/quick`

Requiere Bearer token. No tiene body.

Response `204 No Content`.

La operacion es idempotente: si el jugador no estaba en cola, devuelve `204` igual.

---

