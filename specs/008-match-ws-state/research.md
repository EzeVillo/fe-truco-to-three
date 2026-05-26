# Research: Estado de partida en tiempo real vía WebSocket

**Feature**: `008-match-ws-state` | **Fecha**: 2026-05-26

---

## 1. Patrón de Integración WebSocket: Delta Reducer

### Decisión
Implementar el patrón **subscribe-first + delta reducer** confirmado por el usuario en el input de la feature.

### Rationale
- El backend emite un `stateVersion` monotónico por evento transaccional. Esto permite detectar huecos y duplicados sin lógica custom.
- Un reducer puro `(MatchState, MatchWsEvent) → MatchState` es trivialmente testeable y elimina bugs de mutación.
- Suscribirse al canal **antes** de la consulta REST evita la ventana de pérdida de eventos durante la carga inicial.

### Orden de operaciones en bootstrap
1. Conectar WS (ya activo vía `WebSocketService`).
2. Suscribirse a `/user/queue/match` y comenzar a **bufferizar** eventos transaccionales.
3. Suscribirse a `/user/queue/match-derived` y **bufferizar** eventos derivados.
4. Llamar a `GET /api/matches/{matchId}` → obtener snapshot con `stateVersion = N`.
5. Drenar buffer transaccional: descartar `event.stateVersion ≤ N`, aplicar los restantes en orden.
6. Drenar buffer derivado: aplicar todos en orden.
7. Pasar a modo live (aplicar eventos a medida que llegan).

### Detección de huecos
- `lastApplied = N` (initialState.stateVersion tras el GET).
- Al recibir evento: si `event.stateVersion > lastApplied + 1` → **hueco** → re-fetch REST.
- Si `event.stateVersion == lastApplied + 1` → aplicar y avanzar `lastApplied`.
- Si `event.stateVersion <= lastApplied` → descartar (ya procesado o duplicado).

### Alternativas descartadas
- **Full snapshot en cada evento**: sobrecarga de red y latencia innecesaria.
- **CRDT / OT**: complejidad excesiva para este dominio; el backend ya garantiza orden con `stateVersion`.

---

## 2. Canal `/user/queue/match-derived` — Discrepancia en el Contrato

### Hallazgo
La sección `9.3` (Suscripciones permitidas) de `docs/CONTRATOS_API.md` **no lista** `/user/queue/match-derived`. Sin embargo, las secciones `9.4`, `9.5` y `9.5.b` la documentan con eventos `AVAILABLE_ACTIONS_UPDATED` y `PLAYER_HAND_UPDATED`.

### Resolución adoptada
Se asume que la omisión en §9.3 es un **error de documentación**. El spec `008-match-ws-state/spec.md` §Assumptions afirma explícitamente que el canal ya está disponible y funcionando en el backend.

**Acción**: Actualizar `docs/CONTRATOS_API.md §9.3` para incluir `/user/queue/match-derived`.

---

## 3. Eventos Derivados (sin `stateVersion`)

### Decisión
Los eventos derivados (`AVAILABLE_ACTIONS_UPDATED`, `PLAYER_HAND_UPDATED`) se aplican directamente al estado sin validación de secuencia, tal como indica FR-007.

**Racional**: El backend los emite como consecuencia determinista de eventos transaccionales ya procesados; la ausencia de `stateVersion` es intencional. Aplicarlos siempre es seguro: el peor caso es una actualización redundante.

---

## 4. Diálogo de Fin de Partida — Reutilización del Componente

### Decisión
Los eventos `MATCH_FINISHED`, `MATCH_ABANDONED` y `MATCH_FORFEITED` abren el mismo componente `RoundWonDialogComponent` con `matchFinished: true`.

### Mapeo de payload a `RoundWonDialogData`
Dado que el `viewerSeat` está disponible en el `MatchState` al momento de recibir el evento:

| Campo `RoundWonDialogData` | Fuente                                               |
|----------------------------|------------------------------------------------------|
| `playerName`               | `state.playerOneUsername` o `playerTwoUsername` según `viewerSeat` |
| `opponentName`             | El username del asiento opuesto                      |
| `playerRoundsWon`          | `gamesWonPlayerOne` o `gamesWonPlayerTwo` según `viewerSeat` |
| `opponentRoundsWon`        | El `gamesWon` del asiento opuesto                    |
| `roundsToPlay`             | `state.gamesToPlay`                                  |
| `roundNumber`              | `gamesWonPlayerOne + gamesWonPlayerTwo` (total jugados) |
| `matchFinished`            | `true`                                               |
| `localWonMatch`            | `event.payload.winnerSeat === state.viewerSeat`      |

### Por qué reusar en lugar de crear un componente nuevo
El usuario explicitó: "la pantalla de abandono sera la misma que la de ronda finalizada". Los datos del servidor (`winnerSeat`, `gamesWon*`) se mapean limpiamente a la interfaz existente de `RoundWonDialogData`.

---

## 5. Reducer: Estrategia de Actualización Parcial

### Decisión
El reducer implementa **actualización mínima**: cada caso modifica solo los campos que el evento específico autoriza a cambiar. Los campos no mencionados en el payload del evento se preservan del estado anterior.

### Eventos transaccionales y sus mutaciones en `MatchState`

| Evento            | Campos que modifica                                                         |
|-------------------|-----------------------------------------------------------------------------|
| `CARD_PLAYED`     | `roundGame.currentHand.cardPlayer{One\|Two}` según `seat`                  |
| `TURN_CHANGED`    | `roundGame.currentTurn` (resuelto a username desde `viewerSeat`)            |
| `TRUCO_CALLED`    | `roundGame.currentTrucoCall`, `roundGame.roundStatus = TRUCO_IN_PROGRESS`   |
| `TRUCO_RESPONDED` | `roundGame.roundStatus = PLAYING`, `roundGame.currentTrucoCall` (escalado)  |
| `ENVIDO_CALLED`   | `roundGame.roundStatus = ENVIDO_IN_PROGRESS`                                |
| `ENVIDO_RESOLVED` | `roundGame.roundStatus = PLAYING`                                           |
| `SCORE_CHANGED`   | `scorePlayerOne`, `scorePlayerTwo`                                          |
| `GAME_SCORE_CHANGED` | `gamesWonPlayerOne`, `gamesWonPlayerTwo`                                 |
| `ROUND_STARTED`   | `roundGame.playedHands = []`, reset `currentHand`, `roundStatus = PLAYING`, `currentTrucoCall = null`, `winner = null`, `myCards = []` |
| `ROUND_ENDED`     | `roundGame.winner`, `roundGame.status = FINISHED`                           |
| `GAME_STARTED`    | `scorePlayerOne = 0`, `scorePlayerTwo = 0`, `roundGame = null`              |
| `HAND_RESOLVED`   | Agrega a `roundGame.playedHands`, resetea `roundGame.currentHand`           |
| `HAND_DEALT`      | `roundGame.myCards` (solo si `seat === viewerSeat`)                         |
| `MATCH_FINISHED`  | `status = FINISHED`, `matchWinner`, `gamesWon*`                             |
| `MATCH_ABANDONED` | `status = FINISHED`, `matchWinner`, `gamesWon*`                             |
| `MATCH_FORFEITED` | `status = FINISHED`, `matchWinner`, `gamesWon*`                             |
| `FOLDED`          | No-op (el puntaje llega por `SCORE_CHANGED`)                                |
| `HAND_CHANGED`    | No-op (payload vacío por contrato; la mano real llega por `HAND_DEALT`)     |
| Demás eventos     | No-op hasta que el backend confirme payload adicional                       |

### Derivados

| Evento                     | Campos que modifica        |
|----------------------------|----------------------------|
| `AVAILABLE_ACTIONS_UPDATED` | `roundGame.availableActions` |
| `PLAYER_HAND_UPDATED`      | `roundGame.myCards`        |

---

## 6. Resolución de username desde `seat`

El payload de varios eventos incluye `seat: 'PLAYER_ONE' | 'PLAYER_TWO'`. Para convertirlo a username se usa:

```typescript
const usernameFromSeat = (seat: Seat, state: MatchState): string =>
  seat === 'PLAYER_ONE' ? state.playerOneUsername : state.playerTwoUsername;
```

Este helper se ubica en el reducer, no en la UI.

---

## 7. Reconexión WebSocket

### Decisión
Al reconectar (`WebSocketService.connected` emite `true` tras haber emitido `false`):
1. Re-suscribirse a los canales de match.
2. Re-iniciar el proceso de bootstrap (buffer + GET REST).

El `WebSocketService` ya tiene `reconnectDelay: 5000` configurado; la re-suscripción es responsabilidad de `MatchStateService`.

---

## 8. Gestión del estado `loading`

Durante el bootstrap (pasos 1–6) el componente muestra un spinner. La señal `loading` pasa a `false` exactamente cuando el estado inicial está disponible y el buffer drenado.

---

## 9. Tests

### Cobertura mínima requerida
- **Reducer**: un test por cada tipo de evento que modifica estado. Tests de idempotencia (mismo evento, mismo resultado).
- **Servicio**: mocks de `WebSocketService` y `HttpClient`; verificar que los eventos con `stateVersion ≤ snapshot` se descartan; verificar que gaps disparan re-fetch.
- **Componente**: que el spinner aparezca en estado `loading`; que el diálogo se abra al recibir `MATCH_FINISHED`.

### Conservación de mocks
Los archivos `src/app/features/match/mocks/` se conservan para los tests. Solo se eliminan de la UI de producción.
