# Data Model — MVP de partida privada por código

Fase 1. Entidades, DTOs y máquina de estados de la sala de espera. Todo verificado contra
`docs/CONTRATOS_API.md` (§4.1, §4.2, §4.5, §4.13, §4.14, §8.2, §9.6).

---

## 1. DTOs REST nuevos (`src/app/core/models/match.models.ts`)

### CreateMatchRequest — `POST /api/matches` (§4.1)

| Campo        | Tipo                    | Reglas                                                        |
|--------------|-------------------------|---------------------------------------------------------------|
| `gamesToPlay`| `1 \| 3 \| 5`           | Partidas totales de la serie. Reusa `seriesFormatToGamesToPlay`|
| `visibility` | `'PRIVATE'`             | MVP solo crea privadas (el tipo `Visibility` ya existe)       |

### CreateMatchResponse — `POST /api/matches` (§4.1)

| Campo        | Tipo                    | Notas                                  |
|--------------|-------------------------|----------------------------------------|
| `matchId`    | `string` (UUID)         | Para navegar a `/match/:matchId`       |
| `joinCode`   | `string`                | Código compartible (se muestra/copia)  |
| `visibility` | `Visibility`            | Eco del request                         |

### JoinResponse — `POST /api/join/{joinCode}` (§4.2)

| Campo        | Tipo                          | Notas                                            |
|--------------|-------------------------------|--------------------------------------------------|
| `targetType` | `'MATCH' \| 'LEAGUE' \| 'CUP'`| En el MVP solo se actúa si es `MATCH`            |
| `targetId`   | `string` (UUID)               | `matchId` al que unirse → navegar a `/match/:id` |

> `/start` (§4.5) y `/leave` (§4.13) responden `204` sin body: no requieren DTO de respuesta.

---

## 2. Ajustes a tipos existentes

### `MatchStatus` (`enums.ts`) — D1

Agregar `READY` **si** runtime lo confirma para privadas con 2 jugadores:

```
WAITING_FOR_PLAYERS | READY | IN_PROGRESS | FINISHED
```

### `MatchState` (`match.models.ts`) — D2

- `playerTwoUsername: string | null` (era `string`). Nullable en `WAITING_FOR_PLAYERS` (§4.14).

---

## 3. Payloads de eventos pre-juego (`match-ws-events.ts`)

Los `eventType` ya existen en `MatchEventType`. Se tipan/usan sus payloads (§9.6):

| Evento              | Payload                          | Efecto en estado (reducer)                                  |
|---------------------|----------------------------------|-------------------------------------------------------------|
| `PLAYER_JOINED`     | `{}`                             | No-op en reducer → dispara `refresh()` del snapshot (D7)    |
| `PLAYER_READY`      | `{ seat }`                       | No-op en reducer → dispara `refresh()` del snapshot (D7)    |
| `MATCH_PLAYER_LEFT` | `{ leaverSeat }` (= `PLAYER_TWO`)| `status → WAITING_FOR_PLAYERS`, `playerTwoUsername → null`  |
| `MATCH_CANCELLED`   | `{}`                             | Emite `preGameClosed$` (motivo `CANCELLED`) → aviso + lobby |

> `PLAYER_JOINED`/`PLAYER_READY`/`MATCH_PLAYER_LEFT`/`MATCH_CANCELLED` son transaccionales (consumen
> `stateVersion`): el reducer los procesa (no-op o mutación) y el `stateVersion` avanza igual, sin
> romper la reconciliación.

---

## 4. Máquina de estados de la sala de espera (vista del cliente)

```
                 crear (host)                    join rival (§4.2)
  [lobby] ───────────────────────▶ WAITING_FOR_PLAYERS ───────────────▶ READY
                                        │   ▲                              │
                       MATCH_CANCELLED  │   │ MATCH_PLAYER_LEFT            │ host: POST /start (§4.5)
                       (host /leave)    │   │ (rival /leave)               │
                                        ▼   │                              ▼
                                 [aviso + lobby]                    GAME_STARTED (§9.6, D6)
                                                                          │  status → IN_PROGRESS
                                                                          ▼
                                                                  [tablero de juego]
                                                                  (motor existente)
```

**Reglas de presentación derivadas**:

| Condición                                                        | Vista / acción                                  |
|------------------------------------------------------------------|-------------------------------------------------|
| `status ∈ {WAITING_FOR_PLAYERS, READY}`                          | Renderizar `WaitingRoomComponent` (no tablero)  |
| `viewerSeat === 'PLAYER_ONE'` (host)                             | Mostrar `joinCode` + acción copiar              |
| host **y** `status === 'READY'` (rival presente)                 | Habilitar botón **Iniciar** (FR-006)            |
| host **y** rival ausente                                         | Iniciar deshabilitado; texto "Esperando rival…" |
| `viewerSeat === 'PLAYER_TWO'` (invitado)                         | "Esperando que el anfitrión inicie"; sin Iniciar|
| cualquiera, pre-juego                                            | Botón **Salir** (`/leave`)                      |
| `status === 'IN_PROGRESS'`                                       | Renderizar tablero (sin cambios)                |
| `status === 'FINISHED'`                                          | Flujo de resultado/revancha existente           |

> Si runtime **no** expone `READY` (D1), "rival presente" se deriva de `playerTwoUsername != null`
> con `status === 'WAITING_FOR_PLAYERS'`, y esa condición habilita Iniciar.

---

## 5. Entidades de presentación

### WaitingRoomView (derivada de `MatchState` para `WaitingRoomComponent`)

| Campo            | Origen                                                              |
|------------------|---------------------------------------------------------------------|
| `isHost`         | `viewerSeat === 'PLAYER_ONE'`                                       |
| `joinCode`       | navigation state / `sessionStorage` (D5) — solo relevante para host |
| `hostUsername`   | `playerOneUsername`                                                 |
| `rivalUsername`  | `playerTwoUsername` (`null` ⇒ "Esperando rival…")                  |
| `rivalPresent`   | `playerTwoUsername != null` (o `status === 'READY'`)               |
| `canStart`       | `isHost && rivalPresent`                                            |
| `seriesLabel`    | `SERIES_FORMAT_LABELS` según `gamesToPlay`                          |

---

## 6. Errores (catálogo `getErrorCopy`) — scopes nuevos

### `CREATE_MATCH` (`POST /api/matches`)

| Status | Caso                                                  | Copy (orientativo)                                      |
|--------|-------------------------------------------------------|---------------------------------------------------------|
| 401    | sin token (interceptor)                               | `''`                                                    |
| 409/422| `PlayerAlreadyInMatch` / `PlayerHasOpenRematchSession`| "Ya estás en una partida o tenés una revancha pendiente."|
| 0/5xx  | red / servidor                                        | "No pudimos crear la partida. Reintentá en unos segundos."|
| otro   | —                                                     | fallback                                                |

### `JOIN_MATCH` (`POST /api/join/{joinCode}`)

| Status | Caso                                  | Copy (orientativo)                                       |
|--------|---------------------------------------|----------------------------------------------------------|
| 401    | sin token                             | `''`                                                     |
| 404    | código inexistente                    | "Ese código no corresponde a ninguna partida."           |
| 409    | último lugar ocupado (carrera)        | "La partida se llenó justo antes de que entraras."        |
| 422    | partida no disponible / jugador ocupado| "No podés unirte: la partida ya empezó o estás ocupado." |
| 0/5xx  | red / servidor                        | "No pudimos unirte a la partida. Reintentá."             |
| otro   | —                                     | fallback                                                 |

> El texto definitivo se ajusta en implementación; nunca se muestra `ApiError.message` (Principio II /
> [[error-messaging]]).
