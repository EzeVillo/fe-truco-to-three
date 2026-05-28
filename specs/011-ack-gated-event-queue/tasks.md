---
description: "Tasks para implementar la cola de eventos con pausa por ACK del usuario"
---

# Tasks: ACK del usuario gobierna el avance de la cola tras eventos bloqueantes

**Input**: Design documents from `/specs/011-ack-gated-event-queue/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` después de cambiar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md` antes de tipar un DTO.
> - **CTAs verticales**: título + descripción en spans separados, `flex-direction: column`, no `mat-flat-button`.
> - **Copy de errores**: usar `getErrorCopy()`, nunca `ApiError.message` crudo en la UI.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Prereqs bloqueantes para todas las User Stories)

**Purpose**: Crear el catálogo centralizado de eventos bloqueantes y extender `MatchEventQueueService` con el mecanismo de pausa/resume. Estas tareas DEBEN completarse antes de cualquier User Story.

**⚠️ CRÍTICO**: No se puede implementar ninguna US sin esta fase completa.

- [X] T001 Crear `src/app/features/match/config/match-blocking-events.config.ts` con `BLOCKING_MATCH_EVENT_TYPES: ReadonlySet<MatchEventType>` (valores: `'ENVIDO_RESOLVED'`, `'GAME_SCORE_CHANGED'`, `'MATCH_FINISHED'`, `'MATCH_ABANDONED'`, `'MATCH_FORFEITED'`) y función exportada `isBlockingEvent(eventType: MatchEventType): boolean`

- [X] T002 En `src/app/features/match/services/match-event-queue.service.ts`: añadir campo privado `pausedForAck = false`; agregar guarda `if (this.pausedForAck) return;` al inicio de `schedule()` (después de la guarda existente de `processing`)

- [X] T003 En `src/app/features/match/services/match-event-queue.service.ts`: en `enqueueTransactional()`, si `isBlockingEvent(event.eventType)` forzar `delayMs = 0` en el item antes de encolarlo (los eventos bloqueantes no usan delay de timer; su "delay efectivo" es el ACK del usuario — cumple FR-010)

- [X] T004 En `src/app/features/match/services/match-event-queue.service.ts`: en `applyItem()` para items `kind === 'transactional'`, si `isBlockingEvent(item.event.eventType)`, setear `this.pausedForAck = true` ANTES de llamar `this.deps.applyTransactional(item.event)` (permite que el handler síncrono llame `resumeAck()` y lo revierta)

- [X] T005 En `src/app/features/match/services/match-event-queue.service.ts`: implementar método público `resumeAck(): void` — si `!this.pausedForAck` retornar (idempotente, FR-006); si `true`, setear `false` y llamar `this.schedule()`

- [X] T006 [P] En `src/app/features/match/services/match-event-queue.service.ts`: en `clear()` agregar `this.pausedForAck = false`; en `flushImmediately()` agregar `this.pausedForAck = false` antes del while loop (FR-008/FR-009)

- [X] T007 En `src/app/features/match/pages/match-screen/match-screen.component.ts`: añadir `private readonly eventQueue = inject(MatchEventQueueService)` e importar el servicio (ya está en `providers` del componente; sólo falta inyectarlo)

**Checkpoint**: `MatchEventQueueService` tiene pausa/resume; componente puede llamar `resumeAck()`. Verificar con `pnpm test` que los tests de 010 siguen pasando.

---

## Phase 2: User Story 1 — El resultado del envido pausa la cola hasta ACK (Priority: P1) 🎯 MVP

**Goal**: Cuando se resuelve el envido con QUIERO, la cola queda bloqueada mientras el modal está abierto; al tocar "Aceptar", la cola retoma. Con NO_QUIERO, el ACK es inmediato y la cola no se pausa.

**Independent Test**: Escenario 1 y Escenario 7 del [quickstart.md](./quickstart.md). También: `pnpm test` en `match-event-queue.service.spec.ts` y `match-screen.component.spec.ts`.

### Implementación US1

- [X] T008 [US1] En `src/app/features/match/pages/match-screen/match-screen.component.ts`: en `openEnvidoResultDialog()`, al inicio (antes del early-return por NO_QUIERO), agregar `this.eventQueue.resumeAck()` — cuando NO_QUIERO no abre modal, el ACK se consume síncronamente para no bloquear la cola (el flag se revierte antes del return)

  > Detalle: `pausedForAck` se setea ANTES de `applyTransactional`. El handler síncrono (que lleva al componente vía Subject.next) corre dentro de `applyTransactional`. Para NO_QUIERO, `openEnvidoResultDialog` llama `resumeAck()` antes del return → `pausedForAck` queda en `false` → la cola sigue normal.

- [X] T009 [US1] En `src/app/features/match/pages/match-screen/match-screen.component.ts`: en `openEnvidoResultDialog()`, guardar el `dialogRef` retornado por `this.dialog.open(...)` y llamar `this.eventQueue.resumeAck()` dentro de `dialogRef.afterClosed().subscribe(() => { ... })` — la llamada a resume va ANTES de cualquier otro código en el callback

### Tests US1

- [X] T010 [P] [US1] En `src/app/features/match/services/match-event-queue.service.spec.ts`: agregar bloque `describe('US011 — pausa por ACK')` con los siguientes casos:
  - Evento bloqueante (`ENVIDO_RESOLVED`) encola ítem → NO llama `applyTransactional` hasta avanzar el timer (delay 0 pero en cola) → llamarlo luego → `pendingCount()` queda en 0 pero cola pausada
  - Evento bloqueante aplicado → segundo evento no-bloqueante encolado → `transactionalSpy` sólo llamado una vez hasta `resumeAck()`
  - `resumeAck()` → segundo evento se aplica normalmente con su delay
  - `resumeAck()` adicional es no-op (idempotente)
  - `clear()` durante pausa → `pausedForAck = false`, cola limpia
  - `flushImmediately()` durante pausa → aplica todo, `pausedForAck = false`
  - Dos eventos bloqueantes consecutivos: ACK al primero → segundo se aplica sin delay extra (delayMs=0 por T003)

- [X] T011 [US1] En `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`: agregar test `ENVIDO_RESOLVED QUIERO → modal abierto, resumeAck llamado en afterClosed`:
  - Hacer `envidoResolved$.next({ response: 'QUIERO', ... })`
  - Verificar que `dialogSpy` fue llamado con `EnvidoResultDialogComponent`
  - Verificar que `eventQueue.resumeAck` NO fue llamado antes de cerrar el dialog
  - Cerrar el dialog (invocar el `afterClosed` del mock)
  - Verificar que `resumeAck` fue llamado exactamente una vez

- [X] T012 [US1] En `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`: agregar test `ENVIDO_RESOLVED NO_QUIERO → no abre modal, resumeAck llamado síncronamente`:
  - Hacer `envidoResolved$.next({ response: 'NO_QUIERO', ... })`
  - Verificar que `dialogSpy` no fue llamado
  - Verificar que `resumeAck` fue llamado exactamente una vez

**Checkpoint**: US1 completa y testeable independientemente. Escenarios 1 y 7 del quickstart verificados.

---

## Phase 3: User Story 2 — Fin de mano/partida/serie pausa la cola hasta ACK (Priority: P1)

**Goal**: Los modales de "Partida ganada" y de "Match terminado" también bloquean la cola hasta el ACK del jugador. Al salir de la pantalla de match con un modal abierto, los diálogos se cierran y la cola se descarta.

**Independent Test**: Escenario 2 y Escenario 5 del [quickstart.md](./quickstart.md).

### Implementación US2

- [X] T013 [US2] En `src/app/features/match/pages/match-screen/match-screen.component.ts`: en `openGameWonDialog()`, guardar el `dialogRef` y llamar `this.eventQueue.resumeAck()` en `dialogRef.afterClosed().subscribe(() => { ... })`

- [X] T014 [US2] En `src/app/features/match/pages/match-screen/match-screen.component.ts`: en `openResultDialog()` (modal de match terminado), agregar `this.eventQueue.resumeAck()` al inicio del callback `dialogRef.afterClosed().subscribe(() => { this.eventQueue.resumeAck(); this.router.navigate(['/']); })`

- [X] T015 [US2] En `src/app/features/match/pages/match-screen/match-screen.component.ts`: en `ngOnDestroy()`, agregar `this.dialog.closeAll()` ANTES de `this.matchStateService.destroy()` — garantiza que los diálogos se cierran antes de que el servicio limpie la cola (FR-008)

### Tests US2

- [X] T016 [P] [US2] En `src/app/features/match/services/match-event-queue.service.spec.ts`: agregar casos de pausa ante `GAME_SCORE_CHANGED` y `MATCH_FINISHED`:
  - Encolar `GAME_SCORE_CHANGED` → cola pausada → `CARD_PLAYED` del rival encolado → no se aplica hasta `resumeAck()`
  - Encolar `MATCH_FINISHED` → cola pausada → `resumeAck()` → cola sigue

- [X] T017 [US2] En `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`: agregar test `gameWon$ → modal abierto, resumeAck en afterClosed`:
  - Emitir `gameWon$.next({ winnerSeat: 'PLAYER_ONE' })`
  - Verificar `dialogSpy` llamado con `GameWonDialogComponent`
  - Cerrar dialog → verificar `resumeAck` llamado exactamente una vez

**Checkpoint**: US1 + US2 completas. Escenario 6 (encadenado) del quickstart verificado.

---

## Phase 4: User Story 3 — Eventos no bloqueantes siguen con delay temporal (Priority: P2)

**Goal**: Verificar que la lógica de pausa no afecta el flujo de eventos no bloqueantes (cartas, cambios de turno, cantos) ni degrada el ritmo del juego en el caso común.

**Independent Test**: Escenario 3 del [quickstart.md](./quickstart.md). Esta US no requiere cambios de código nuevo — su "implementación" es la verificación de que lo hecho en Phases 1-3 no rompe el path no bloqueante.

### Tests US3

- [X] T018 [P] [US3] En `src/app/features/match/services/match-event-queue.service.spec.ts`: agregar casos que confirmen el path no bloqueante es intacto:
  - Dos `CARD_PLAYED` remotos → ambos con delay 600 ms, sin ACK requerido (igual que tests de 010)
  - `CARD_PLAYED` + `TURN_CHANGED` → comportamiento idéntico a 010 (sin pausas por ACK)
  - Secuencia: `ENVIDO_CALLED` (no bloqueante) → `CARD_PLAYED` → sin pausa

- [X] T019 [US3] En `src/app/features/match/services/match-event-queue.service.spec.ts`: agregar test FR-010 explícito:
  - Encolar `ENVIDO_RESOLVED` + `GAME_SCORE_CHANGED` (dos bloqueantes consecutivos)
  - Aplicar primer evento → cola pausada, spy llamado 1 vez
  - Llamar `resumeAck()` → spy llamado 2 veces inmediatamente (sin avanzar timers adicionales)
  - Cola pausada de nuevo (por segundo evento bloqueante)

**Checkpoint**: Suite de tests de 010 + 011 completa. `pnpm test` verde.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T020 [P] Correr `pnpm test` y resolver cualquier fallo en specs afectados (`match-event-queue.service.spec.ts`, `match-screen.component.spec.ts`)

- [X] T021 [P] Correr `pnpm lint` y `pnpm lint:styles` y `pnpm lint:themes` — no deben haber nuevas advertencias (no se introducen SCSS ni templates nuevos; verificar sólo los archivos modificados)

- [ ] T022 Verificar manualmente los 7 escenarios del [quickstart.md](./quickstart.md) con `pnpm start` — confirmar que la cola se pausa/resume correctamente y que el flujo no bloqueante es idéntico al de la feature 010

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — empezar por aquí. T006 y T007 son independientes entre sí ([P]).
- **US1 (Phase 2)**: Requiere Phase 1 completa. T010, T011, T012 requieren T008 y T009.
- **US2 (Phase 3)**: Requiere Phase 1 completa. T016 y T017 requieren T013, T014, T015.
- **US3 (Phase 4)**: Requiere Phase 1 completa. T018 y T019 son independientes entre sí ([P]).
- **Polish (Phase 5)**: Requiere todas las US deseadas completadas.

### User Story Dependencies

- **US1 (P1)**: Puede empezar en cuanto Phase 1 termine. No depende de US2 ni US3.
- **US2 (P1)**: Puede empezar en cuanto Phase 1 termine (en paralelo con US1 si hubiera capacidad).
- **US3 (P2)**: Verificación/tests que pueden escribirse en cualquier momento tras Phase 1; no cambia código de producción.

### Within Each User Story

- Implementación antes de tests en el componente (se necesita el código real para testear integración).
- Tests del servicio son más unitarios y pueden escribirse en paralelo con la implementación del componente.

### Parallel Opportunities

- T006 ∥ T007 (archivos distintos)
- T010 ∥ T011 ∥ T012 (una vez T008 y T009 completos)
- T016 ∥ T017 (una vez T013, T014, T015 completos)
- T018 ∥ T019 (una vez Phase 1 completa)
- T020 ∥ T021 (comandos distintos)

---

## Parallel Example: Foundational Phase

```bash
# Tareas que pueden ejecutarse en paralelo tras crear el config (T001):
Task T002+T003+T004+T005: Modificar match-event-queue.service.ts (secuencial entre sí — mismo archivo)
Task T006: Actualizar clear()/flushImmediately() en match-event-queue.service.ts (agrupable con T005)
Task T007: Inyectar eventQueue en match-screen.component.ts (paralelo con el servicio)
```

## Parallel Example: User Story 1

```bash
# Una vez T008 y T009 implementados:
Task T010: Tests de servicio (match-event-queue.service.spec.ts)
Task T011: Test componente QUIERO (match-screen.component.spec.ts)
Task T012: Test componente NO_QUIERO (match-screen.component.spec.ts)
# T011 y T012 pueden agruparse en la misma sesión de edición (mismo archivo)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Foundational) — T001 a T007
2. Completar Phase 2 (US1) — T008 a T012
3. **STOP y VALIDAR**: `pnpm test`, escenario 1 y 7 del quickstart
4. Demo: el resultado del envido ya bloquea la cola ✓

### Incremental Delivery

1. Phase 1 → Foundation lista
2. Phase 2 → US1 → Demo (MVP: el caso más doloroso resuelto)
3. Phase 3 → US2 → Demo (fin de partida también pausa la cola)
4. Phase 4 → US3 → Verificación del flujo no bloqueante
5. Phase 5 → Polish

---

## Notes

- [P] tasks = archivos diferentes o comandos independientes, sin bloqueo entre sí
- [Story] label mapea la tarea a su User Story para trazabilidad
- Cada fase debe dejar `pnpm test` en verde antes de continuar
- El catálogo `BLOCKING_MATCH_EVENT_TYPES` es la única fuente de verdad — agregar/quitar tipos no requiere tocar el servicio
- La llamada `resumeAck()` en el componente es siempre síncrona (Subject.next es síncrono) o en `afterClosed()` (que es asíncrono pero idempotente)
- No introducir nuevos SCSS ni colores hardcodeados — `pnpm lint:styles` debe seguir limpio
