# Phase 1: Data Model — Cola serial de eventos WS

Esta feature **no** introduce entidades de dominio nuevas ni persistencia. Las únicas estructuras son en memoria, dentro del servicio de cola.

## Entidades en memoria

### `QueuedMatchEvent`

Ítem que entra a la cola FIFO. Une los dos tipos de evento WS existentes (transaccional y derivado) con metadata de cola.

```ts
type QueuedMatchEvent =
  | { kind: 'transactional'; event: MatchWsEvent; local: boolean; delayMs: number }
  | { kind: 'derived';       event: MatchDerivedEvent; local: boolean; delayMs: number };
```

| Campo      | Tipo                                  | Origen                                                                 |
|------------|---------------------------------------|------------------------------------------------------------------------|
| `kind`     | `'transactional' \| 'derived'`        | Canal WS de origen.                                                    |
| `event`    | `MatchWsEvent` / `MatchDerivedEvent`  | Payload original WS, sin modificar.                                    |
| `local`    | `boolean`                             | `true` si `payload.seat === viewerSeat`. Derivado al encolar.          |
| `delayMs`  | `number ≥ 0`                          | Resuelto al encolar via `resolveDelay(event, local)` (ver contrato).   |

**Reglas de validación**:
- `delayMs = 0` si `local === true` (FR-004).
- `delayMs = 0` para todos los `kind === 'derived'` (FR-007 sólo exige orden, no pausa).
- `delayMs` jamás es negativo.

**Inmutabilidad**: cada ítem se construye una sola vez al encolar; no se muta.

### Estado interno del `MatchEventQueueService`

| Campo            | Tipo                          | Descripción |
|------------------|-------------------------------|-------------|
| `queue`          | `QueuedMatchEvent[]`          | FIFO. Push al final, shift al frente. |
| `pendingTimerId` | `number \| null`              | Id de `setTimeout` activo (null si no hay tick pendiente). |
| `processing`     | `boolean`                     | Guard para evitar que dos drains se solapen. |
| `getViewerSeat`  | `() => Seat \| null`          | Provider inyectado al `init()`. |
| `apply`          | `(e: QueuedMatchEvent) => void` | Callback que aplica el evento al reducer + emite los `Subject`s. |

**Transiciones de estado** (state machine simple):

```
        enqueue(e)
   IDLE ───────────► HAS_ITEMS
    ▲                  │
    │  queue.length=0  │ schedule(delay)
    │                  ▼
    └─────────── WAITING_TICK ──── (timer fires) ──► apply + shift + back to "HAS_ITEMS or IDLE"
```

Eventos externos:
- `flushImmediately()`: cancela timer, aplica todos los ítems en orden con delay 0, vuelve a IDLE.
- `clear()`: cancela timer, vacía la cola **sin aplicar**, vuelve a IDLE.

## Relaciones con el modelo existente

- La cola **consume** `MatchWsEvent` y `MatchDerivedEvent` definidos en `src/app/features/match/models/match-ws-events.ts`. No se modifican.
- La cola **delega** la aplicación de estado al callback `apply`, que internamente llama a `applyMatchEvent` / `applyMatchDerivedEvent` del reducer existente. El reducer no se toca.
- La cola **no** persiste nada en `localStorage` ni en NgRx.

## No-entidades (clarificaciones)

- **No** hay representación del "snapshot inicial": es la respuesta REST, fuera de la cola.
- **No** hay reintentos ni TTL: los eventos en cola se aplican siempre (salvo `clear()` por desmonte).
- **No** hay deduplicación por `stateVersion` en la cola: esa responsabilidad sigue siendo del `MatchStateService` que ya valida `event.stateVersion <= lastApplied` antes de enqueue.
