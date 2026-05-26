# Contratos de Interfaz: Estado de partida en tiempo real vía WebSocket

**Feature**: `008-match-ws-state` | **Fecha**: 2026-05-26

> Fuente autoritativa: `docs/CONTRATOS_API.md` §4.14, §9.3–§9.6

---

## 1. REST — Estado inicial

### `GET /api/matches/{matchId}`

**Auth**: `Bearer <jwt>`

**Response `200`**:

```json
{
  "matchId": "uuid",
  "status": "IN_PROGRESS",
  "viewerSeat": "PLAYER_ONE",
  "playerOneUsername": "string",
  "playerTwoUsername": "string | null",
  "gamesToPlay": 1 | 3 | 5,
  "scorePlayerOne": 0,
  "scorePlayerTwo": 0,
  "gamesWonPlayerOne": 0,
  "gamesWonPlayerTwo": 0,
  "matchWinner": "string | null",
  "stateVersion": 0,
  "roundGame": {
    "status": "IN_PROGRESS | FINISHED",
    "currentTurn": "string | null",
    "myCards": [{ "suit": "ESPADA|BASTO|COPA|ORO", "number": 1 }],
    "roundStatus": "PLAYING | ENVIDO_IN_PROGRESS | TRUCO_IN_PROGRESS | FINISHED",
    "currentTrucoCall": "TRUCO | RETRUCO | VALE_CUATRO | null",
    "winner": "string | null",
    "availableActions": [{ "type": "PLAY_CARD | CALL_TRUCO | ..." }],
    "playedHands": [
      { "cardPlayerOne": "Card | null", "cardPlayerTwo": "Card | null", "winner": "string | null" }
    ],
    "currentHand": {
      "cardPlayerOne": "Card | null",
      "cardPlayerTwo": "Card | null",
      "mano": "string"
    }
  }
}
```

**Errores**:
- `404` si la partida no existe
- `422` si el jugador no pertenece a la partida

---

## 2. WebSocket — Canal transaccional

### Canal: `/user/queue/match`

**Tipo base del evento**:
```json
{
  "matchId": "uuid",
  "eventType": "CARD_PLAYED",
  "timestamp": 1772768158123,
  "payload": { ... },
  "stateVersion": 6
}
```

### Lógica de reconciliación en el cliente

```
Al recibir evento con stateVersion = V:
  Si V <= lastApplied          → DESCARTAR (ya procesado)
  Si V == lastApplied + 1      → APLICAR reducer; lastApplied = V
  Si V  > lastApplied + 1      → GAP; re-fetch GET /api/matches/{matchId}
```

### Eventos de fin de partida (disparan diálogo de resultado)

| `eventType`      | Payload                                                                        |
|------------------|--------------------------------------------------------------------------------|
| `MATCH_FINISHED` | `{ winnerSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`                        |
| `MATCH_ABANDONED`| `{ winnerSeat, abandonerSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`         |
| `MATCH_FORFEITED`| `{ winnerSeat, loserSeat, gamesWonPlayerOne, gamesWonPlayerTwo }`             |

---

## 3. WebSocket — Canal derivado

### Canal: `/user/queue/match-derived`

> ⚠️ **Discrepancia documentada**: este canal no aparece en §9.3 del contrato; su existencia se asume per spec. Actualizar `CONTRATOS_API.md §9.3` una vez confirmado con backend.

**Tipo base del evento** (sin `stateVersion`):
```json
{
  "matchId": "uuid",
  "eventType": "AVAILABLE_ACTIONS_UPDATED",
  "timestamp": 1772768158123,
  "payload": { ... }
}
```

| `eventType`                | Payload                                                    | Acción en cliente            |
|----------------------------|------------------------------------------------------------|------------------------------|
| `AVAILABLE_ACTIONS_UPDATED`| `{ seat, availableActions: [{ type }] }`                  | Reemplaza `availableActions` |
| `PLAYER_HAND_UPDATED`      | `{ seat, cards: [{ suit, number }] }`                      | Reemplaza `myCards`          |

Los eventos derivados se aplican **siempre directamente**, sin validación de secuencia.

---

## 4. Restricciones observadas

- **Enums case-sensitive**: `ESPADA`, `QUIERO`, `FALTA_ENVIDO`, etc.
- `stateVersion` es un entero que solo aparece en eventos transaccionales; los derivados no lo llevan.
- `roundGame` es `null` si `status !== 'IN_PROGRESS'`.
- `myCards` contiene solo las cartas del jugador autenticado; el oponente no tiene `myCards`.
