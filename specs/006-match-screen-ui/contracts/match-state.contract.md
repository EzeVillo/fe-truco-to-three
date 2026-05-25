# Contrato — `MatchStateResponse` (referencia para la feature 006)

**Fuente autoritativa**: [`docs/CONTRATOS_API.md §4.14`](../../../docs/CONTRATOS_API.md)

Este archivo es una **copia anotada** del contrato consumido por la pantalla de match en
esta etapa (mock-only). Si el contrato cambia, **se actualiza primero
`docs/CONTRATOS_API.md`** y luego los fixtures + tipos del front (regla constitución II).

## Endpoint asociado (no se llama en esta feature)

`GET /api/matches/{matchId}` — Auth: Bearer requerido.

## Forma del payload (`MatchStateResponse`)

```jsonc
{
  "matchId": "uuid",
  "status": "IN_PROGRESS | FINISHED | ABANDONED",
  "viewerSeat": "PLAYER_ONE | PLAYER_TWO",   // NUEVO en este ciclo
  "playerOneUsername": "string",             // NUEVO
  "playerTwoUsername": "string",             // NUEVO
  "gamesToPlay": 1 | 3 | 5,                  // NUEVO — partidas totales de la serie
  "scorePlayerOne": 0,                        // 0..3 del game actual
  "scorePlayerTwo": 0,                        // 0..3 del game actual
  "gamesWonPlayerOne": 0,
  "gamesWonPlayerTwo": 0,
  "matchWinner": null | "string",
  "roundGame": null | {
    "status": "IN_PROGRESS | FINISHED",
    "currentTurn": null | "string",          // username
    "myCards": [ { "suit": "ESPADA|COPA|BASTO|ORO", "number": 1..12 } ],
    "roundStatus": "PLAYING | FINISHED | ...",
    "currentTrucoCall": null | "TRUCO|RETRUCO|VALE_CUATRO",
    "winner": null | "string",
    "availableActions": [ { "type": "PLAY_CARD | CALL_TRUCO | ..." } ],
    "playedHands": [
      {
        "cardPlayerOne": null | Card,
        "cardPlayerTwo": null | Card,
        "winner": null | "string"
      }
    ],
    "currentHand": {
      "cardPlayerOne": null | Card,
      "cardPlayerTwo": null | Card,
      "mano": "string"
    }
  }
}
```

## Campos consumidos por la UI de esta feature

| Campo | Usado por |
|---|---|
| `matchId` | Header (debug, log) |
| `status` | `deriveStatusText` |
| `viewerSeat` | `deriveMatchView` (raíz del mapeo viewer-relative) |
| `playerOneUsername`, `playerTwoUsername` | `deriveMatchView`, `deriveStatusText` |
| `gamesToPlay` | `MatchStatusPanel` (etiqueta "Mejor de N") |
| `scorePlayerOne`, `scorePlayerTwo` | `MatchStatusPanel` (marcador) |
| `gamesWonPlayerOne`, `gamesWonPlayerTwo` | `MatchStatusPanel` (progreso de serie, si `gamesToPlay > 1`) |
| `roundGame.currentTurn` | `deriveStatusText`, `MatchStatusPanel` |
| `roundGame.myCards` | `PlayerHand` (vía `self.handCards`) |
| `roundGame.playedHands` | `PlayedCardsArea` (vía `self.playedInPreviousHands` y `opponent.playedInPreviousHands`) |
| `roundGame.currentHand.cardPlayerOne/Two` | `PlayedCardsArea` (carta en curso) |
| `roundGame.roundStatus` | `deriveStatusText` |

## Campos presentes pero NO renderizados (deben venir igual en el mock)

- `matchWinner` → siempre `null` en los fixtures (todos son partidas en curso o vacías).
- `roundGame.currentTrucoCall` → `null` en todos los fixtures.
- `roundGame.winner` → `null` mientras `roundStatus !== 'FINISHED'`.
- `roundGame.availableActions` → `[]` en los fixtures (la UI sólo tiene placeholder).

## Test de paridad

`src/tests/contract/match-state-shape.contract.spec.ts`:

1. Verifica con `satisfies MatchState` que cada fixture cumple el tipo extendido.
2. Verifica que cada fixture contiene **todas** las claves de top-level del payload
   (matchId, status, viewerSeat, playerOneUsername, playerTwoUsername, gamesToPlay,
   scorePlayerOne, scorePlayerTwo, gamesWonPlayerOne, gamesWonPlayerTwo, matchWinner,
   roundGame).
3. Cuando `roundGame !== null`, verifica que contiene **todas** las claves de
   `RoundState` (status, currentTurn, myCards, roundStatus, currentTrucoCall, winner,
   availableActions, playedHands, currentHand) — incluso las que la UI no renderiza.

## Estado de implementación BE

> El BE todavía no expone los campos nuevos (`viewerSeat`, `playerOneUsername`,
> `playerTwoUsername`, `gamesToPlay`). Implementación pendiente del owner del backend.
> Esta feature trabaja contra mocks que ya cumplen el contrato actualizado; cuando el BE
> los exponga, reemplazar el provider del mock por `HttpClient.get<MatchState>(...)` es
> el único cambio del data source.
