# Phase 1 — Data Model: Match Screen UI base

**Feature**: 006-match-screen-ui · **Fecha**: 2026-05-25

## 1. Tipos extendidos en `core/models/match.models.ts`

Se extiende `MatchState` con los 4 campos del contrato §4.14:

```ts
export type ViewerSeat = 'PLAYER_ONE' | 'PLAYER_TWO';

export interface MatchState {
  matchId: string;
  status: MatchStatus;
  // --- NUEVOS (contrato §4.14, agregados en este ciclo) ---
  viewerSeat: ViewerSeat;
  playerOneUsername: string;
  playerTwoUsername: string;
  gamesToPlay: 1 | 3 | 5;
  // --- existentes ---
  scorePlayerOne: number;
  scorePlayerTwo: number;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
  matchWinner: string | null;
  roundGame: RoundState | null;
}
```

> `RoundState`, `PlayedHand`, `CurrentHand`, `AvailableAction`, `Card` permanecen como están
> hoy. La feature no introduce cambios en esos tipos.

## 2. Tipos de presentación (uso interno de la feature)

Viven en `src/app/features/match/utils/derive-match-view.ts`. NO se exportan al resto de la
app — son detalle de implementación de la pantalla.

```ts
export interface SeatView {
  seat: ViewerSeat;             // 'PLAYER_ONE' | 'PLAYER_TWO'
  username: string;
  score: number;                // 0..3 (game actual)
  gamesWon: number;             // 0..2 en BEST_OF_3, 0..3 en BEST_OF_5
  handCards: Card[] | null;     // null si no se conocen (siempre null para opponent)
  handCount: number;            // 0..3 — cuántas cartas restan en mano
  playedInCurrentHand: Card | null;
  playedInPreviousHands: (Card | null)[]; // length === roundGame.playedHands.length
}

export interface MatchView {
  matchId: string;
  status: MatchStatus;
  gamesToPlay: 1 | 3 | 5;
  seriesLabel: string;          // 'Mejor de N' derivado de gamesToPlay
  self: SeatView;
  opponent: SeatView;
  currentTurnIsSelf: boolean | null; // null si roundGame == null o currentTurn == null
  roundStatus: RoundStatus | null;
  playedHandsCount: number;
}
```

## 3. Contrato de funciones puras

### 3.1 `deriveMatchView(state: MatchState): MatchView`

**Entrada**: `MatchState` completo (con los 4 campos nuevos).

**Salida**: `MatchView` viewer-relative.

**Reglas**:
1. `self.seat = state.viewerSeat`; `opponent.seat` es el opuesto.
2. `self.username = state.viewerSeat === 'PLAYER_ONE' ? state.playerOneUsername : state.playerTwoUsername`. Idem `opponent` con el opuesto.
3. `self.score / opponent.score` se mapean desde `scorePlayerOne / scorePlayerTwo` según seat.
4. `self.gamesWon / opponent.gamesWon` idem con `gamesWonPlayerOne / gamesWonPlayerTwo`.
5. Si `roundGame == null`:
   - `self.handCards = null`, `self.handCount = 0`, `opponent.handCount = 0`.
   - `playedInCurrentHand = null`, `playedInPreviousHands = []`.
   - `currentTurnIsSelf = null`, `roundStatus = null`, `playedHandsCount = 0`.
6. Si `roundGame != null`:
   - `self.handCards = roundGame.myCards` (siempre del jugador autenticado).
   - `self.handCount = 3 - playedBySelf` donde `playedBySelf` cuenta cuántas cartas
     puso el viewer en `playedHands` + 1 si hay carta en `currentHand` del viewer.
   - `opponent.handCount` análogo pero para el oponente. `opponent.handCards = null`.
   - `self.playedInCurrentHand = currentHand.cardPlayerOne|Two` según seat del viewer.
   - `opponent.playedInCurrentHand` análogo para el opuesto.
   - `self.playedInPreviousHands = playedHands.map(h => seatCard(h, self.seat))`.
   - `opponent.playedInPreviousHands = playedHands.map(h => seatCard(h, opponent.seat))`.
   - `currentTurnIsSelf = currentTurn === self.username ? true : currentTurn === opponent.username ? false : null`.
   - `playedHandsCount = playedHands.length`.
7. `seriesLabel`: `{1: 'Mejor de 1', 3: 'Mejor de 3', 5: 'Mejor de 5'}[gamesToPlay]`.

**Invariantes verificables en tests**:
- Para todo `MatchState` válido: `self.handCount + playedBySelf === 3` cuando hay
  `roundGame`.
- `playedInPreviousHands.length === playedHandsCount` para `self` y `opponent`.
- `deriveMatchView({ ...state, viewerSeat: 'PLAYER_ONE' })` produce `self` con el username
  de player one; cambiando a `PLAYER_TWO` se intercambian `self` y `opponent` simétricamente.

### 3.2 `deriveStatusText(state: MatchState): string`

Reglas exactas detalladas en `research.md` D5. Función pura, sin dependencias de Angular.

## 4. Forma del módulo de fixtures

`src/app/features/match/mocks/match-state.mocks.ts`:

```ts
import type { MatchState } from '@core/models/match.models';

export const mockMatchViewerPlayerOne: MatchState = { /* ... */ };
export const mockMatchViewerPlayerTwo: MatchState = { /* ... */ };
export const mockMatchEmptyTable: MatchState = { /* ... */ };
export const mockMatchAsymmetricHand: MatchState = { /* ... */ };
```

Cada fixture **debe** incluir todos los campos top-level de `MatchState` y todos los campos
de `RoundState` cuando aplique. Campos sin valor → `null` o `[]`, nunca omitidos (FR-010).

`src/app/features/match/mocks/index.ts` expone:

```ts
export type FixtureKey =
  | 'viewer-player-one'
  | 'viewer-player-two'
  | 'empty-table'
  | 'asymmetric-hand';

export const DEFAULT_FIXTURE: FixtureKey = 'viewer-player-one';

export function getFixture(key: string | null | undefined): MatchState {
  // mapea key conocido → fixture; cualquier otro valor → DEFAULT_FIXTURE
}
```

## 5. Detalle de cada fixture

| Fixture | viewerSeat | gamesToPlay | Estado relevante |
|---|---|---|---|
| `mockMatchViewerPlayerOne` | `PLAYER_ONE` | `3` | Mid-game, scores `1 - 0`, `gamesWon 0/0`, 1 mano jugada (ganada por el viewer), `currentHand` vacía, `currentTurn = playerOneUsername`, `myCards` con 2 cartas restantes. |
| `mockMatchViewerPlayerTwo` | `PLAYER_TWO` | `3` | Espejo del anterior con `viewerSeat = PLAYER_TWO`. Sirve para validar FR-018 visualmente. |
| `mockMatchEmptyTable` | `PLAYER_ONE` | `1` | `playedHands = []`, `currentHand` toda en `null`, `myCards` con 3 cartas, `currentTurn = playerOneUsername`. |
| `mockMatchAsymmetricHand` | `PLAYER_ONE` | `5` | `playedHands` con 1 mano cerrada, `currentHand` con `cardPlayerOne` puesta y `cardPlayerTwo: null` (oponente todavía no respondió). `myCards` con 1 carta restante. |

Los valores concretos de `Card` se eligen de `public/cards/` existentes
(`1_espada.png`, `7_oro.png`, etc.) para que rendericen sin 404.

## 6. Validaciones

- `pnpm test` corre:
  - `derive-match-view.spec.ts` — 8–12 casos sobre los 4 fixtures.
  - `derive-status-text.spec.ts` — tabla de casos por (status, roundGame, currentTurn).
  - `match-state-shape.contract.spec.ts` — `satisfies MatchState` sobre cada fixture +
    presencia de los 4 campos nuevos.
  - `card-view.component.spec.ts` — render con/sin carta.
  - `match-screen.component.spec.ts` — selección de fixture por query param.

- `pnpm lint:styles` y `pnpm lint:themes` cubren los archivos nuevos por glob existente.
