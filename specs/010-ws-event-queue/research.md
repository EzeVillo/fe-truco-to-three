# Phase 0: Research — Cola serial de eventos WebSocket de match

## Decisiones de diseño

### D1. Estructura: cola FIFO con worker async/setTimeout

- **Decisión**: implementar la cola como un `Array<QueueItem>` privado dentro de un servicio `MatchEventQueueService`, con un único worker que procesa secuencialmente vía `setTimeout`. No usar RxJS `concatMap` con `timer()` porque dificulta el cancelado selectivo en reconexión/desmonte.
- **Rationale**: setTimeout permite cancelar el siguiente tick con `clearTimeout(this.pendingTimerId)` y reanudar tras un drain inmediato. El estado de la cola es trivial (un array + un id de timer + un flag `processing`). Evita capas reactivas innecesarias para lógica imperativa.
- **Alternativas consideradas**:
  - `concatMap(event => of(event).pipe(delay(getDelay(event))))`: elegante pero acoplado al pipe; el flush inmediato en reconexión requiere reemplazar el observable y resuscribir consumidores, lo cual rompe `matchEvent$` como `Subject` estable.
  - Cola basada en `requestAnimationFrame`: descartada porque los delays son de cientos de ms, no de frames.

### D2. Detección de eventos locales vs remotos

- **Decisión**: el servicio acepta como dependencia una función `getViewerSeat()` (provista por `MatchStateService`). Para cada evento con `payload.seat`, si `seat === viewerSeat`, se marca como `local: true` y se procesa con delay 0. Para eventos sin `seat` en el payload (`SCORE_CHANGED`, `ROUND_STARTED`, `MATCH_FINISHED`, etc.), se considera no-local y se aplica la regla por `eventType` (la mayoría delay 0 por ser "estado puro"; ver D3).
- **Rationale**: el contrato (`docs/CONTRATOS_API.md`) ya entrega `seat` para todos los eventos disparados por un jugador (`CARD_PLAYED`, `TRUCO_CALLED`, `ENVIDO_CALLED`, `TRUCO_RESPONDED`, `FOLDED`). No hace falta correlacionar por `requestId`.
- **Alternativas**: comparar por username — descartado porque la fuente canónica ya es `viewerSeat` derivado del snapshot.

### D3. Tabla de delays por tipo de evento

Centralizada en `src/app/features/match/config/match-event-delays.config.ts`:

| eventType                    | delay (ms) | Razón |
|------------------------------|------------|-------|
| `CARD_PLAYED` (remoto)       | 600        | El jugador necesita ver que el rival jugó antes del siguiente evento. |
| `TRUCO_CALLED` (remoto)      | 600        | Lectura del canto. |
| `TRUCO_RESPONDED` (remoto)   | 600        | "Quiero / No quiero" del rival es visible. |
| `ENVIDO_CALLED` (remoto)     | 600        | Idem truco. |
| `ENVIDO_RESOLVED`            | 800        | Resultado disparara modal — dar lectura previa. |
| `FOLDED` (remoto)            | 600        | "Mazo" del rival. |
| `HAND_RESOLVED`              | 800        | Antes de despejar la mesa. |
| `GAME_SCORE_CHANGED`         | 800        | Antes de mostrar dialog de game ganado. |
| `MATCH_FINISHED` / `MATCH_ABANDONED` / `MATCH_FORFEITED` | 800 | Antes del dialog final. |
| `TURN_CHANGED`               | 0          | Indicador de turno; ya viene tras un evento visible que sí tiene delay. |
| `ROUND_STARTED` / `ROUND_ENDED` / `GAME_STARTED` | 0 | Limpieza de estado interno. |
| `HAND_DEALT` / `HAND_CHANGED` | 0         | Reparto de cartas; ya hay animaciones propias del render. |
| `SCORE_CHANGED`              | 0          | Suele acompañar a `HAND_RESOLVED` que ya tiene su delay. |
| `SPECTATOR_COUNT_CHANGED`, `PLAYER_JOINED`, `PLAYER_READY` | 0 | Estado de mesa. |
| `REMATCH_*`, `MATCH_PLAYER_LEFT`, `MATCH_CANCELLED` | 0 | Fuera del flujo de juego. |
| `AVAILABLE_ACTIONS_UPDATED` (derived) | 0  | Pasa por la cola para preservar orden causal (FR-007), pero sin pausa. |
| `PLAYER_HAND_UPDATED` (derived) | 0      | Idem. |
| Cualquier evento marcado `local: true` | 0 | Eco propio (FR-004). |

Estos valores son el default; viven en una constante exportada que puede tunearse en seguimiento.

### D4. Reconexión / snapshot inicial

- **Decisión**: la cola no se activa mientras `MatchStateService.loading()` es `true`. Durante esa ventana, los eventos siguen yendo al buffer transaccional existente y se draenan al llegar el snapshot (comportamiento actual de `drainBuffers()`). Una vez `loading=false`, los eventos vivos pasan por la cola.
- En **reconexión** (`wasConnected && isConnected && !loading`), antes de hacer `loading.set(true)` y `fetchSnapshot`, **drenar la cola inmediatamente** aplicando todos los eventos pendientes sin delay. Esto cubre FR-006 (estado final aplicado de una sola vez) y la edge case de tab inactiva (FR § Edge Cases).
- **Rationale**: si llegan ráfagas de eventos durante una desconexión transitoria, el siguiente snapshot va a sobreescribir el estado de todas formas. Aplicarlos inmediatamente antes del refetch deja al reducer en un estado consistente y evita "perder" eventos si el snapshot tarda.

### D5. Desmonte de la pantalla (FR-011)

- **Decisión**: `MatchEventQueueService` se provee desde `MatchScreenComponent.providers` (igual scope que `MatchStateService`). En `ngOnDestroy` se llama `matchStateService.destroy()` que a su vez llama `eventQueueService.clear()`, descartando todos los pendientes sin aplicarlos.

### D6. Coalescing (FR-008)

- **Decisión**: implementar coalescing **opcional y conservador** para `TURN_CHANGED` consecutivos sin nada entre medio (mismo seat ⇒ ignorar el segundo). No se aplica coalescing a otros eventos en esta iteración para minimizar riesgo de bugs sutiles.

### D7. Tests

- **Unit tests** sobre `MatchEventQueueService`:
  - Enqueue 2 eventos remotos visibles → el segundo se aplica con ≥ delay tras el primero (usar `vi.useFakeTimers()`).
  - Evento local seguido de evento remoto → local se aplica inmediatamente, luego comienza el delay del remoto.
  - `clear()` cancela timers pendientes.
  - `flushImmediately()` aplica todos los pendientes sin esperar.
  - Coalescing de `TURN_CHANGED` consecutivos: se aplica una sola vez.
- **Tests de `MatchStateService`**: actualizar el spec existente para verificar que después de `init`, los eventos vivos pasan por la cola (mock del servicio) y los del buffer de carga siguen sin delay.

## Resolución de NEEDS CLARIFICATION

La spec asume que el snapshot inicial y el replay de reconexión son distinguibles del flujo normal. **Resolución**: el "snapshot inicial" no es un evento WS sino la respuesta REST `GET /api/matches/{id}`. La cola no ve esos datos; sólo ve eventos WS. La distinción entre "evento de reconexión" y "evento normal" es implícita: durante `loading=true` los eventos van al buffer transaccional preexistente (no a la cola). Una vez `loading=false`, todos los eventos pasan por la cola — el caso de "tab inactiva con backlog" se cubre con el drain inmediato en reconexión (D4).

No quedan NEEDS CLARIFICATION.
