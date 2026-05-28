# Tasks: Action bar bloqueada durante delay de eventos

**Input**: Design documents from `/specs/012-delay-gated-action-bar/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: No se solicitaron tests explícitamente en esta feature. Los tests son opcionales.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` después de cambiar estilos.
> - **Contrato de endpoints**: No aplica — no se consumen endpoints nuevos.
> - **CTAs verticales**: No aplica — no se crean CTAs nuevos.
> - **Copy de errores**: No aplica — no hay nuevos flujos de error.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app Angular**: `src/app/features/match/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No se requiere setup adicional — la feature se integra con la infraestructura existente (cola de eventos, signals, componentes standalone)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Signal `isProcessingDelay` en la cola de eventos — prerequisito bloqueante para TODAS las user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 Agregar signal `isProcessingDelay` en `MatchEventQueueService` en `src/app/features/match/services/match-event-queue.service.ts`
- [x] T002 Actualizar método `schedule()` para activar el signal cuando un item con `delayMs > 0` comienza a procesarse
- [x] T003 Actualizar callback de `setTimeout` para desactivar el signal cuando termina de procesarse
- [x] T004 Actualizar método `clear()` para resetear el signal a `false`
- [x] T005 Agregar método privado `updateProcessingDelayState()` que verifique si hay items pendientes con `delayMs > 0`

**Checkpoint**: Signal `isProcessingDelay` funcional — la cola ahora expone el estado de procesamiento con delay

---

## Phase 3: User Story 1 - El action bar se deshabilita mientras se procesan eventos con delay (Priority: P1) 🎯 MVP

**Goal**: Durante el periodo de delay de un evento remoto, el action bar se muestra con todas las opciones deshabilitadas y se vuelve directamente al panel principal (ActionBarComponent)

**Independent Test**: Forzar un evento remoto con delay de 600ms y verificar que durante ese periodo, el action bar muestra los botones de Truco/Envido/Mazo pero todos deshabilitados, sin submenús ni paneles de respuesta

### Implementation for User Story 1

- [x] T006 [P] [US1] Agregar input `isProcessingDelay` en `ActionBarComponent` en `src/app/features/match/components/available-actions-panel/action-bar/action-bar.component.ts`
- [x] T007 [US1] Modificar computed `items` en `ActionBarComponent` para forzar `enabled: false` en todos los botones cuando `isProcessingDelay` es `true`
- [x] T008 [P] [US1] Agregar input `isProcessingDelay` en `AvailableActionsPanelComponent` en `src/app/features/match/components/available-actions-panel/available-actions-panel.component.ts`
- [x] T009 [US1] Agregar computed `shouldCollapseToActionBar` en `AvailableActionsPanelComponent` que retorne `true` cuando `isProcessingDelay` es `true`
- [x] T010 [US1] Modificar template `available-actions-panel.component.html` para colapsar a `ActionBarComponent` cuando `shouldCollapseToActionBar()` es `true`
- [x] T011 [US1] Agregar input `isProcessingDelay` en `GameBoardComponent` en `src/app/features/match/components/game-board/game-board.component.ts`
- [x] T012 [US1] Pasar `isProcessingDelay` desde `GameBoardComponent` a `AvailableActionsPanelComponent` en el template
- [x] T013 [US1] Inyectar `MatchEventQueueService` en `MatchScreenComponent` y exponer `eventQueue.isProcessingDelay`
- [x] T014 [US1] Pasar `eventQueue.isProcessingDelay()` al `GameBoardComponent` en el template de `MatchScreenComponent`

**Checkpoint**: User Story 1 funcional — durante delay, el action bar se muestra deshabilitado y colapsado al panel principal

---

## Phase 4: User Story 2 - Las cartas también se bloquean durante el delay (Priority: P2)

**Goal**: Las cartas del jugador se muestran bloqueadas (deshabilitadas) durante el periodo de delay de un evento remoto

**Independent Test**: Forzar un evento remoto con delay y verificar que los botones de cartas en la mano del jugador están deshabilitados con el estilo `player-hand__card-btn--blocked`

### Implementation for User Story 2

- [x] T015 [P] [US2] Agregar input `isProcessingDelay` en `PlayerHandComponent` en `src/app/features/match/components/player-hand/player-hand.component.ts`
- [x] T016 [US2] Modificar computed de disabled en `PlayerHandComponent` para incluir `isProcessingDelay()` como condición de bloqueo
- [x] T017 [US2] Agregar input `isProcessingDelay` en `PlayerAreaComponent` en `src/app/features/match/components/player-area/player-area.component.ts`
- [x] T018 [US2] Pasar `isProcessingDelay` desde `GameBoardComponent` a `PlayerAreaComponent` en el template
- [x] T019 [US2] Pasar `isProcessingDelay` desde `PlayerAreaComponent` a `PlayerHandComponent` en el template

**Checkpoint**: User Story 2 funcional — cartas deshabilitadas durante delay

---

## Phase 5: User Story 3 - Los eventos locales no activan el bloqueo (Priority: P2)

**Goal**: Las acciones del jugador local (jugar carta, cantar truco, etc.) no activan el bloqueo del action bar

**Independent Test**: Ejecutar una acción local (ej. jugar una carta) y verificar que el action bar nunca se deshabilita

### Implementation for User Story 3

- [x] T020 [US3] Verificar que `resolveDelay()` retorna `0` para eventos locales en `src/app/features/match/config/match-event-delays.config.ts`
- [x] T021 [US3] Verificar que `enqueueTransactional()` calcula `local = true` correctamente en `src/app/features/match/services/match-event-queue.service.ts`
- [x] T022 [US3] Verificar que `schedule()` no activa `isProcessingDelay` cuando `delayMs === 0` en `src/app/features/match/services/match-event-queue.service.ts`

**Checkpoint**: User Story 3 verificada — eventos locales no activan bloqueo

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final y integración

- [x] T023 Ejecutar `pnpm lint:styles` para verificar que no se introdujeron colores hardcodeados
- [x] T024 Ejecutar `pnpm lint` para verificar lint general
- [x] T025 Ejecutar `pnpm test` para verificar que no se rompieron tests existentes
- [x] T026 Ejecutar `pnpm build` para verificar compilación completa
- [ ] T027 Verificar manualmente el flujo: evento remoto → delay → action bar deshabilitado → delay termina → action bar habilitado
- [ ] T028 Verificar manualmente que eventos locales no activan el bloqueo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No aplica — no hay setup adicional
- **Foundational (Phase 2)**: Sin dependencias — puede comenzar inmediatamente. **BLOQUEA** todas las user stories
- **User Story 1 (Phase 3)**: Depende de Phase 2 completa
- **User Story 2 (Phase 4)**: Depende de Phase 2 completa. Puede ejecutarse en paralelo con US1
- **User Story 3 (Phase 5)**: Depende de Phase 2 completa. Es una verificación, no una implementación
- **Polish (Phase 6)**: Depende de que US1 y US2 estén completas

### User Story Dependencies

- **User Story 1 (P1)**: Depende de Phase 2 (signal isProcessingDelay). Sin dependencias de otras stories
- **User Story 2 (P2)**: Depende de Phase 2. Puede ejecutarse en paralelo con US1
- **User Story 3 (P2)**: Depende de Phase 2. Es una verificación de comportamiento existente

### Within Each User Story

- Componentes padre antes que hijos (GameBoard → AvailableActionsPanel → ActionBar)
- Signal de entrada antes que lógica de consumo
- Template después de lógica TypeScript

### Parallel Opportunities

- T006 y T008 pueden ejecutarse en paralelo (diferentes archivos)
- T015 y T017 pueden ejecutarse en paralelo (diferentes archivos)
- US1 y US2 pueden ejecutarse en paralelo después de Phase 2

---

## Parallel Example: User Story 1

```bash
# Tareas paralelas iniciales (diferentes archivos):
Task: "T006 Agregar input isProcessingDelay en ActionBarComponent"
Task: "T008 Agregar input isProcessingDelay en AvailableActionsPanelComponent"

# Después de ambas:
Task: "T007 Modificar computed items en ActionBarComponent"
Task: "T009 Agregar computed shouldCollapseToActionBar"

# Después de ambas:
Task: "T010 Modificar template available-actions-panel.component.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (signal isProcessingDelay)
2. Complete Phase 3: User Story 1 (action bar deshabilitado)
3. **STOP and VALIDATE**: Verificar que el action bar se deshabilita durante delay
4. El juego ya es jugable con este MVP — el jugador no puede actuar sobre información stale

### Incremental Delivery

1. Complete Phase 2: Signal isProcessingDelay listo
2. Add User Story 1 → Action bar deshabilitado → **MVP funcional**
3. Add User Story 2 → Cartas también bloqueadas → Experiencia completa
4. Add User Story 3 → Verificación de que locales no se afectan
5. Add Polish → Verificación final

### Parallel Team Strategy

Con múltiples desarrolladores:

1. Developer A: Phase 2 (signal isProcessingDelay)
2. Developer B (después de Phase 2): User Story 1 (action bar)
3. Developer C (después de Phase 2): User Story 2 (cartas)
4. Junto: Phase 5 (verificación) + Phase 6 (polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No se solicitaron tests explícitamente — se omite la sección de tests
- Verificar `pnpm lint:styles` después de cualquier cambio en templates o estilos
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
