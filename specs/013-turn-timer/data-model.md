# Data Model: Temporizador de turno en partida

**Feature**: 013-turn-timer | **Fecha**: 2026-05-29

Fuente autoritativa: `docs/CONTRATOS_API.md` §4.14, §4.15, §4.18, §9.6.

## Entidades / campos nuevos

### Plazo de acción (en `RoundState`)

Campos agregados al snapshot REST (`roundGame` de `GET /api/matches/{id}`) y replicados en el estado
del cliente:

| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| `actionDeadline` | `number` (epochMillis, absoluto) | sí (`null` si no corre reloj) | Instante en que el asiento obligado pierde por timeout. Fuente de verdad del restante. |
| `turnDurationMillis` | `number` | sí (`null` si no corre reloj) | Plazo total del turno; denominador del indicador de progreso. |
| `actionDeadlineSeat` | `'PLAYER_ONE' \| 'PLAYER_TWO'` | sí (`null` si no corre reloj) | Asiento al que aplica el reloj. Puede no coincidir con `currentTurn` (respuesta a canto pendiente). |

**Regla de invariante**: los tres campos son consistentes entre sí — o los tres tienen valor (reloj
activo) o los tres son `null` (sin reloj). El reducer debe setearlos/limpiarlos juntos.

### Tipo de evento WS (en `match-ws-events.ts`)

```text
MatchDerivedEventType += 'ACTION_DEADLINE_SET' | 'ACTION_DEADLINE_CLEARED'
```

> Nota: aunque viajan por `/user/queue/match`, se modelan como **derivados** (sin `stateVersion`).
> Se incorpora una unión/discriminador para distinguirlos al rutear (ver `match-state.service.ts`).

#### Payloads

```text
ActionDeadlineSetPayload {
  seat: 'PLAYER_ONE' | 'PLAYER_TWO';   // asiento que debe actuar
  actionDeadline: number;              // epochMillis absoluto
  turnDurationMillis: number;          // plazo total
}

ActionDeadlineClearedPayload {}        // sin campos
```

El sobre del evento conserva `timestamp` (epochMillis del servidor), usado para el cálculo robusto al
desfase de reloj (ver research D2).

### Proyección de presentación (en `MatchView` vía `deriveMatchView`)

Se expone el plazo de forma derivada para el render:

| Campo de `MatchView` | Tipo | Descripción |
|---|---|---|
| `actionDeadline` | `number \| null` | epochMillis absoluto (passthrough) |
| `turnDurationMillis` | `number \| null` | plazo total (passthrough) |
| `deadlineIsSelf` | `boolean \| null` | `true` si `actionDeadlineSeat === viewerSeat`, `false` si rival, `null` si no hay reloj |

`SeatView` (self/opponent) puede incorporar `hasActiveDeadline: boolean` para que el panel decida en
qué `turn-dot` pintar el anillo.

## Transiciones de estado

| Evento / origen | Efecto sobre el plazo en `roundGame` |
|---|---|
| Snapshot REST (`fetchSnapshot`) | Inicializa `actionDeadline` / `turnDurationMillis` / `actionDeadlineSeat` desde el body |
| `ACTION_DEADLINE_SET` | Reemplaza los tres campos (reinicio del reloj para el nuevo asiento) |
| `ACTION_DEADLINE_CLEARED` | Pone los tres campos en `null` (no corre reloj) |
| `GAME_STARTED` / `roundGame = null` | El plazo desaparece junto con la ronda |
| `MATCH_FINISHED/ABANDONED/FORFEITED/CANCELLED` | `status` ≠ `IN_PROGRESS` → el indicador no se renderiza |

## Estado de UI derivado (no persistido)

| Señal | Origen | Uso |
|---|---|---|
| `remainingMs` | `turn-timer.ts` a partir de `actionDeadline` + offset/`timestamp` | Progreso del anillo |
| `isUrgent` | `remainingMs <= 5000` | Énfasis visual (FR-006) |
| `viewerActionTimedOut` | `deadlineIsSelf === true && remainingMs <= 0` y aún `IN_PROGRESS` | Deshabilitar controles + "tiempo agotado" (FR-008) |
| `serverClockOffsetMs` | `lastEventTimestamp - Date.now()` | Corrección de reloj para el path de snapshot |
