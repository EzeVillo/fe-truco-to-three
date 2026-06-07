# Contract: Spectate (FE)

Contrato que el frontend consume para espectar partidas de amigos. Fuente autoritativa:
`docs/CONTRATOS_API.md` §4.15, §4.16, §7.4.5, §9.3, §9.5g, §9.6, §11.2. Este documento es el
espejo del FE para el test de contrato `src/tests/contract/spectate.contract.spec.ts`.

## 1. Descubrimiento — `GET /api/social/friendships` (§7.4.5)

Cada `FriendSummaryResponse` incluye `spectatableMatch`:

```json
{
  "friendUsername": "martina",
  "online": true,
  "availability": "BUSY",
  "busyReason": "IN_MATCH",
  "spectatableMatch": { "id": "550e8400-...-440000", "status": "IN_PROGRESS" }
}
```

- `spectatableMatch` es `null` si el amigo no tiene partida en curso espectable.
- `spectatableMatch.id` se usa como header `matchId` del `SUBSCRIBE`.
- Deltas en vivo: `FRIEND_AVAILABILITY_CHANGED` (§9.6) incluye `spectatableMatch`, y el snapshot
  `FRIEND_AVAILABILITY_STATE` lo trae por amigo.

## 2. Alta de espectador (WebSocket-first) — §4.16 / §9.3

1. STOMP conectado con `Authorization: Bearer <jwt>`.
2. `SUBSCRIBE` a `/user/queue/match-spectate` **con header nativo `matchId: <uuid>`**.
3. El backend registra al espectador y emite `SPECTATE_STATE`.
4. A partir de ahí, `GET /api/matches/{matchId}/spectate` refresca el mismo snapshot.

Reglas de negocio (el FE no las valida, las respeta vía error copy):
- el match debe estar `IN_PROGRESS`;
- amistad confirmada con un jugador (o misma liga/copa);
- un jugador no puede espectar su propio match ni dos a la vez;
- `UNSUBSCRIBE`/desconexión → el backend desregistra (re-alta necesaria, §11.2).

## 3. Snapshot REST — `GET /api/matches/{matchId}/spectate` (§4.15)

Vista pública: **sin** `myCards` ni `availableActions`.

```json
{
  "matchId": "8b9c5936-...-89f6f7",
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
    "currentEnvidoCall": null,
    "winner": null,
    "playedHands": [
      { "cardPlayerOne": { "suit": "ORO", "number": 3 },
        "cardPlayerTwo": { "suit": "COPA", "number": 5 },
        "winner": "juancho" }
    ],
    "currentHand": { "cardPlayerOne": null, "cardPlayerTwo": null, "mano": "martina" },
    "actionDeadline": 1772768188123,
    "turnDurationMillis": 30000,
    "actionDeadlineSeat": "PLAYER_ONE"
  },
  "spectatorCount": 3
}
```

Errores: `404` (match inexistente), `422` (no registrado como espectador).

> **D1 resuelto**: el contrato §4.15 incluye `playerOneUsername`, `playerTwoUsername` (`null` si no
> hay rival sentado) y `gamesToPlay` (best-of). El FE los tipa directo y no necesita fallback.

## 4. Eventos WS — `/user/queue/match-spectate` (§9.5g / §9.6)

| eventType                 | payload                          | Uso en FE                                  |
|---------------------------|----------------------------------|--------------------------------------------|
| `SPECTATE_STATE`          | `{ matchState }`                 | snapshot inicial / re-alta (registra).     |
| `SPECTATE_ERROR`          | `{ error }`                      | alta rechazada → `spectateErrorCopy()`.    |
| `SPECTATOR_COUNT_CHANGED` | `{ spectatorCount }`             | actualiza contador (FR-007).               |
| `CARD_PLAYED`             | `{ seat, card }`                 | re-difundido; aplica al estado.            |
| `TURN_CHANGED`            | `{ seat }`                       | re-difundido.                              |
| `TRUCO_CALLED`            | `{ callerSeat, call }`           | re-difundido.                              |
| `TRUCO_RESPONDED`         | `{ responderSeat, response, call }` | re-difundido.                           |
| `ENVIDO_CALLED`           | `{ callerSeat, call }`           | re-difundido.                              |
| `ENVIDO_RESOLVED`         | `{ response, winnerSeat, ... }`  | re-difundido.                              |
| `SCORE_CHANGED`           | `{ scorePlayerOne, scorePlayerTwo }` | re-difundido.                          |
| `ROUND_STARTED`/`ROUND_ENDED` | `{ ... }`                    | re-difundido.                              |
| `GAME_STARTED`/`GAME_SCORE_CHANGED` | `{ ... }`              | re-difundido.                              |
| `FOLDED`                  | `{ seat }`                       | re-difundido.                              |
| `MATCH_FINISHED`/`MATCH_ABANDONED`/`MATCH_FORFEITED` | `{ ... }` | fin de partida → resultado + CTA volver.   |
| `ACTION_DEADLINE_SET`     | `{ seat, actionDeadline, turnDurationMillis }` | temporizador del turno.      |
| `ACTION_DEADLINE_CLEARED` | `{}`                             | detiene el reloj.                          |

**No** se re-difunden al espectador (§9.5g): `PLAYER_HAND_UPDATED`, `AVAILABLE_ACTIONS_UPDATED`.

## 5. Reconexión — §11.2

Tras corte/`UNSUBSCRIBE`, la sesión de spectate no sobrevive. Re-conectar STOMP, re-suscribir a
`/user/queue/match-spectate` con `matchId`, esperar `SPECTATE_STATE`. No asumir sesión viva: un
`GET /spectate` tras perderla responde `422`.

## 6. Presencia, busy y cross-device — §4.16 / §7.6.1 / §7.6.2

- **Busy**: estar especteando deja al usuario en `busy = true` (§4.16). El BE impide crear/unirse a
  partidas, buscar Quick Match y aceptar invitaciones sociales mientras haya spectate activo.
- **`spectating` en presencia**: `GET /api/me/presence` y el push `PRESENCE_UPDATED`
  (`/user/queue/presence`) incluyen `spectating: { matchId } | null` (no-nulo mientras haya ≥1
  suscripción STOMP a `/user/queue/match-spectate`). `busy` es `true` sii algún dominio es no-nulo.

```json
{ "busy": true, "match": null, "league": null, "cup": null,
  "rematch": null, "quickMatch": null,
  "spectating": { "matchId": "8b9c5936-...-89f6f7" } }
```

- **Cross-device**: suscribir el mismo `matchId` desde otra sesión/dispositivo es idempotente; el BE
  desregistra al espectador solo cuando cae la **última** sesión. El FE usa `spectating.matchId` para
  redirigir a `/spectate/:matchId` al cargar/reconectar (research D10).
- **`busyReason = SPECTATING`** (§7.4.5): los amigos ven a quien especta como `BUSY` con motivo
  `SPECTATING`; el FE lo mapea a copy ("Mirando una partida"). Ya existe en el contrato; falta en el
  enum del front.

## 7. Error copy (FE) — Constitution

- WS `SPECTATE_ERROR.error`: nunca mostrar crudo → `spectateErrorCopy()` (mensaje genérico).
- REST `/spectate` `404`/`422`: scope `SPECTATE` en `getErrorCopy()`.
