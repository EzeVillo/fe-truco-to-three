# Phase 1 — Data Model

**Feature**: 001-auth-models-foundation
**Fecha**: 2026-05-23

Este documento describe **todas las entidades** que la feature introduce o reemplaza, su forma exacta en TypeScript, sus validaciones y, cuando aplica, sus transiciones. La fuente de verdad para los formatos del backend es `docs/CONTRATOS_API.md`.

---

## 1. Auth

Archivo destino: `src/app/core/models/auth.models.ts`

### 1.1 Requests

```ts
export interface RegisterRequest {
  username: string;   // [A-Za-z0-9]+, ≥3 letras
  password: string;   // ≥5 chars, ≥1 número, ≥1 símbolo
}

export interface LoginRequest {
  username: string;
  password: string;
}

// GuestRequest no existe: POST /api/auth/guest no lleva body.

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}
```

### 1.2 Responses

```ts
/** Respuesta de register, login y refresh. */
export interface FullAuthResponse {
  playerId: string;                  // UUID
  accessToken: string;               // JWT
  refreshToken: string;              // token opaco
  accessTokenExpiresIn: number;      // segundos
  refreshTokenExpiresIn: number;     // segundos
}

/** Respuesta de POST /api/auth/guest (sin refreshToken). */
export interface GuestAuthResponse {
  playerId: string;
  accessToken: string;
  accessTokenExpiresIn: number;
}

export type AuthResponse = FullAuthResponse | GuestAuthResponse;
```

### 1.3 Estado de sesión persistido

```ts
export interface AuthSession {
  playerId: string;
  accessToken: string;
  refreshToken: string | null;   // null si es guest
  isGuest: boolean;
  accessTokenExpiresAt: number;  // epochMs, derivado al recibir respuesta
}
```

**Reglas de derivación al recibir un `AuthResponse`**:

- `isGuest = !('refreshToken' in response)`.
- `accessTokenExpiresAt = Date.now() + response.accessTokenExpiresIn * 1000`.
- Si `isGuest`, `refreshToken = null`; si no, `refreshToken = response.refreshToken`.

### 1.4 Persistencia en `localStorage`

- Clave única: `tt3.session`.
- Valor: `JSON.stringify({ playerId, accessToken, refreshToken, isGuest })`. `accessTokenExpiresAt` **no** se persiste.
- Validador de lectura (type guard) descarta el blob entero si falta cualquier campo, si los tipos no son los esperados, o si `JSON.parse` falla.

### 1.5 Errores tipados

```ts
export interface ApiError {            // ErrorResponse de docs/CONTRATOS_API.md §2
  errorCode: string;
  message: string;
  timestamp: string;
  requestId?: string;
}

export type UserFacingAuthError =
  | { kind: 'invalid-credentials' }
  | { kind: 'username-taken' }
  | { kind: 'validation'; field?: string; message: string }
  | { kind: 'network' }
  | { kind: 'server'; message: string };
```

---

## 2. Match / Round / Card

Archivo destino: `src/app/core/models/match.models.ts`

Estos modelos quedan **definidos pero no consumidos** en esta feature. Sirven de cimiento para features siguientes (lobby, partida). Reflejan `docs/CONTRATOS_API.md §4.14` y §8.

```ts
import { Suit, MatchStatus, RoundStatus, TrucoCall, AvailableActionType, Seat } from './enums';

export interface Card {
  suit: Suit;       // 'ESPADA' | 'BASTO' | 'COPA' | 'ORO'
  number: number;   // 1..12 según el contrato
}

export interface PlayedHand {
  cardPlayerOne: Card | null;
  cardPlayerTwo: Card | null;
  winner: string | null;   // username del ganador de la mano
}

export interface CurrentHand {
  cardPlayerOne: Card | null;
  cardPlayerTwo: Card | null;
  mano: string;            // username del "mano" de la ronda
}

export interface AvailableAction {
  type: AvailableActionType;
}

export interface RoundState {
  status: 'IN_PROGRESS' | 'FINISHED';
  currentTurn: string | null;       // username
  myCards: Card[];                  // solo se popula en GET /matches/{id} (no en spectate)
  roundStatus: RoundStatus;
  currentTrucoCall: TrucoCall | null;
  winner: string | null;
  availableActions: AvailableAction[];
  playedHands: PlayedHand[];
  currentHand: CurrentHand;
}

export interface MatchState {
  matchId: string;
  status: MatchStatus;
  scorePlayerOne: number;
  scorePlayerTwo: number;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
  matchWinner: string | null;
  roundGame: RoundState | null;   // null si status !== 'IN_PROGRESS'
}
```

---

## 3. Enums (literal types)

Archivo destino: `src/app/core/models/enums.ts`

Todos los valores son **case‑sensitive** y reflejan exactamente el contrato (§8 de `docs/CONTRATOS_API.md`).

```ts
export const SUIT = { ESPADA: 'ESPADA', BASTO: 'BASTO', COPA: 'COPA', ORO: 'ORO' } as const;
export type Suit = typeof SUIT[keyof typeof SUIT];

export const TRUCO_CALL = { TRUCO: 'TRUCO', RETRUCO: 'RETRUCO', VALE_CUATRO: 'VALE_CUATRO' } as const;
export type TrucoCall = typeof TRUCO_CALL[keyof typeof TRUCO_CALL];

export const TRUCO_RESPONSE = {
  QUIERO: 'QUIERO',
  NO_QUIERO: 'NO_QUIERO',
  QUIERO_Y_ME_VOY_AL_MAZO: 'QUIERO_Y_ME_VOY_AL_MAZO',
} as const;
export type TrucoResponse = typeof TRUCO_RESPONSE[keyof typeof TRUCO_RESPONSE];

export const ENVIDO_CALL = { ENVIDO: 'ENVIDO', REAL_ENVIDO: 'REAL_ENVIDO', FALTA_ENVIDO: 'FALTA_ENVIDO' } as const;
export type EnvidoCall = typeof ENVIDO_CALL[keyof typeof ENVIDO_CALL];

export const ENVIDO_RESPONSE = { QUIERO: 'QUIERO', NO_QUIERO: 'NO_QUIERO' } as const;
export type EnvidoResponse = typeof ENVIDO_RESPONSE[keyof typeof ENVIDO_RESPONSE];

export const MATCH_STATUS = {
  WAITING_FOR_PLAYERS: 'WAITING_FOR_PLAYERS',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
} as const;
export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];

export const ROUND_STATUS = {
  PLAYING: 'PLAYING',
  ENVIDO_IN_PROGRESS: 'ENVIDO_IN_PROGRESS',
  TRUCO_IN_PROGRESS: 'TRUCO_IN_PROGRESS',
  FINISHED: 'FINISHED',
} as const;
export type RoundStatus = typeof ROUND_STATUS[keyof typeof ROUND_STATUS];

export const AVAILABLE_ACTION_TYPE = {
  PLAY_CARD: 'PLAY_CARD',
  CALL_TRUCO: 'CALL_TRUCO',
  CALL_ENVIDO: 'CALL_ENVIDO',
  RESPOND_TRUCO: 'RESPOND_TRUCO',
  RESPOND_ENVIDO: 'RESPOND_ENVIDO',
  FOLD: 'FOLD',
} as const;
export type AvailableActionType = typeof AVAILABLE_ACTION_TYPE[keyof typeof AVAILABLE_ACTION_TYPE];

export const SEAT = { PLAYER_ONE: 'PLAYER_ONE', PLAYER_TWO: 'PLAYER_TWO' } as const;
export type Seat = typeof SEAT[keyof typeof SEAT];

export const VISIBILITY = { PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' } as const;
export type Visibility = typeof VISIBILITY[keyof typeof VISIBILITY];
```

---

## 4. WebSocket events

Archivo destino: `src/app/core/models/ws.models.ts`

```ts
import { Seat, Suit, TrucoCall, EnvidoCall, TrucoResponse, EnvidoResponse } from './enums';

interface WsEventBase<TType extends string, TPayload> {
  eventType: TType;
  timestamp: number;
  payload: TPayload;
}

/** Eventos de match — canal /user/queue/match. matchId top-level. */
export type MatchWsEvent =
  | (WsEventBase<'CARD_PLAYED', { seat: Seat; card: { suit: Suit; number: number } }> & { matchId: string })
  | (WsEventBase<'TURN_CHANGED', { seat: Seat }> & { matchId: string })
  | (WsEventBase<'TRUCO_CALLED', { callerSeat: Seat; call: TrucoCall }> & { matchId: string })
  | (WsEventBase<'TRUCO_RESPONDED', { responderSeat: Seat; response: TrucoResponse; call: TrucoCall }> & { matchId: string })
  | (WsEventBase<'ENVIDO_CALLED', { callerSeat: Seat; call: EnvidoCall }> & { matchId: string })
  | (WsEventBase<'ENVIDO_RESOLVED', { response: EnvidoResponse; winnerSeat: Seat; pointsMano?: number; pointsPie?: number }> & { matchId: string })
  | (WsEventBase<'SCORE_CHANGED', { scorePlayerOne: number; scorePlayerTwo: number }> & { matchId: string })
  | (WsEventBase<'ROUND_STARTED', { roundNumber: number; manoSeat: Seat }> & { matchId: string })
  | (WsEventBase<'ROUND_ENDED', { winnerSeat: Seat }> & { matchId: string })
  | (WsEventBase<'GAME_STARTED', { gameNumber: number }> & { matchId: string })
  | (WsEventBase<'GAME_SCORE_CHANGED', { gamesWonPlayerOne: number; gamesWonPlayerTwo: number }> & { matchId: string })
  | (WsEventBase<'MATCH_FINISHED', { winnerSeat: Seat; gamesWonPlayerOne: number; gamesWonPlayerTwo: number }> & { matchId: string })
  // … resto de eventTypes documentados en §9.5 (AVAILABLE_ACTIONS_UPDATED, HAND_RESOLVED, etc.)
  ;

// Análogamente: LeagueWsEvent, CupWsEvent, ChatWsEvent, SocialWsEvent, ProfileWsEvent, SpectateWsEvent, PublicLobbyWsEvent.

/** Union discriminada general. */
export type WsEvent = MatchWsEvent /* | LeagueWsEvent | ... */;
```

> Nota: la enumeración exhaustiva de cada canal se rellena conforme se vayan implementando features. Esta feature deja la **forma genérica** y el canal de match como ejemplo trabajado; las demás se completan al consumirse.

---

## 5. Transiciones de estado de la sesión (AuthStore)

```text
            ┌──────────────────────┐
            │   ANON (no session)  │
            └──────────┬───────────┘
                       │ register / login / guest OK
                       ▼
            ┌──────────────────────┐
            │   AUTHENTICATED      │◀──────────┐
            │   (isGuest? sí/no)   │           │ refresh OK
            └──────────┬───────────┘           │
                       │                       │
       logout │ refresh KO │ storage corrupto  │
                       ▼                       │
            ┌──────────────────────┐           │
            │   ANON               │           │
            └──────────────────────┘           │
                       ▲                       │
                       └───────────────────────┘
```

**Invariantes**:

- En **ANON**: `playerId`, `accessToken` y `refreshToken` son `null`; `isGuest = false`; `localStorage.tt3.session` está borrado.
- En **AUTHENTICATED**: todos los campos no nulos consistentes con el `AuthResponse` recibido; `refreshToken` puede ser `null` solo si `isGuest = true`.
- Una transición ANON → AUTHENTICATED siempre escribe `tt3.session` en `localStorage` antes de notificar (`patchState`).
- Una transición AUTHENTICATED → ANON siempre borra `tt3.session` antes de notificar.

---

## 6. Validaciones del formulario (cliente)

Reflejan exactamente el contrato (`§3.1`):

| Campo | Reglas (cliente) | Mensaje sugerido |
|---|---|---|
| `username` (register & login) | requerido | "El usuario es obligatorio" |
| `username` (register) | sólo `[A-Za-z0-9]` | "Sólo letras y números" |
| `username` (register) | ≥3 letras ASCII | "Necesita al menos 3 letras" |
| `password` | requerido, ≥5 chars | "Al menos 5 caracteres" |
| `password` (register) | ≥1 número, ≥1 símbolo | "Tiene que incluir un número y un símbolo" |

El backend sigue siendo la autoridad final; ante un 400 con `InvalidEnumValueException` u otros, se muestra el mapeo de `UserFacingAuthError`.
