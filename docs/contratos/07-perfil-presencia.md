# Perfil, presencia y campaña

> [← Volver al índice de contratos](../CONTRATOS_API.md)

## Perfil de jugador

### Obtener perfil de jugador

`GET /api/profile/{username}` — requiere Bearer token.

Devuelve logros desbloqueados y estadisticas agregadas del jugador indicado. El `username`
identifica el recurso en la ruta, pero no se repite en el body de respuesta. Mismo payload para el
propio perfil o para el de otro jugador.

**Path params:**

| Campo | Tipo | Descripcion                                         |
|-------|------|-----------------------------------------------------|
| Nota  | -    | La busqueda actual del backend es case-insensitive. |

**Respuesta 200:**

```json
{
  "achievements": [
    {
      "achievementCode": "WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO",
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
- La busqueda actual es case-insensitive.
- Las stats son eventual-consistent: se actualizan después de que el evento
  `MATCH_FINISHED`, `MATCH_ABANDONED` o `MATCH_FORFEITED` es procesado por el backend.
- Solo se computan partidas PvP humanas en las **estadísticas** (bots excluidos de `matchesPlayed`,
  `matchesWon`, `matchesLost`, `winRate`). Los **logros sí se desbloquean** en partidas contra bots.
- El abandono cuenta como derrota para el abandoner y victoria para el rival.

### Logros disponibles

La siguiente tabla lista todos los `achievementCode` que pueden desbloquearse:

| achievementCode                                                   | Descripción                                                                                                                                                                                        |
|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `WIN_GAME_AS_PIE_MANO_BUSTS_ON_ENVIDO_WITH_0_0_AT_2_2`            | Ganar un game siendo pie (segundo jugador) cuando el jugador mano se pasa de 3 con los puntos en el game, con ambos jugadores en 0 tantos de envido (todas figuras) y score 2-2 en el game         |
| `WIN_GAME_AS_MANO_VIA_FALTA_ENVIDO_WITH_33_33_AT_2_2`             | Ganar un game siendo mano mediante falta envido con empate en 33-33 tantos (el empate se resuelve a favor del mano), con score 2-2 en el game                                                      |
| `WIN_GAME_BUST_OPPONENT_VIA_QUIERO_Y_ME_VOY_AL_MAZO`              | Ganar un game porque el oponente responde "quiero y me voy al mazo" y se pasa de 3 puntos                                                                                                          |
| `WIN_HAND_UNCONTESTED_WITH_ANCHO_DE_ESPADA`                       | Ganar una mano por cierre automático al jugar el 1 de espada (ancho de espada), sin que el rival haya jugado carta en esa mano                                                                     |
| `FOLD_BEFORE_ANY_CARD_IS_PLAYED`                                  | Irse al mazo en un round antes de que ninguno de los dos jugadores haya jugado ninguna carta                                                                                                       |
| `WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO`                        | Ganar un game 3-0 (rival queda con 0 puntos) desde score 0-0 mediante retruco aceptado                                                                                                             |
| `WIN_GAME_THREE_ZERO_VIA_REAL_OR_FALTA_ENVIDO`                    | Ganar un game 3-0 (rival queda con 0 puntos) desde score 0-0 mediante un único canto de real envido o falta envido                                                                                 |
| `WIN_GAME_FROM_2_2_WITHOUT_CALLS_IN_ROUND`                        | Ganar un game desde score 2-2 en un round donde no se cantó ni envido ni truco                                                                                                                     |
| `WIN_GAME_BUST_OPPONENT_VIA_VALE_CUATRO_LOSS_AT_0_0`              | Ganar un game porque el oponente pierde el round con vale cuatro aceptado (recibe 4 puntos, se pasa de 3), con score 0-0 en el game                                                                |
| `WIN_GAME_BUST_RIVAL_VIA_FOLD_AFTER_ACCEPTED_TRUCO_WITH_NO_CARDS` | Ganar un game haciendo que el rival se pase de 3: cantaste truco cuando el rival no tenía cartas, el rival aceptó, y vos te fuiste al mazo dándole los puntos del truco, causando que se pase de 3 |
| `REACH_CAMPAIGN_TOP_ONE`                                          | Alcanzar el puesto `#1` del ranking del modo campaña                                                                                                                                               |
| `DEFEAT_ALL_CAMPAIGN_RIVALS`                                      | Ganarle al menos una vez a cada uno de los `100` bots del modo campaña (requiere llegar al `#1` y volver por los rivales salteados al subir)                                                       |
| `UNLOCK_ALL_CAMPAIGN_BOTS_IN_CASUAL`                              | Desbloquear los `100` bots de campaña para el modo casual, es decir tener historial neto `>= 3` a favor (`wins - losses`) contra cada uno de ellos                                                 |

### Catálogo de logros

`GET /api/achievements` — requiere Bearer token.

Devuelve la lista completa de logros existentes en el juego (sus `achievementCode`). La respuesta es
idéntica para todos los jugadores e independiente del progreso: **no** indica cuáles están
desbloqueados (eso lo da el perfil en 7.5.1) ni incluye título/descripción (los resuelve el
frontend a partir del código). No existen logros ocultos: el catálogo siempre los expone todos.

Pensado para que el frontend conozca qué logros existen sin hardcodear la lista, y arme la grilla
"todos los logros con marca de desbloqueado" cruzando este catálogo con`GET /api/profile/{username}`
por `achievementCode`.

**Request:** sin body ni parámetros.

**Respuesta 200:**

```json
{
  "achievements": [
    {
      "achievementCode": "WIN_GAME_AS_PIE_MANO_BUSTS_ON_ENVIDO_WITH_0_0_AT_2_2"
    },
    {
      "achievementCode": "WIN_GAME_AS_MANO_VIA_FALTA_ENVIDO_WITH_33_33_AT_2_2"
    },
    {
      "achievementCode": "WIN_GAME_BUST_OPPONENT_VIA_QUIERO_Y_ME_VOY_AL_MAZO"
    },
    {
      "achievementCode": "WIN_HAND_UNCONTESTED_WITH_ANCHO_DE_ESPADA"
    },
    {
      "achievementCode": "FOLD_BEFORE_ANY_CARD_IS_PLAYED"
    },
    {
      "achievementCode": "WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO"
    },
    {
      "achievementCode": "WIN_GAME_THREE_ZERO_VIA_REAL_OR_FALTA_ENVIDO"
    },
    {
      "achievementCode": "WIN_GAME_FROM_2_2_WITHOUT_CALLS_IN_ROUND"
    },
    {
      "achievementCode": "WIN_GAME_BUST_OPPONENT_VIA_VALE_CUATRO_LOSS_AT_0_0"
    },
    {
      "achievementCode": "WIN_GAME_BUST_RIVAL_VIA_FOLD_AFTER_ACCEPTED_TRUCO_WITH_NO_CARDS"
    }
  ]
}
```

Los `achievementCode` posibles son los listados en 7.5.2 / 8.3. El campo se llama igual que en el
perfil (`achievementCode`) para facilitar el cruce.

**Errores:**

| Codigo | Descripcion              |
|--------|--------------------------|
| 401    | Token ausente o inválido |

## Historial de partidas

Lista de las **últimas partidas terminadas** del usuario, vista desde su propia perspectiva (contra
quién jugó, si ganó o perdió, los juegos y cómo terminó). Es un bounded context independiente del
perfil/estadísticas: se construye reaccionando a los eventos finales que el match ya emite
(`MATCH_FINISHED`, `MATCH_ABANDONED`, `MATCH_FORFEITED`).

### Obtener mi historial

`GET /api/match-history` — requiere Bearer token.

Opera **siempre sobre el usuario autenticado** (sale del token; no recibe `userId` ni `username`).
Devuelve como máximo **5** partidas, **más reciente primero**.

**Request:** sin body ni parámetros.

**Respuesta 200:**

```json
{
  "entries": [
    {
      "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
      "opponentName": "juancho",
      "opponentIsBot": false,
      "outcome": "WON",
      "endReason": "FINISHED",
      "ownGamesWon": 3,
      "opponentGamesWon": 1,
      "endedAt": 1772768158123
    },
    {
      "matchId": "550e8400-e29b-41d4-a716-446655440099",
      "opponentName": "Cacho Toledo",
      "opponentIsBot": true,
      "outcome": "LOST",
      "endReason": "ABANDONED",
      "ownGamesWon": 1,
      "opponentGamesWon": 3,
      "endedAt": 1772768000000
    }
  ]
}
```

| Campo                        | Tipo    | Descripción                                                               |
|------------------------------|---------|---------------------------------------------------------------------------|
| `entries`                    | array   | Hasta 5 partidas, ordenadas por `endedAt` descendente                     |
| `entries[].matchId`          | string  | Identificador de la partida                                               |
| `entries[].opponentName`     | string  | Username del rival, o `displayName` si es bot (`Invitado` si no resuelve) |
| `entries[].opponentIsBot`    | boolean | `true` si el rival fue un bot                                             |
| `entries[].outcome`          | string  | Resultado para el jugador: `WON` o `LOST`                                 |
| `entries[].endReason`        | string  | Cómo terminó: `FINISHED`, `ABANDONED` o `FORFEITED`                       |
| `entries[].ownGamesWon`      | int     | Juegos ganados por el jugador                                             |
| `entries[].opponentGamesWon` | int     | Juegos ganados por el rival                                               |
| `entries[].endedAt`          | long    | Fecha de fin (epoch millis)                                               |

**Notas:**

- Eventual-consistent: se actualiza después de que el evento final del match es procesado.
- Incluye **todas** las partidas terminadas, también las jugadas **contra bots** (el bot no tiene
  historial propio; solo el jugador registrado lo acumula).
- El abandono/forfeit cuenta como derrota para quien lo provocó y victoria para el rival.
- Los guests no tienen historial (devuelve `entries: []`).

**Errores:**

| Codigo | Descripcion              |
|--------|--------------------------|
| 401    | Token ausente o inválido |

## Presencia / reconexión del usuario

Permite al frontend saber, tras un refresco de página o reconexión, **dónde está ocupado** el
usuario autenticado, para llevarlo de vuelta al recurso correcto (partida, liga, copa o revancha)
con los identificadores necesarios.

### Obtener presencia

`GET /api/me/presence`

Opera **siempre sobre el usuario autenticado** (sale del token; no recibe `userId`). Es de **solo
lectura**: no modifica partidas, ligas, copas, revanchas ni cola Quick Match, ni reinicia sus
temporizadores de inactividad.

Response `200`:

```json
{
  "busy": true,
  "match": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "IN_PROGRESS"
  },
  "league": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "IN_PROGRESS",
    "currentMatchId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "cup": null,
  "rematch": null,
  "quickMatch": null,
  "spectating": null,
  "ownedBotMatch": null
}
```

- `busy` es `true` si y solo si al menos uno de `match`, `league`, `cup`, `rematch`, `quickMatch`,
  `spectating` u `ownedBotMatch` es no-nulo.
- Cada dominio en el que el usuario **no** está ocupado se devuelve como `null` explícito (nunca se
  omite la clave).
- `match`: partida **no finalizada** del usuario (estados `WAITING_FOR_PLAYERS`, `READY` o
  `IN_PROGRESS`; nunca `FINISHED`/`CANCELLED`). Trae `id` y `status`.
- `league` / `cup`: torneo en espera o en progreso. Traen `id`, `status` y `currentMatchId`. El
  `currentMatchId` solo es no-null cuando el torneo está `IN_PROGRESS`, y coincide con `match.id`
  (la partida del torneo aparece en **ambos** dominios).
- `rematch`: sesión de revancha abierta. Trae `id` (de la sesión) y `originMatchId` (partida de
  origen).
- `quickMatch`: busqueda Quick Match activa en la cola runtime. Trae `status = SEARCHING` y
  `enqueuedAt`. No persiste en DB ni sobrevive a refresco/desconexion; desaparece al cancelar,
  matchear o desconectarse la sesion WebSocket asociada.
- `spectating`: match que el usuario esta mirando activamente. Trae `matchId`. Es no-nulo
  mientras el usuario tenga al menos una suscripcion STOMP activa a `/user/queue/match-spectate`.
  Util para redirigir al espectador al match correcto al cargar desde un nuevo dispositivo/pestaña.
- `ownedBotMatch`: partida **bot-vs-bot** (_Crear partida entre dos
  bots_ ([08-bots.md](08-bots.md))) de la que el usuario es **dueño** y que aún no
  terminó. Trae `matchId` y `status`. Marca ocupación por **autoría**, independiente de `spectating`
  (mirar es opcional). Si además la está espectando, `spectating` y `ownedBotMatch` apuntan al mismo
  `matchId`. Pasa a `null` automáticamente cuando la partida llega a un estado terminal, liberando
  al creador.

Usuario sin ocupación alguna:

```json
{
  "busy": false,
  "match": null,
  "league": null,
  "cup": null,
  "rematch": null,
  "quickMatch": null,
  "spectating": null
}
```

Usuario buscando Quick Match:

```json
{
  "busy": true,
  "match": null,
  "league": null,
  "cup": null,
  "rematch": null,
  "quickMatch": {
    "status": "SEARCHING",
    "enqueuedAt": "2026-05-20T10:00:00Z"
  },
  "spectating": null
}
```

Usuario especteando un match:

```json
{
  "busy": true,
  "match": null,
  "league": null,
  "cup": null,
  "rematch": null,
  "quickMatch": null,
  "spectating": {
    "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7"
  }
}
```

Errores:

- `401` sin token o token inválido

### Presencia en tiempo real (push)

`GET /api/me/presence` resuelve el **arranque en frío** (la foto al cargar/reconectar). Para
mantener sincronizadas las sesiones ya abiertas mientras la ocupación cambia, el backend **empuja**
los cambios por WebSocket/STOMP a la cola de usuario:

`/user/queue/presence`

Un mismo usuario puede tener la sesión iniciada en varios lugares (pestañas/dispositivos). Cuando su
ocupación **cambia** (entra/sale de Quick Match, entra a una partida, su liga/copa arranca o avanza,
se abre/cierra una revancha, empieza/termina de spectear un match, o se libera al finalizar),
**todas** sus sesiones activas —incluida la que originó el cambio— reciben un mensaje con el
snapshot completo de presencia, para derivar al recurso correcto (p. ej., una sesión ociosa que no
entró al match igual se entera y deriva ahí).

Mensaje empujado:

```json
{
  "eventType": "PRESENCE_UPDATED",
  "timestamp": 1717612800000,
  "payload": {
    "busy": true,
    "match": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "IN_PROGRESS"
    },
    "league": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "status": "IN_PROGRESS",
      "currentMatchId": "550e8400-e29b-41d4-a716-446655440000"
    },
    "cup": null,
    "rematch": null,
    "quickMatch": null,
    "spectating": null
  }
}
```

- `payload` tiene **exactamente el mismo shape** que el body de `GET /api/me/presence`
  (`UserPresenceResponse`): `busy` + `match`/`league`/`cup`/`rematch`/`quickMatch`/`spectating`
  (objeto u `null`).
- Las notificaciones llegan **solo** a las sesiones del propio usuario (nunca a terceros).
- Es **solo lectura**: emitir el push no modifica partidas/ligas/copas/revanchas ni reinicia sus
  temporizadores de inactividad.
- **Complementa, no reemplaza** a `GET /api/me/presence`: el stream cubre los cambios **posteriores
  **
  a la suscripción; el arranque en frío y la reconciliación ante un mensaje perdido se resuelven con
  la consulta pull (entrega best-effort).
- **Bots** quedan fuera. Quick Match genera push mientras existe un ticket de cola; al matchear, la
  partida creada genera el push de `match`.

## Modo Campaña

Modo single-player de progresión contra un ranking fijo de `100` bots ordenados por puntos. El
objetivo es alcanzar el puesto `#1`. El jugador arranca con `0` puntos en el fondo del ranking.

Reglas de negocio:

- Solo **usuarios registrados** pueden jugar el modo campaña: iniciar un desafío con un token de
  invitado (`guest`) se rechaza con `401`.
- Solo puede desafiarse al bot **inmediatamente superior** en el ranking. Alcanzado el `#1`, se
  desbloquea desafiar a **cualquier** bot.
- Todos los enfrentamientos son al **mejor de 5** games. Las partidas de campaña **no** ofrecen
  revancha.
- Puntos por victoria: `100 x (games_ganador - games_perdedor)` → 3-0 = `300`, 3-1 = `200`,
  3-2 = `100`. La **derrota no descuenta** puntos y los puntos nunca son negativos.
- La posición se deriva de los puntos: para superar a un bot hay que tener **estrictamente más**
  puntos que él (empatar no alcanza).
- Cada cruce queda registrado en un head-to-head por rival (`wins`/`losses`).
- Llegar al `#1` desbloquea `REACH_CAMPAIGN_TOP_ONE`; ganarle al menos una vez a cada uno de los
  `100` bots desbloquea `DEFEAT_ALL_CAMPAIGN_RIVALS`.
- Alcanzar historial neto `>= 3` a favor (`wins - losses`) contra un bot lo **desbloquea para el
  modo casual** de forma **permanente** (no se revierte aunque el neto vuelva a bajar). Las partidas
  casuales **no** afectan el head-to-head de campaña. Desbloquear los `100` otorga
  `UNLOCK_ALL_CAMPAIGN_BOTS_IN_CASUAL`. Cada desbloqueo emite por WebSocket un evento
  `CAMPAIGN_BOT_UNLOCKED` (payload `{ botId, matchId }`).

Los bots de campaña **no** aparecen en la lista `casual` de `GET /api/bots`; aparecen en la lista
`campaignUnlocked` solo una vez desbloqueados por el jugador (ver _Listar bots disponibles_
en [08-bots.md](08-bots.md)).

### Obtener la campaña

`GET /api/campaign` — requiere Bearer token.

Devuelve el ranking completo (los `100` bots más el jugador intercalado en su posición real), el
progreso del jugador y qué rival es desafiable. Si el jugador nunca jugó campaña, se devuelve el
estado inicial (posición `101`, `0` puntos) sin necesidad de inicializarla.

**Respuesta 200:**

```json
{
  "playerPosition": 42,
  "playerPoints": 14230,
  "totalBots": 100,
  "defeatedRivals": 58,
  "topOneReached": false,
  "allRivalsDefeated": false,
  "pointsToNextPosition": 370,
  "activeChallengeMatchId": null,
  "ranking": [
    {
      "position": 41,
      "participantId": "c0000000-0000-0000-0000-000000000041",
      "displayName": "Cacho Toledo",
      "points": 14600,
      "player": false,
      "challengeable": true,
      "record": {
        "wins": 0,
        "losses": 1
      }
    },
    {
      "position": 42,
      "participantId": "0c9f...e1",
      "displayName": null,
      "points": 14230,
      "player": true,
      "challengeable": false,
      "record": null
    }
  ]
}
```

| Campo                     | Tipo           | Descripción                                                                   |
|---------------------------|----------------|-------------------------------------------------------------------------------|
| `playerPosition`          | int            | Posición del jugador en el ranking (1 = cima)                                 |
| `playerPoints`            | int            | Puntos acumulados del jugador (nunca negativos)                               |
| `totalBots`               | int            | Cantidad de bots del ranking (`100`)                                          |
| `defeatedRivals`          | int            | Cantidad de bots distintos a los que el jugador le ganó al menos una vez      |
| `topOneReached`           | boolean        | `true` si el jugador alcanzó alguna vez el `#1`                               |
| `allRivalsDefeated`       | boolean        | `true` si le ganó al menos una vez a cada uno de los `100` bots               |
| `pointsToNextPosition`    | int \| null    | Puntos faltantes para superar al rival inmediato; `null` si ya está `#1`      |
| `activeChallengeMatchId`  | string \| null | `matchId` del desafío en curso, o `null` si no hay ninguno                    |
| `ranking`                 | array          | Ranking ordenado por posición ascendente, con el jugador intercalado          |
| `ranking[].player`        | boolean        | `true` en la fila del propio jugador (`displayName` y `record` van `null`)    |
| `ranking[].challengeable` | boolean        | `true` si ese bot puede desafiarse ahora                                      |
| `ranking[].record`        | object \| null | Head-to-head contra ese bot (`wins`/`losses`); `null` si nunca se enfrentaron |

**Errores:**

| Codigo | Descripcion              |
|--------|--------------------------|
| 401    | Token ausente o inválido |

### Desafiar a un rival

`POST /api/campaign/challenges` — requiere Bearer token de **usuario registrado** (los invitados no
pueden jugar el modo campaña; ver errores).

Crea una partida al mejor de `5` contra el rival desafiable y la marca como partida de campaña (sin
revancha). El body es **opcional**:

- Sin body (o `botId` ausente): se desafía al bot inmediatamente superior.
- Con `botId`: solo se acepta cuando el jugador ya alcanzó el `#1`; permite elegir cualquier rival.

**Request (opcional):**

```json
{
  "botId": "c0000000-0000-0000-0000-000000000041"
}
```

**Respuesta 200:**

```json
{
  "matchId": "550e8400-e29b-41d4-a716-446655440099",
  "rivalId": "c0000000-0000-0000-0000-000000000041",
  "rivalName": "Cacho Toledo",
  "rivalPosition": 41
}
```

El `matchId` se juega por el flujo de match existente (`/api/matches/...` y la cola
`/user/queue/match`). Al terminar, el backend acredita los puntos, emite un push
`CAMPAIGN_MATCH_POINTS` por `/user/queue/campaign` con los puntos conseguidos (ver sección 9), y
emite los pushes de perfil si se desbloquea algún logro.

**Errores:**

| Codigo | Descripcion                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|
| 400    | `botId` requerido (el jugador ya está `#1` y no hay rival inmediato) o body inválido                 |
| 401    | Token ausente o inválido, o el token pertenece a un invitado (solo usuarios registrados)             |
| 404    | `botId` no corresponde a un bot del ranking de campaña                                               |
| 422    | Desafío no permitido: el bot no es el inmediato superior (antes del `#1`) o ya hay un desafío activo |

## WebSocket (Profile y Campaign)

> Transporte (conexión, auth, envelope): ver [09-websocket.md](09-websocket.md). La presencia en
> tiempo real (`/user/queue/presence`, `PRESENCE_UPDATED`) está documentada arriba en
> [Presencia en tiempo real (push)](#presencia-en-tiempo-real-push).

### eventType - Profile (`/user/queue/profile`, usuarios registrados)

Envelope:

```json
{
  "eventType": "ACHIEVEMENT_UNLOCKED",
  "timestamp": 1772768158123,
  "payload": {
    "achievementCode": "WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO",
    "unlockedAt": 1772768158123,
    "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
    "gameNumber": 1
  }
}
```

- `ACHIEVEMENT_UNLOCKED` - logro desbloqueado para el usuario autenticado.
  Payload: `{ achievementCode, unlockedAt, matchId, gameNumber }`

Reglas:

- los logros **sí se evalúan en partidas contra bots**: el jugador humano puede desbloquear
  achievements jugando contra un bot
- el bot no recibe logros (no es usuario registrado)
- el abandono cuenta como derrota para el abandoner y victoria para el rival

### eventType - Campaign (`/user/queue/campaign`)

Se emite **al terminar** cada match de campaña (victoria o derrota), post-commit, solo al jugador.
Informa los puntos conseguidos en ese match, el total acumulado y el movimiento de posición en el
ranking. En una derrota, `pointsAwarded` es `0` y `previousPosition`/`newPosition` no cambian.

```json
{
  "eventType": "CAMPAIGN_MATCH_POINTS",
  "timestamp": 1772768158123,
  "payload": {
    "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
    "rivalId": "c0000000-0000-0000-0000-000000000041",
    "won": true,
    "pointsAwarded": 300,
    "totalPoints": 14230,
    "previousPosition": 42,
    "newPosition": 39
  }
}
```

- `CAMPAIGN_MATCH_POINTS` - puntos al terminar un match de campaña.
  Payload: `{ matchId, rivalId, won, pointsAwarded, totalPoints, previousPosition, newPosition }`
- `CAMPAIGN_BOT_UNLOCKED` - desbloqueo de un bot de campaña para el modo casual.
  Payload: `{ botId, matchId }`
