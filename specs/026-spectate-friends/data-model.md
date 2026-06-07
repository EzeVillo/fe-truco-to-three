# Phase 1 Data Model: Espectar partidas de amigos

Tipos nuevos y ediciones de tipos existentes. Fuente autoritativa: `docs/CONTRATOS_API.md`
(§4.15 vista REST de spectate, §7.4.5 `spectatableMatch`, §9.6 payloads WS). Verificación de
contrato obligatoria antes de tipar (ver research D1).

## 1. Tipos nuevos — `core/models/spectate.models.ts`

### `SpectatableMatch`

Partida espectable de un amigo, tal como llega en la lista de amigos y sus deltas (§7.4.5).

| Campo    | Tipo                              | Notas                                              |
|----------|-----------------------------------|----------------------------------------------------|
| `id`     | `string` (UUID)                   | `matchId` para el header `matchId` del `SUBSCRIBE`. |
| `status` | `'IN_PROGRESS'`                   | Solo se espectan partidas en curso (§4.16).        |

> `spectatableMatch` es `null` cuando el amigo no tiene partida en curso espectable.

### `SpectateRoundState`

Ronda en la vista pública (§4.15 `currentRound`). **No** incluye `myCards` ni `availableActions`.

| Campo                | Tipo                              | Notas                                          |
|----------------------|-----------------------------------|------------------------------------------------|
| `status`             | `'IN_PROGRESS' \| 'FINISHED'`     |                                                |
| `currentTurn`        | `string \| null`                  | username del que tiene el turno.               |
| `roundStatus`        | `RoundStatus`                     | reusa enum existente.                          |
| `currentTrucoCall`   | `TrucoCall \| null`               |                                                |
| `currentEnvidoCall`  | `EnvidoCall \| null`              |                                                |
| `winner`             | `string \| null`                  | username.                                      |
| `playedHands`        | `PlayedHand[]`                    | reusa tipo existente.                          |
| `currentHand`        | `CurrentHand`                     | reusa tipo existente (`mano` = username).      |
| `actionDeadline`     | `number \| null`                  | epochMillis (§4.18).                           |
| `turnDurationMillis` | `number \| null`                  |                                                |
| `actionDeadlineSeat` | `ViewerSeat \| null`              | asiento al que aplica el reloj.                |

### `SpectateMatchState`

Snapshot público del match (§4.15 + `SPECTATE_STATE` §9.6). Incluye `stateVersion` para
reconciliación.

| Campo                | Tipo                          | Notas                                              |
|----------------------|-------------------------------|----------------------------------------------------|
| `matchId`            | `string`                      |                                                    |
| `status`             | `MatchStatus`                 |                                                    |
| `scorePlayerOne`     | `number`                      | puntaje del game actual (nivel match).             |
| `scorePlayerTwo`     | `number`                      |                                                    |
| `gamesWonPlayerOne`  | `number`                      |                                                    |
| `gamesWonPlayerTwo`  | `number`                      |                                                    |
| `matchWinner`        | `string \| null`              | username.                                          |
| `stateVersion`       | `number`                      | reconciliación + detección de huecos.              |
| `currentRound`       | `SpectateRoundState \| null`  | `null` si `status !== 'IN_PROGRESS'`.              |
| `spectatorCount`     | `number`                      | cantidad de espectadores (FR-007).                 |
| `playerOneUsername`  | `string`                      | roster asiento→nombre (§4.15, D1 resuelto).        |
| `playerTwoUsername`  | `string \| null`              | `null` si todavía no hay rival sentado (§4.15).    |
| `gamesToPlay`        | `1 \| 3 \| 5`                 | formato de serie best-of (§4.15, D1 resuelto).     |

> D1 resuelto por contrato: `playerOneUsername`, `playerTwoUsername` (nullable) y `gamesToPlay` ya
> figuran en §4.15. El adapter usa el roster real (sin fallback "Jugador 1/2").

## 2. Eventos WS — `core/models/ws.models.ts` (EDIT)

### `SpectateWsEvent` (nuevo union)

Canal `/user/queue/match-spectate` (§9.5g/§9.6). `matchId` es top-level.

- `SPECTATE_STATE` → payload `{ matchState: SpectateMatchState }`
- `SPECTATE_ERROR` → payload `{ error: string }` (el `error` crudo **no** se muestra; ver D6)
- `SPECTATOR_COUNT_CHANGED` → payload `{ spectatorCount: number }`
- Eventos públicos re-difundidos: reusan las variantes de `MatchWsEvent` (mismos payloads
  seat-based) + `ACTION_DEADLINE_SET`/`ACTION_DEADLINE_CLEARED`.

### `FriendAvailabilitySnapshotItem` y `FriendAvailabilityDelta` (EDIT)

Agregar campo:

| Campo              | Tipo                       | Notas                                  |
|--------------------|----------------------------|----------------------------------------|
| `spectatableMatch` | `SpectatableMatch \| null` | §9.6: los deltas ya lo incluyen.       |

## 3. Modelo social — `core/models/social.models.ts` (EDIT)

`FriendSummary` agrega:

| Campo              | Tipo                       | Notas                                                  |
|--------------------|----------------------------|--------------------------------------------------------|
| `spectatableMatch` | `SpectatableMatch \| null` | §7.4.5. Reemplaza la nota "fuera de alcance" de 025.   |

`FriendBusyReason` agrega el valor `'SPECTATING'` (ya existe en §7.4.5; falta en el front).

Reglas de reconciliación (extienden data-model de 024/025):
- `mergeAvailability` conserva/actualiza `spectatableMatch` junto con `online`/`availability`/`busyReason`.
- `upsertFriend` (amigo recién aceptado) inicializa `spectatableMatch: null` (default conservador).
- Identidad sigue siendo `friendUsername` (case-insensitive).

`busyReasonCopy` ([error-copy.ts]) agrega `case 'SPECTATING' → 'Mirando una partida'`.

## 3b. Presencia — `core/models/presence.models.ts` (EDIT)

Para el contexto único + retorno cross-device + estado busy (§7.6.1/§7.6.2, research D10/D11):

### `PresenceSpectating` (nuevo)

| Campo     | Tipo            | Notas                                        |
|-----------|-----------------|----------------------------------------------|
| `matchId` | `string` (UUID) | match que el usuario está mirando.           |

### `UserPresenceResponse` (EDIT)

| Campo        | Tipo                          | Notas                                              |
|--------------|-------------------------------|----------------------------------------------------|
| `spectating` | `PresenceSpectating \| null`  | no-nulo mientras haya ≥1 suscripción de spectate.  |

### `PresenceDestination` (EDIT) y `derivePresenceDestination`

- Agregar variante `{ kind: 'spectate'; matchId: string }`.
- `derivePresenceDestination`: si `presence.spectating` → `{ kind: 'spectate', matchId }`
  (después de las ramas `match`/`rematch`, mutuamente excluyentes).
- `PresenceCoordinatorService.targetUrl`: `case 'spectate' → /spectate/${matchId}`.

## 4. Estado de la pantalla — `SpectateStateService` (signals)

| Signal            | Tipo                          | Notas                                                       |
|-------------------|-------------------------------|-------------------------------------------------------------|
| `state`           | `SpectateMatchState \| null`  | snapshot público vigente.                                   |
| `loading`         | `boolean`                     | durante alta inicial / re-alta por reconexión.              |
| `error`           | `string \| null`              | copy del front (SPECTATE_ERROR o REST).                     |
| `serverClockOffsetMs` | `number`                  | offset reloj servidor↔cliente para el temporizador (§4.18). |

Transiciones:
- `init(matchId)`: connect WS → subscribe `/user/queue/match-spectate` con header `matchId` →
  esperar `SPECTATE_STATE` (registra + snapshot). En paralelo puede refrescar por REST.
- `SPECTATE_STATE` → reemplaza `state`, fija `stateVersion`, `loading=false`.
- evento público en orden (`stateVersion == last+1`) → `applyMatchEvent` sobre el estado adaptado.
- hueco de `stateVersion` o `SPECTATOR_COUNT_CHANGED` desfasado → re-fetch `GET /spectate`.
- `SPECTATE_ERROR` → `error = spectateErrorCopy(...)`, no registra; la pantalla vuelve a `/friends`.
- reconexión (`connected` true tras false) → re-subscribe con header + `loading=true`.
- `MATCH_FINISHED/ABANDONED/FORFEITED` → marca fin (la pantalla muestra resultado y CTA volver).
- `destroy()`: unsubscribe (el BE desregistra al hacer UNSUBSCRIBE, §11.2).

## 5. Adapter — `adapt-spectate-to-match-view.ts`

`SpectateMatchState → MatchState` (entrada de `deriveMatchView`):
- `viewerSeat = 'PLAYER_ONE'` (perspectiva neutra de render; ver research D3).
- `roundGame = currentRound` mapeado con `myCards: []`, `availableActions: []`.
- `playerOneUsername`/`playerTwoUsername` por copia directa del roster (D1 resuelto).
- el resto (scores, gamesWon, matchWinner, gamesToPlay) por copia directa.
