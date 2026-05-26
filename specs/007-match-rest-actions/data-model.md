# Phase 1 — Data Model: Acciones de match contra el backend (REST)

Esta feature no introduce entidades de dominio nuevas: reutiliza el `MatchState` y el `AvailableAction` ya tipados en `src/app/core/models/match.models.ts` (proveniente de feature 006). Lo que sí se agrega son los **request DTOs** de las acciones, alineados a `docs/CONTRATOS_API.md §4.6 – §4.11` y §8.1.

## DTOs nuevos en `src/app/core/models/match.models.ts`

### Enums (ya existen en `enums.ts`)

```ts
export type Suit = 'ESPADA' | 'BASTO' | 'COPA' | 'ORO';
export type EnvidoCall = 'ENVIDO' | 'REAL_ENVIDO' | 'FALTA_ENVIDO';
export type TrucoResponse = 'QUIERO' | 'NO_QUIERO' | 'QUIERO_Y_ME_VOY_AL_MAZO';
export type EnvidoResponse = 'QUIERO' | 'NO_QUIERO';
```

> Si alguno de `EnvidoCall`, `TrucoResponse`, `EnvidoResponse` no estuviera ya en `enums.ts`, se agrega en la fase de implementación.

### Request DTOs

```ts
/** §4.6 POST /api/matches/{matchId}/play-card */
export interface PlayCardRequest {
  suit: Suit;
  number: number; // 1..12
}

/** §4.9 POST /api/matches/{matchId}/envido */
export interface CallEnvidoRequest {
  call: EnvidoCall;
}

/** §4.8 POST /api/matches/{matchId}/truco/respond */
export interface RespondTrucoRequest {
  response: TrucoResponse;
}

/** §4.10 POST /api/matches/{matchId}/envido/respond */
export interface RespondEnvidoRequest {
  response: EnvidoResponse;
}
```

### Acciones sin body (no requieren DTO)

- `POST /api/matches/{matchId}/truco` — §4.7
- `POST /api/matches/{matchId}/fold` — §4.11

### Reutilizadas de feature 003

```ts
export interface CreateBotMatchRequest { botId: string; gamesToPlay: 1 | 3 | 5; }
export interface CreateBotMatchResponse { matchId: string; /* ...campos extra del contrato bot match */ }
```

No se modifica su shape; sólo se consume `matchId` para navegar.

## Entidad operativa de la feature (no se persiste, vive en signals)

### `MatchActionInFlight` (privado de componentes/servicio)

| Campo | Tipo | Notas |
|---|---|---|
| `kind` | `'TRUCO' \| 'ENVIDO' \| 'RESPOND_TRUCO' \| 'RESPOND_ENVIDO' \| 'FOLD' \| 'PLAY_CARD'` | identifica la acción |
| `inFlight` | `boolean` | true mientras dura la request |

No es una entidad persistida: cada componente que dispara una acción mantiene su propia señal `isXyzInFlight` (ver Research §R3). No se centraliza en un store para mantener la feature mínima.

## Estados y transiciones

No hay máquina de estados de dominio. La única transición relevante es:

```text
[idle] -- click usuario --> [request enviada] -- 204/4xx/5xx/timeout --> [idle]
```

- Durante `request enviada`, el botón está deshabilitado para prevenir doble disparo.
- La transición de vuelta a `idle` ocurre vía `finalize()` (RxJS) y es invisible al usuario en caso de error.

## Reglas de validación de input

- **Suit**: el componente sólo emite valores que ya vienen del mock (que cumple el contrato).
- **EnvidoCall / TrucoResponse / EnvidoResponse**: son enums TS literales; el compilador previene valores fuera del contrato.
- **matchId**: viene de la URL; no se valida formato UUID en cliente (si la URL es inválida, el server responderá 4xx y se silenciará).
- **number** (1..12): no se valida en cliente; viene de las cartas del mock.

## Relación con el mock

| Mock provee | Se consume desde | Uso |
|---|---|---|
| `MatchState.roundGame.availableActions` | `AvailableActionsPanelComponent` | Determina qué acciones se ofrecen |
| `MatchState.roundGame.myCards` | `PlayerHandComponent` | Determina qué cartas son clickeables |
| `RoundState.currentTrucoCall` | `TrucoResponsePanelComponent` (indirecto) | Sirve para distinguir entre canto inicial y re-truco/vale-cuatro |

El mock no se modifica en esta feature.
