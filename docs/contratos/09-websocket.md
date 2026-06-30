# WebSocket / STOMP

> [← Volver al índice de contratos](../CONTRATOS_API.md)

Este documento cubre el **transporte**: cómo conectarse, autenticarse, qué suscripciones existen y
la forma común de los eventos. Los `eventType` y payloads concretos de cada recurso están
documentados en el doc de su dominio:

| Recurso                          | Destino STOMP                                    | Documento                                                                                                                                      |
|----------------------------------|--------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Match (juego, rematch, deadline) | `/user/queue/match`, `/user/queue/match-derived` | [02-matches.md](02-matches.md#websocket)                                                                                                       |
| Spectate                         | `/user/queue/match-spectate`                     | [02-matches.md](02-matches.md#websocket)                                                                                                       |
| Lobby público                    | `/topic/public-*-lobby`                          | [02-matches.md](02-matches.md#websocket) (match), [03-leagues.md](03-leagues.md#websocket) (liga), [04-copas.md](04-copas.md#websocket) (copa) |
| Liga                             | `/user/queue/league`                             | [03-leagues.md](03-leagues.md#websocket)                                                                                                       |
| Copa                             | `/user/queue/cup`                                | [04-copas.md](04-copas.md#websocket)                                                                                                           |
| Chat                             | `/user/queue/chat`                               | [05-chat.md](05-chat.md#websocket)                                                                                                             |
| Social                           | `/user/queue/social`                             | [06-social.md](06-social.md#websocket)                                                                                                         |
| Profile (logros)                 | `/user/queue/profile`                            | [07-perfil-presencia.md](07-perfil-presencia.md#websocket-profile-y-campaign)                                                                  |
| Campaign                         | `/user/queue/campaign`                           | [07-perfil-presencia.md](07-perfil-presencia.md#websocket-profile-y-campaign)                                                                  |
| Presencia                        | `/user/queue/presence`                           | [07-perfil-presencia.md](07-perfil-presencia.md#presencia-en-tiempo-real-push)                                                                 |

## Endpoints de conexion

- WebSocket nativo: `/ws`
- SockJS: `/ws-sockjs`

Broker/prefijos:

- `setApplicationDestinationPrefixes`: `/app`
- `setUserDestinationPrefix`: `/user`
- Broker habilitado en: `/topic`, `/queue`

Nota: no hay `@MessageMapping` para mensajes cliente->server.

## Autenticacion WS

En frame STOMP `CONNECT` enviar header:

- `Authorization: Bearer <jwt>`

El token debe contener `sub` (playerId).

## Suscripciones permitidas

Suscripciones permitidas por interceptor:

- `/user/queue/match` - eventos de match
- `/user/queue/match-derived` - notificaciones derivadas de match (acciones disponibles, cartas)
- `/user/queue/match-spectate` - alta y eventos de espectador
- `/user/queue/league` - eventos de liga
- `/user/queue/cup` - eventos de copa
- `/user/queue/chat` - eventos de chat en tiempo real
- `/user/queue/social` - eventos de amistades e invitaciones
- `/user/queue/profile` - eventos de logros del perfil
- `/user/queue/campaign` - resultado de puntos al terminar un match de campaña (
  `CAMPAIGN_MATCH_POINTS`) y desbloqueo de un bot de campaña para el modo casual
  (`CAMPAIGN_BOT_UNLOCKED`, payload `{ botId, matchId }`)
- `/user/queue/presence` - cambios de presencia/ocupación del usuario (`PRESENCE_UPDATED`)

- `/topic/public-match-lobby` - stream compartido del lobby publico de matches
- `/topic/public-cup-lobby` - stream compartido del lobby publico de copas
- `/topic/public-league-lobby` - stream compartido del lobby publico de ligas

Cualquier otro destino se rechaza

Para `/user/queue/match-spectate`, ademas del destino hay que enviar en la `SUBSCRIBE`:

- header nativo `matchId: <uuid>`

## Forma del evento WS

Todos los eventos comparten el mismo envelope. El id del recurso (`matchId`, `leagueId`, `cupId`,
`chatId`) es un campo **top-level**, no va dentro de `payload`:

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
- Solo los eventos transicionales de match llevan `stateVersion`. Los eventos derivados
  (`/user/queue/match-derived`), los del temporizador y los de otros recursos (liga, copa, chat,
  social, profile) **no** lo llevan y no deben usarse para detectar huecos.

Eventos derivados (`/user/queue/match-derived`) usan el mismo envelope pero sin `stateVersion`:

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

Excepcion a la regla del id top-level: los eventos de lobby publico **no** llevan
`matchId`/`leagueId`/`cupId` top-level; el id va dentro de `payload.lobby` para `UPSERT` o en
`payload.id` para `REMOVED`.
