---
description: "Tasks — Cola serial de eventos WebSocket de match"
---

# Tasks: Cola serial de eventos WebSocket de match

**Input**: Design documents from `/specs/010-ws-event-queue/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/match-event-queue.contract.md, quickstart.md

**Tests**: INCLUIDOS — el plan exige tests unitarios con Vitest (research §D7) sobre `MatchEventQueueService` y actualización del spec de `MatchStateService`.

> **Guardarraíles del proyecto** — recordatorio:
> - **Tokens CSS**: N/A en esta feature (sólo TS).
> - **Contrato**: sin cambios en DTOs ni endpoints; tipos `MatchWsEvent` / `MatchDerivedEvent` se reutilizan tal cual.
> - **CTAs**: N/A.
> - **Copy de errores**: la cola no produce errores visibles; sólo `console.warn` en fallos defensivos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: a qué user story pertenece (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Crear los archivos vacíos/esqueleto del feature dentro de `src/app/features/match/`.

- [X] T001 [P] Crear archivo de configuración vacío `src/app/features/match/config/match-event-delays.config.ts` (sólo cabecera de export).
- [X] T002 [P] Crear esqueleto del servicio `src/app/features/match/services/match-event-queue.service.ts` con `@Injectable()` y firma pública del contrato (sin implementación).
- [X] T003 [P] Crear esqueleto del spec `src/app/features/match/services/match-event-queue.service.spec.ts` con `describe('MatchEventQueueService')` y `vi.useFakeTimers()` en `beforeEach`.

**Checkpoint**: archivos creados, `pnpm tsc --noEmit` pasa (esqueletos compilan).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuración de delays y API pública del servicio. Sin esto, ninguna user story arranca.

**⚠️ CRITICAL**: Bloquea US1, US2 y US3.

- [X] T004 Implementar `MATCH_EVENT_DELAYS_MS`, `DEFAULT_MATCH_EVENT_DELAY_MS` y `resolveDelay(eventType, local)` en `src/app/features/match/config/match-event-delays.config.ts` siguiendo la tabla del contrato (research §D3, contract §Configuración consumida).
- [X] T005 Definir tipos internos `QueuedMatchEvent` y `MatchEventQueueDeps` dentro de `src/app/features/match/services/match-event-queue.service.ts` según `data-model.md`.
- [X] T006 Implementar API pública del `MatchEventQueueService` en `src/app/features/match/services/match-event-queue.service.ts`: `init(deps)`, `enqueueTransactional(event)`, `enqueueDerived(event)`, `flushImmediately()`, `clear()`, `pendingCount()`. Worker basado en `setTimeout` con flag `processing` y `pendingTimerId` (research §D1, data-model §Estado interno).
- [X] T007 Implementar detección `local` en `enqueueTransactional`: comparar `event.payload.seat === deps.getViewerSeat()`; si match → `delayMs = 0` (FR-004, research §D2). Los `enqueueDerived` siempre fuerzan `delayMs = 0`.
- [X] T008 Implementar `clear()` (cancela `clearTimeout(pendingTimerId)`, vacía array, resetea flags) y `flushImmediately()` (cancela timer, aplica todos los pendientes en orden con delay 0, vuelve a IDLE) en el mismo archivo (contract §Semántica garantizada 5–6).
- [X] T009 Implementar coalescing conservador de `TURN_CHANGED` consecutivos del mismo seat sin nada en medio (research §D6) en `enqueueTransactional`.

**Checkpoint**: El servicio compila y expone la API. Listo para US1/US2/US3.

---

## Phase 3: User Story 1 - El rival/bot juega dos cartas seguidas y se ven separadas (Priority: P1) 🎯 MVP

**Goal**: Cuando llegan dos `CARD_PLAYED` remotos en ráfaga, la segunda carta se renderiza ≥ 500 ms después de la primera.

**Independent Test**: bot match → forzar dos `CARD_PLAYED` consecutivos del bot → observar separación ≥ 500 ms entre renders.

### Tests para User Story 1

> Tests primero, deben FALLAR antes de la implementación de integración.

- [X] T010 [P] [US1] Test unitario: enqueue dos `CARD_PLAYED` remotos → ambos `apply` se invocan, con `vi.advanceTimersByTime(600)` entre uno y el siguiente; el segundo no se llama antes — en `src/app/features/match/services/match-event-queue.service.spec.ts`.
- [X] T011 [P] [US1] Test unitario: enqueue un `CARD_PLAYED` remoto y luego un `TURN_CHANGED` → el `CARD_PLAYED` se aplica primero respetando su delay, el `TURN_CHANGED` se aplica inmediatamente después (delay 0) — en `src/app/features/match/services/match-event-queue.service.spec.ts`.

### Implementación para User Story 1

- [X] T012 [US1] Inyectar `MatchEventQueueService` en `src/app/features/match/services/match-state.service.ts` (constructor / `inject()`) y agregar el provider a `src/app/features/match/pages/match-screen/match-screen.component.ts` (`providers: [MatchStateService, MatchEventQueueService]`).
- [X] T013 [US1] En `MatchStateService.init(matchId)` invocar `this.eventQueue.init({ getViewerSeat, applyTransactional, applyDerived })` con callbacks que llamen al reducer / increment de `stateVersion` existente — `src/app/features/match/services/match-state.service.ts` (contract §Integración).
- [X] T014 [US1] Refactorizar `processLiveEvent(event)` en `match-state.service.ts`: tras la validación de `stateVersion` reemplazar la llamada directa a `applyAndIncrement` por `this.eventQueue.enqueueTransactional(event)`. Mantener el buffer de carga (cuando `loading() === true`) sin pasar por la cola.
- [X] T015 [US1] En `MatchStateService.destroy()` llamar `this.eventQueue.clear()` antes de `unsubscribeAll` (FR-011) — `src/app/features/match/services/match-state.service.ts`.

**Checkpoint**: bot match con dos cartas consecutivas del bot muestra separación visible; T010 verde.

---

## Phase 4: User Story 2 - Los cantos del rival no aparecen antes que la jugada que los motiva (Priority: P1)

**Goal**: La carta del rival siempre se renderiza antes que el panel de respuesta al canto, aún cuando ambos eventos llegan en el mismo tick del backend.

**Independent Test**: forzar `CARD_PLAYED` (remoto) inmediatamente seguido de `ENVIDO_CALLED` (remoto) → carta visible primero, panel de respuesta aparece tras el delay.

### Tests para User Story 2

- [X] T016 [P] [US2] Test unitario: enqueue `CARD_PLAYED` remoto + `ENVIDO_CALLED` remoto + `AVAILABLE_ACTIONS_UPDATED` (derived) → orden de `apply` es exactamente ese, con delay entre los dos transaccionales y derived inmediato tras el segundo — en `src/app/features/match/services/match-event-queue.service.spec.ts`.
- [X] T017 [P] [US2] Test unitario: enqueue dos cantos remotos encadenados (`ENVIDO_CALLED` + `TRUCO_CALLED`) → se aplican uno por uno, cada uno respetando su delay configurado — en `src/app/features/match/services/match-event-queue.service.spec.ts`.

### Implementación para User Story 2

- [X] T018 [US2] Refactorizar `processLiveDerivedEvent(event)` en `src/app/features/match/services/match-state.service.ts` para llamar `this.eventQueue.enqueueDerived(event)` en lugar de aplicar directo (preserva orden causal entre `/user/queue/match` y `/user/queue/match-derived`, FR-007).
- [X] T019 [US2] Verificar que `AvailableActionsService` / consumidores de `availableActions$` no necesitan cambios: la cola sólo retrasa el momento del `Subject.next`; los componentes siguen suscritos igual. Documentar en comentario breve en `match-state.service.ts` si hace falta justificar.

**Checkpoint**: secuencia carta + canto del rival se ve en orden; T016/T017 verdes.

---

## Phase 5: User Story 3 - Mis propias acciones siguen siendo instantáneas (Priority: P2)

**Goal**: el eco WS de la propia jugada/canto del usuario local atraviesa la cola con delay 0; el feedback óptico inmediato no se ve afectado.

**Independent Test**: jugar carta local → carta visible al instante; al llegar el eco WS, no hay re-animación ni delay.

### Tests para User Story 3

- [X] T020 [P] [US3] Test unitario: con `getViewerSeat` mockeado a `MANO`, encolar `CARD_PLAYED` con `payload.seat = MANO` → `apply` se invoca sincrónicamente (sin avanzar timers), `pendingCount()` queda en 0 — en `src/app/features/match/services/match-event-queue.service.spec.ts`.
- [X] T021 [P] [US3] Test unitario: secuencia evento local + evento remoto → el local se aplica inmediatamente, luego comienza el delay del remoto — en `src/app/features/match/services/match-event-queue.service.spec.ts`.

### Implementación para User Story 3

- [X] T022 [US3] Verificar que `getViewerSeat` resuelve correctamente en `match-state.service.ts` (`this.state()?.viewerSeat ?? null`) y se pasa al `eventQueue.init`; ajustar si el snapshot todavía no está cargado al primer evento (devolver `null` ⇒ todo se trata como remoto, que es seguro).

**Checkpoint**: jugada local sigue percibiéndose instantánea; T020/T021 verdes.

---

## Phase 6: Edge cases (reconexión, snapshot, navegación)

**Purpose**: cubrir FR-006, FR-010, FR-011 y los edge cases del spec.

- [X] T023 [P] Test unitario: `flushImmediately()` con 5 ítems pendientes → todos se aplican en orden sin avanzar timers; tras la llamada `pendingCount()` es 0 — en `src/app/features/match/services/match-event-queue.service.spec.ts` (cubre FR-006 y SC-004).
- [X] T024 [P] Test unitario: `clear()` cancela el timer pendiente y descarta los ítems sin aplicar; un nuevo `enqueueTransactional` posterior funciona normalmente — en `src/app/features/match/services/match-event-queue.service.spec.ts` (cubre FR-011).
- [X] T025 [P] Test unitario: coalescing — enqueue `TURN_CHANGED(seat=PIE)` + `TURN_CHANGED(seat=PIE)` consecutivos → `apply` se invoca una sola vez — en `src/app/features/match/services/match-event-queue.service.spec.ts` (cubre FR-008).
- [X] T026 En el handler de reconexión del `MatchStateService` (cuando `wasConnected && isConnected && !loading`), invocar `this.eventQueue.flushImmediately()` **antes** de `loading.set(true)` y el `fetchSnapshot` — `src/app/features/match/services/match-state.service.ts` (research §D4).
- [X] T027 Actualizar `src/app/features/match/services/match-state.service.spec.ts`: mockear `MatchEventQueueService`, verificar que (a) eventos vivos invocan `enqueueTransactional` / `enqueueDerived` en lugar del apply directo, (b) eventos del buffer de carga siguen aplicándose sin pasar por la cola, (c) `destroy()` llama `clear()`, (d) reconexión llama `flushImmediately()` antes del refetch.

**Checkpoint**: edge cases cubiertos por tests; flush en reconexión integrado.

---

## Phase 7: Polish & Cross-Cutting

- [X] T028 [P] Correr `pnpm test src/app/features/match/services/match-event-queue.service.spec.ts` y `pnpm test src/app/features/match/services/match-state.service.spec.ts` — ambos verdes.
- [X] T029 [P] Correr `pnpm lint` y `pnpm build` — sin errores ni warnings nuevos.
- [ ] T030 Validación manual siguiendo `specs/010-ws-event-queue/quickstart.md`: bot match con dos cartas seguidas, carta+canto, fin de partida con cola pendiente, chat/lobby sin regresión.
- [ ] T031 Tunear los valores numéricos de `MATCH_EVENT_DELAYS_MS` si la validación manual evidencia delays incómodos (subir/bajar 100–200 ms en `CARD_PLAYED` o `HAND_RESOLVED`); cualquier cambio queda en `src/app/features/match/config/match-event-delays.config.ts` solamente.

---

## Dependencies & Execution Order

### Fases

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Phase 1. BLOQUEA todas las user stories.
- **Phase 3 (US1)**, **Phase 4 (US2)**, **Phase 5 (US3)**: pueden empezar en paralelo tras Phase 2.
- **Phase 6 (edge cases)**: depende de Phase 3–5 (necesita la integración en `MatchStateService` para el flush de reconexión).
- **Phase 7 (polish)**: al final.

### Dentro de cada user story

- Tests [P] primero (deben FALLAR antes de la integración en `MatchStateService`).
- Integración en `MatchStateService` después.

### Cuidado con el archivo compartido

`src/app/features/match/services/match-state.service.ts` es tocado por T012, T013, T014, T015, T018, T022, T026. **No paralelizar** estas tareas: secuenciarlas dentro de su user story / fase.

### Oportunidades de paralelismo

- T001/T002/T003 (esqueletos en archivos distintos).
- T010/T011 dentro de US1, T016/T017 dentro de US2, T020/T021 dentro de US3, T023/T024/T025 en Phase 6 — todos son specs en el mismo archivo `match-event-queue.service.spec.ts`; marcados [P] sólo porque son `it()` blocks independientes, pero al editar el mismo archivo conviene aplicarlos secuencialmente o en un mismo PR.
- US1, US2 y US3 pueden trabajarse por developers distintos siempre que sincronicen los cambios sobre `match-state.service.ts`.

---

## Parallel Example: User Story 1

```bash
# Tests primero (mismo archivo, pero it() independientes):
T010  [US1] enqueue dos CARD_PLAYED remotos → delay entre ambos
T011  [US1] CARD_PLAYED remoto + TURN_CHANGED → carta primero, turno inmediato

# Implementación (secuencial sobre match-state.service.ts):
T012 → T013 → T014 → T015
```

---

## Implementation Strategy

### MVP (US1 solamente)

1. Phase 1: Setup → archivos creados.
2. Phase 2: Foundational → servicio + config listos.
3. Phase 3: US1 → carta del rival con delay.
4. **STOP y validar**: bot match, dos cartas seguidas del bot, ≥ 500 ms entre renders.
5. Si todo OK → ya hay valor entregable; mergear como increment.

### Incremental Delivery

1. Setup + Foundational.
2. + US1 → MVP demo-able.
3. + US2 → cantos en orden.
4. + US3 → eco local sin delay (confirmar que no hay regresión).
5. + Phase 6 → flush en reconexión + edge case tests.
6. + Phase 7 → lint/build/quickstart.

---

## Notes

- `[P]` = archivo distinto o test independiente sin dependencia.
- `MatchStateService` es el cuello de botella: cualquier tarea que lo toca debe coordinarse.
- No hay tests E2E para esta feature; los acceptance scenarios se validan con unit tests + quickstart manual.
- Los valores de delay son tuneables sin tocar componentes consumidores (sólo `match-event-delays.config.ts`).
- No commitear cambios al contrato ni a `docs/CONTRATOS_API.md`: la feature es 100 % cliente.
