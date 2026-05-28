# Modelo de datos (interno) — ACK gated event queue

**Feature**: 011-ack-gated-event-queue
**Fecha**: 2026-05-27

Esta feature no introduce entidades de dominio ni cambia DTOs del backend. El "modelo" aquí descrito es la estructura interna del servicio `MatchEventQueueService` extendida para soportar la pausa por ACK, y la configuración centralizada de event types bloqueantes.

---

## Entidad 1 — `BLOCKING_MATCH_EVENT_TYPES` (catálogo)

**Ubicación**: `src/app/features/match/config/match-blocking-events.config.ts`

**Tipo**:
```ts
export const BLOCKING_MATCH_EVENT_TYPES: ReadonlySet<MatchEventType>;
export function isBlockingEvent(eventType: MatchEventType): boolean;
```

**Contenido inicial** (Decisión 6 de research.md):
- `ENVIDO_RESOLVED`
- `GAME_SCORE_CHANGED`
- `MATCH_FINISHED`
- `MATCH_ABANDONED`
- `MATCH_FORFEITED`

**Reglas**:
- Sólo contiene strings que existan en el unión `MatchEventType` (typecheck obliga).
- Es `ReadonlySet` para evitar mutaciones accidentales en runtime.
- `isBlockingEvent(t)` envuelve `BLOCKING_MATCH_EVENT_TYPES.has(t)` para futura evolución (p. ej. consulta basada en payload).
- Agregar/quitar tipos NO requiere tocar `MatchEventQueueService`.

**Validaciones**:
- Tipado al union de `MatchEventType` exportado por `match-ws-events.ts` (mismo mecanismo que `MATCH_EVENT_DELAYS_MS`).

---

## Entidad 2 — Estado interno extendido de `MatchEventQueueService`

**Ubicación**: `src/app/features/match/services/match-event-queue.service.ts`

**Campos nuevos**:
| Campo | Tipo | Inicial | Descripción |
|-------|------|---------|-------------|
| `pausedForAck` | `boolean` | `false` | Indica que la cola aplicó un evento bloqueante y espera `resumeAck()` antes de continuar. |

**Métodos públicos nuevos**:
| Método | Firma | Contrato |
|--------|-------|----------|
| `resumeAck` | `(): void` | Si `pausedForAck === false`, no-op (idempotente, FR-006). Si `true`, lo pone en `false` y llama `schedule()` para procesar el siguiente ítem. |
| `isPausedForAck` | `(): boolean` | Getter de sólo lectura para tests / debugging. Opcional. |

**Métodos modificados**:
| Método | Cambio |
|--------|--------|
| `schedule()` | Guarda adicional: si `pausedForAck === true`, retornar sin programar. Bypass de `setTimeout` cuando el item next también es bloqueante (FR-010). |
| `applyItem(item)` | Para items `kind === 'transactional'`: si `isBlockingEvent(item.event.eventType)`, setear `pausedForAck = true` ANTES de invocar `deps.applyTransactional` (para que el handler tenga la opción de llamar `resumeAck()` síncronamente y revertirlo). |
| `clear()` | Setear `pausedForAck = false` además del cleanup actual. |
| `flushImmediately()` | Setear `pausedForAck = false` antes de drenar — el snapshot reconciliará el estado canónico. |

**Invariantes**:
1. `pausedForAck = true` ⇒ `schedule()` no programa nada y `pendingTimerId === null`.
2. `pausedForAck = true` ⇒ `enqueueTransactional` / `enqueueDerived` siguen agregando a `queue` (FR-005, cero pérdida).
3. `resumeAck()` llamado con la cola vacía no rompe (`schedule()` ya maneja `queue.length === 0`).
4. Después de `clear()`/`flushImmediately()`: `pausedForAck === false`.

**Transiciones de estado**:
```
[idle, pausedForAck=false]
   │ enqueue + schedule
   ▼
[processing un item no bloqueante]
   │ applyItem retorna, schedule()
   ▼
[idle, pausedForAck=false]   ◀──── ciclo normal

[idle] ──enqueue bloqueante──▶ [processing un item bloqueante]
                                       │ pausedForAck=true; applyTransactional()
                                       │   (handler decide)
                                       ▼
                       handler abre modal:                 handler no abre modal:
                       queda pausedForAck=true             llama resumeAck() síncrono
                       hasta dialogRef.afterClosed()       → pausedForAck=false
                                       │                            │
                                       ▼                            ▼
                              resumeAck() → schedule() siguiente ítem
```

---

## Entidad 3 — Contrato del componente `MatchScreenComponent` con la queue

**No es una entidad nueva**, sólo se documenta el contrato implícito que la feature introduce:

| Subject (existente) | Handler debe… |
|---------------------|---------------|
| `envidoResolved$` | Si `payload.response === 'NO_QUIERO'`: llamar `eventQueue.resumeAck()` inmediato. Si `'QUIERO'`: abrir `EnvidoResultDialogComponent` y llamar `resumeAck()` en `afterClosed`. |
| `gameWon$` | Abrir `GameWonDialogComponent` y llamar `resumeAck()` en `afterClosed`. |
| `matchEnded$` | Abrir `GameWonDialogComponent` (variante "match finished") y llamar `resumeAck()` en `afterClosed`. (El navigate al lobby se mantiene en `afterClosed`.) |

**Regla general**: para todo evento cuyo `eventType ∈ BLOCKING_MATCH_EVENT_TYPES`, el componente DEBE garantizar exactamente una llamada efectiva a `resumeAck()` por ocurrencia del evento — ya sea síncronamente (no abre modal) o en `afterClosed` (abre modal).

**Ciclo de vida**:
- `ngOnDestroy` debe llamar `this.dialog.closeAll()` antes de `matchStateService.destroy()` — `destroy()` llama `eventQueue.clear()` que ya resetea `pausedForAck`.

---

## Trazabilidad a requisitos funcionales

| FR | Cubierto por |
|----|--------------|
| FR-001 | Catálogo + chequeo en `applyItem` |
| FR-002 | Estado `pausedForAck` + guarda en `schedule()` |
| FR-003 | Sin cambios al path no bloqueante; `resolveDelay` intacto |
| FR-004 | `BLOCKING_MATCH_EVENT_TYPES` en `match-blocking-events.config.ts` |
| FR-005 | `enqueue*` no consultan `pausedForAck` — siguen llenando `queue` |
| FR-006 | `resumeAck()` chequea `pausedForAck` antes de actuar |
| FR-007 | Modales abiertos sin `setTimeout` de auto-close (responsabilidad del componente, ya cumplido) |
| FR-008 | `ngOnDestroy` → `dialog.closeAll()` + `destroy()` → `clear()` resetea estado |
| FR-009 | `flushImmediately()` resetea `pausedForAck`; modal cerrado por componente al detectar re-bootstrap |
| FR-010 | Bypass de `setTimeout` en `schedule()` cuando el next item es bloqueante |
