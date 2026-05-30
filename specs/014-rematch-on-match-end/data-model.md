# Data Model: Revancha al terminar una partida

**Feature**: 014-rematch-on-match-end | **Fecha**: 2026-05-29

Fuente autoritativa: `docs/CONTRATOS_API.md` §4.17 (REST), §9.5/§9.6 (eventos), §8.2 (enums).

## Enums (del contrato §8.2)

```text
RematchSessionStatus = 'OPEN' | 'CONFIRMED' | 'CLOSED_BY_LEAVE' | 'EXPIRED'
RematchChoice        = 'UNDECIDED' | 'WANTS_REMATCH' | 'LEFT'
```

## DTO REST — `GET /api/matches/{matchId}/rematch` (§4.17.3)

```text
RematchSessionResponse {
  sessionId: string;            // UUID
  originMatchId: string;        // UUID de la partida original (terminada)
  status: RematchSessionStatus;
  playerOneChoice: RematchChoice;
  playerTwoChoice: RematchChoice;
  expiresAt: string;            // ISO-8601 (Instant) — OJO: distinto del WS (epochMillis)
  resultMatchId: string | null; // UUID de la nueva partida; no-null solo si status === 'CONFIRMED'
}
```

- Errores: `401` (interceptor), `404` (no hay sesión para ese `matchId` → no se ofrece revancha),
  `422` (el jugador no es participante).

## Payloads de eventos WS (§9.6) — `match-ws-events.ts`

Los `eventType` ya existen en `MatchEventType`. Se agregan las interfaces de payload:

```text
RematchAvailablePayload     { sessionId: string; originMatchId: string; expiresAt: number }   // epochMillis
RematchOpponentWantsPayload { sessionId: string; originMatchId: string; actor: string }       // username del que aceptó
RematchConfirmedPayload     { sessionId: string; originMatchId: string; newMatchId: string;
                              newPlayerOne: string; newPlayerTwo: string }
RematchClosedByLeavePayload { sessionId: string; originMatchId: string; actor: string }        // username del que abandonó
RematchExpiredPayload       { sessionId: string; originMatchId: string }
```

- Viajan por `/user/queue/match` con `matchId` top-level = `originMatchId` (la partida terminada).
- `REMATCH_AVAILABLE` se envía a jugador 1 y jugador 2 **si no es bot** → contra bot no llega ni
  `REMATCH_OPPONENT_WANTS` ni `REMATCH_CONFIRMED` por decisión del rival; el FE simplemente no
  muestra esos estados (FR-012, sin lógica de bot).
- Tras `REMATCH_CONFIRMED`, la nueva partida ya está `IN_PROGRESS` y llegan `GAME_STARTED`/
  `ROUND_STARTED`/`TURN_CHANGED` para `newMatchId` (no hace falta `POST /start`).

## Entidad de vista cliente — `RematchSession` (`rematch.models.ts`)

Estado normalizado y orientado a `viewerSeat` que mantiene `RematchStateService`:

| Campo | Tipo | Descripción |
|---|---|---|
| `sessionId` | `string` | UUID de la sesión |
| `originMatchId` | `string` | UUID de la partida original |
| `status` | `RematchSessionStatus` | estado de la sesión |
| `selfChoice` | `RematchChoice` | decisión del jugador autenticado |
| `opponentChoice` | `RematchChoice` | decisión del rival |
| `expiresAt` | `number \| null` | **epochMillis** (normalizado desde ISO en el path REST) |
| `resultMatchId` | `string \| null` | UUID de la nueva partida (solo si `CONFIRMED`) |

**Invariante**: `resultMatchId` es no-null **iff** `status === 'CONFIRMED'`.

## Transiciones de estado de `session`

| Origen | Efecto |
|---|---|
| `init()` → `GET …/rematch` 200 | setea `session` desde el DTO; mapea `playerOne/TwoChoice` a `self/opponentChoice` vía `viewerSeat`; `expiresAt = Date.parse(iso)` |
| `init()` → `GET …/rematch` 404 | `session = null` (no se ofrece revancha) |
| `REMATCH_AVAILABLE` | `session = { OPEN, self=UNDECIDED, opponent=UNDECIDED, expiresAt }` |
| `REMATCH_OPPONENT_WANTS` | `opponentChoice = WANTS_REMATCH` |
| `REMATCH_CONFIRMED` | `status = CONFIRMED`, `resultMatchId = newMatchId` |
| `REMATCH_CLOSED_BY_LEAVE` | `status = CLOSED_BY_LEAVE`, `opponentChoice = LEFT` |
| `REMATCH_EXPIRED` | `status = EXPIRED` |
| `accept()` 204 | `selfChoice = WANTS_REMATCH` (optimista) |
| `leave()` 204 | `status = CLOSED_BY_LEAVE`, `selfChoice = LEFT` |
| `accept()`/`leave()` 4xx | sin cambio de estado de dominio; se setea copy de error (`getErrorCopy('REMATCH', …)`) y se degrada la UI |
| re-init por nuevo `matchId` | `session = null` antes de cargar la nueva partida |

## Estado de UI derivado (no persistido) — `rematch-view.ts` / componente

| Señal/derivado | Origen | Uso |
|---|---|---|
| `offerVisible` | `session !== null` **y** el modal de resultado ya se cerró | abrir/mostrar la oferta (diálogo aparte, `RematchDialogComponent`) — nunca simultánea al modal de resultado (FR-001a) |
| `canAccept` | `status === 'OPEN' && selfChoice === 'UNDECIDED'` | habilitar botón "Revancha" |
| `waitingForOpponent` | `status === 'OPEN' && selfChoice === 'WANTS_REMATCH'` | "Esperando al rival…" |
| `opponentWants` | `opponentChoice === 'WANTS_REMATCH' && status === 'OPEN'` | leyenda "El rival quiere revancha" |
| `opponentLeft` | `status === 'CLOSED_BY_LEAVE'` | "El rival no quiere revancha" + solo "Salir" |
| `expired` | `status === 'EXPIRED'` | "La revancha venció" + solo "Salir" |
| `confirmedMatchId` | `status === 'CONFIRMED' ? resultMatchId : null` | disparar navegación a `/match/{id}` |
| `remainingMs` | `computeRemainingMsFromSnapshot(expiresAt, serverClockOffsetMs, now)` | countdown informativo de expiración (muestra el **restante real** al abrir la oferta, no el total) |
