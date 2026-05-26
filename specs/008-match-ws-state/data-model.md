# Data Model: Estado de partida en tiempo real vía WebSocket

**Feature**: `008-match-ws-state` | **Fecha**: 2026-05-26

---

## 1. Tipos existentes (sin cambios)

Los siguientes tipos ya existen en `src/app/core/models/match.models.ts` y se reutilizan sin modificación:

- `MatchState` — snapshot completo de una partida
- `RoundState` — estado del juego actual dentro de la partida
- `Card`, `PlayedHand`, `CurrentHand`, `AvailableAction`
- `ViewerSeat` = `'PLAYER_ONE' | 'PLAYER_TWO'`
- `MatchStatus`, `RoundStatus`, `TrucoCall`, `AvailableActionType`, `Suit`, `Seat`

---

## 2. Nuevas entidades — `MatchWsEvent`

### Ubicación
`src/app/features/match/models/match-ws-events.ts`

### Tipo base

```typescript
export interface MatchWsEvent<TPayload = unknown> {
  matchId: string;
  eventType: MatchEventType;
  timestamp: number; // epochMillis
  payload: TPayload;
  stateVersion: number; // solo en eventos transaccionales
}
```

### Enum de tipos de evento

```typescript
export type MatchEventType =
  | 'CARD_PLAYED'
  | 'TURN_CHANGED'
  | 'TRUCO_CALLED'
  | 'TRUCO_RESPONDED'
  | 'ENVIDO_CALLED'
  | 'ENVIDO_RESOLVED'
  | 'SCORE_CHANGED'
  | 'ROUND_STARTED'
  | 'ROUND_ENDED'
  | 'GAME_STARTED'
  | 'GAME_SCORE_CHANGED'
  | 'MATCH_FINISHED'
  | 'MATCH_ABANDONED'
  | 'MATCH_FORFEITED'
  | 'FOLDED'
  | 'HAND_RESOLVED'
  | 'HAND_DEALT'
  | 'HAND_CHANGED'
  | 'SPECTATOR_COUNT_CHANGED'
  | 'PLAYER_JOINED'
  | 'PLAYER_READY'
  | 'MATCH_CANCELLED'
  | 'MATCH_PLAYER_LEFT'
  | 'REMATCH_AVAILABLE'
  | 'REMATCH_OPPONENT_WANTS'
  | 'REMATCH_CONFIRMED'
  | 'REMATCH_CLOSED_BY_LEAVE'
  | 'REMATCH_EXPIRED';
```

### Payloads por evento (tipos específicos)

```typescript
// Fuente: CONTRATOS_API.md §9.6
export interface CardPlayedPayload  { seat: Seat; card: Card }
export interface TurnChangedPayload { seat: Seat }
export interface TrucoCalledPayload { callerSeat: Seat; call: TrucoCall }
export interface TrucoRespondedPayload { responderSeat: Seat; response: TrucoResponse; call: TrucoCall }
export interface EnvidoCalledPayload { callerSeat: Seat; call: EnvidoCall }
export interface EnvidoResolvedPayload {
  response: EnvidoResponse;
  winnerSeat: Seat;
  pointsMano?: number;
  pointsPie?: number;
}
export interface ScoreChangedPayload { scorePlayerOne: number; scorePlayerTwo: number }
export interface RoundStartedPayload { roundNumber: number; manoSeat: Seat }
export interface RoundEndedPayload   { winnerSeat: Seat }
export interface GameStartedPayload  { gameNumber: number }
export interface GameScoreChangedPayload { gamesWonPlayerOne: number; gamesWonPlayerTwo: number }
export interface MatchFinishedPayload {
  winnerSeat: Seat;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
}
export interface MatchAbandonedPayload {
  winnerSeat: Seat;
  abandonerSeat: Seat;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
}
export interface MatchForfeitedPayload {
  winnerSeat: Seat;
  loserSeat: Seat;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
}
export interface FoldedPayload        { seat: Seat }
export interface HandResolvedPayload  {
  cardPlayerOne: Card | null;
  cardPlayerTwo: Card | null;
  winnerSeat: Seat;
}
export interface HandDealtPayload     { seat: Seat; cards: Card[] }
```

### Tipo derivado (sin `stateVersion`)

```typescript
export interface MatchDerivedEvent<TPayload = unknown> {
  matchId: string;
  eventType: MatchDerivedEventType;
  timestamp: number;
  payload: TPayload;
}

export type MatchDerivedEventType =
  | 'AVAILABLE_ACTIONS_UPDATED'
  | 'PLAYER_HAND_UPDATED';

export interface AvailableActionsUpdatedPayload {
  seat: Seat;
  availableActions: AvailableAction[];
}
export interface PlayerHandUpdatedPayload {
  seat: Seat;
  cards: Card[];
}
```

---

## 3. Estado interno del servicio

### `MatchLoadingState`
Estado de carga del `MatchStateService` (solo para uso interno del servicio):

```typescript
type BootstrapPhase =
  | 'idle'        // Antes de iniciar
  | 'buffering'   // Suscrito a WS, esperando snapshot REST
  | 'ready'       // Listo para recibir eventos live
  | 'error';      // Error irrecuperable en carga inicial
```

### Señales expuestas por `MatchStateService`

| Señal           | Tipo                  | Descripción                                     |
|-----------------|-----------------------|-------------------------------------------------|
| `state`         | `Signal<MatchState \| null>` | Estado actual de la partida             |
| `loading`       | `Signal<boolean>`     | `true` durante el bootstrap                     |
| `error`         | `Signal<boolean>`     | `true` si el GET inicial falló                  |
| `matchEnded$`   | `Observable<MatchEndedEvent>` | Emite al recibir MATCH_FINISHED/ABANDONED/FORFEITED |

### `MatchEndedEvent` (para el diálogo de resultado)

```typescript
export interface MatchEndedEvent {
  winnerSeat: Seat;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
  reason: 'FINISHED' | 'ABANDONED' | 'FORFEITED';
}
```

---

## 4. Interfaz del Reducer

### Ubicación
`src/app/features/match/reducers/match-event.reducer.ts`

```typescript
/**
 * Aplica un evento transaccional al estado actual.
 * Función pura — sin efectos secundarios.
 */
export function applyMatchEvent(
  state: MatchState,
  event: MatchWsEvent
): MatchState;

/**
 * Aplica un evento derivado al estado actual.
 * Función pura — sin efectos secundarios.
 */
export function applyMatchDerivedEvent(
  state: MatchState,
  event: MatchDerivedEvent
): MatchState;
```

---

## 5. Modificaciones a `MatchState` (ninguna)

La interfaz `MatchState` ya cubre todos los campos necesarios. No se requieren cambios en `match.models.ts`.

El campo `stateVersion` del snapshot REST se gestiona **internamente** en `MatchStateService` y no se agrega a `MatchState` para no contaminar la vista.

---

## 6. Modelo para `RoundWonDialogData` — Mapeo desde eventos de fin de partida

El mapeo se realiza en `MatchScreenComponent` al recibir el observable `matchEnded$`:

```
playerName     ← viewerSeat === 'PLAYER_ONE'
                  ? state.playerOneUsername
                  : state.playerTwoUsername

opponentName   ← viewerSeat === 'PLAYER_ONE'
                  ? state.playerTwoUsername
                  : state.playerOneUsername

playerRoundsWon  ← viewerSeat === 'PLAYER_ONE'
                    ? event.gamesWonPlayerOne
                    : event.gamesWonPlayerTwo

opponentRoundsWon ← viewerSeat === 'PLAYER_ONE'
                     ? event.gamesWonPlayerTwo
                     : event.gamesWonPlayerOne

roundsToPlay   ← state.gamesToPlay

roundNumber    ← event.gamesWonPlayerOne + event.gamesWonPlayerTwo

matchFinished  ← true

localWonMatch  ← event.winnerSeat === state.viewerSeat
```

---

## 7. Diagrama de flujo de bootstrap

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MatchStateService.init(matchId)                                         │
│                                                                           │
│  1. wsService.subscribe('/user/queue/match')     → buffer[]              │
│  2. wsService.subscribe('/user/queue/match-derived') → derivedBuffer[]   │
│     (paralelo)                                                            │
│  3. http.get('/api/matches/{matchId}')           → snapshot (stateVer=N) │
│  4. Drenar buffer:                                                        │
│     • event.stateVersion ≤ N  → descartar                                │
│     • event.stateVersion == lastApplied+1 → aplicar applyMatchEvent()   │
│     • event.stateVersion > lastApplied+1  → GAP → re-fetch REST         │
│  5. Drenar derivedBuffer: applyMatchDerivedEvent() para todos            │
│  6. loading = false, bootstrap = 'ready'                                  │
│  7. Live: cada evento nuevo → mismo proceso de deduplicación/gap         │
└─────────────────────────────────────────────────────────────────────────┘
```
