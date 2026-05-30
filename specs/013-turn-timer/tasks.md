---

description: "Task list — Temporizador de turno en partida (013-turn-timer)"
---

# Tasks: Temporizador de turno en partida

**Input**: Design documents from `/specs/013-turn-timer/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Incluidas. El proyecto exige `pnpm test` como gate y los contract tests son guardarraíl
de la constitución (§II). Se generan tests acotados a la lógica de tiempo, reducer, ruteo y contrato.

**Organization**: Tareas agrupadas por user story para implementación/validación independiente.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` tras tocar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md` (§4.14/§4.15/§9.6/§4.18) antes de tipar DTOs.
> - **Copy de errores**: "tiempo agotado" es copy del front en español; no mostrar `ApiError.message`.
> - **Mobile floor 360 px**: un único `@media (min-width: 1024px)`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: a qué user story pertenece (US1, US2)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Single project Angular: código en `src/app/`, tests junto al archivo (`*.spec.ts`) y contract tests
en `src/tests/contract/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar que el contrato del backend está documentado y disponible para tipar.

- [x] T001 Verificar en `docs/CONTRATOS_API.md` (§4.14, §4.15, §9.5, §9.6, §4.18) la forma exacta de `actionDeadline`/`turnDurationMillis`/`actionDeadlineSeat` y de los eventos `ACTION_DEADLINE_SET`/`ACTION_DEADLINE_CLEARED`, y dejar nota de cualquier divergencia en `specs/013-turn-timer/contracts/timer-ui-contract.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Plomería de datos del plazo: modelo, eventos, reducer, ruteo WS, cálculo de tiempo y
proyección a la vista. Bloquea a US1 y US2 (ambas dependen del plazo en el estado).

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

- [x] T002 [P] Agregar los campos del plazo (`actionDeadline: number | null`, `turnDurationMillis: number | null`, `actionDeadlineSeat: ViewerSeat | null`) a la interfaz `RoundState` en `src/app/core/models/match.models.ts`, con comentario de fuente `docs/CONTRATOS_API.md §4.14`.
- [x] T003 [P] Agregar `'ACTION_DEADLINE_SET' | 'ACTION_DEADLINE_CLEARED'` a `MatchDerivedEventType` y definir `ActionDeadlineSetPayload { seat: Seat; actionDeadline: number; turnDurationMillis: number }` (y tipo vacío para cleared) en `src/app/features/match/models/match-ws-events.ts`.
- [x] T004 [P] Crear util `src/app/features/match/utils/turn-timer.ts` con: `computeRemainingMsFromEvent(actionDeadline, eventTimestamp)`, `computeRemainingMsFromSnapshot(actionDeadline, serverClockOffsetMs)`, `isUrgent(remainingMs)` (umbral 5000 ms) y constante `URGENCY_THRESHOLD_MS = 5000`.
- [x] T005 [P] Tests de `turn-timer.ts` en `src/app/features/match/utils/turn-timer.spec.ts`: restante vía event timestamp, restante vía offset de snapshot, umbral de urgencia (límite exacto 5000 ms) y restante negativo/0 (FR-006, FR-010, SC-002).
- [x] T006 Aplicar `ACTION_DEADLINE_SET` y `ACTION_DEADLINE_CLEARED` en `applyMatchDerivedEvent()` de `src/app/features/match/reducers/match-event.reducer.ts`: SET setea los 3 campos juntos sobre `roundGame`; CLEARED los pone en `null` (invariante: o los 3 con valor o los 3 null). (depende de T002, T003)
- [x] T007 Tests del reducer en `src/app/features/match/reducers/match-event.reducer.spec.ts`: SET escribe los 3 campos; CLEARED los limpia; no-op si `roundGame === null` (data-model §Transiciones). (depende de T006)
- [x] T008 Rutear los eventos del temporizador en `src/app/features/match/services/match-state.service.ts`: en la suscripción a `/user/queue/match`, derivar `ACTION_DEADLINE_SET`/`ACTION_DEADLINE_CLEARED` (o `stateVersion == null`) hacia `processLiveDerivedEvent`/`derivedBuffer` en vez de `processLiveEvent`/`buffer`, para no romper la reconciliación por `stateVersion` (research D1). (depende de T003)
- [x] T009 Calcular y mantener `serverClockOffsetMs = lastEventTimestamp - Date.now()` en `src/app/features/match/services/match-state.service.ts`, expuesto vía signal de solo lectura para el cálculo del restante en el path de snapshot (research D2). (depende de T008)
- [x] T010 Tests en `src/app/features/match/services/match-state.service.spec.ts`: los eventos del temporizador se procesan como derivados (no avanzan `lastSeenVersion` ni disparan refetch por hueco) y el offset de reloj se deriva del `timestamp` del último evento. (depende de T008, T009)
- [x] T011 Extender `deriveMatchView()` en `src/app/features/match/utils/derive-match-view.ts` para exponer `actionDeadline`, `turnDurationMillis` y `deadlineIsSelf` en `MatchView`, y `hasActiveDeadline` en cada `SeatView` (true si `actionDeadlineSeat` corresponde a ese asiento). (depende de T002)
- [x] T012 Tests en `src/app/features/match/utils/derive-match-view.spec.ts`: `deadlineIsSelf` true/false/null según `actionDeadlineSeat` vs `viewerSeat`, y `hasActiveDeadline` por asiento. (depende de T011)

**Checkpoint**: El estado de partida contiene el plazo y la vista lo proyecta por asiento. Listo para render.

---

## Phase 3: User Story 1 - Ver mi tiempo restante para actuar (Priority: P1) 🎯 MVP

**Goal**: Mostrar el indicador visual de progreso (sin número) sobre el asiento del jugador
autenticado cuando debe actuar, con urgencia ≤ 5 s, y deshabilitar sus controles al llegar a 0
mientras el backend resuelve.

**Independent Test**: En una partida, en el turno propio (o respuesta a canto), aparece el indicador
sobre el asiento "VOS", se vacía en tiempo real, enfatiza a 5 s, y al llegar a 0 los controles
quedan deshabilitados con "tiempo agotado" sin declarar derrota en cliente.

### Implementation for User Story 1

- [x] T013 [P] [US1] Agregar token(es) de urgencia del temporizador en `src/styles.scss` (p. ej. `--t3-timer-track`, `--t3-timer-progress`, `--t3-timer-urgent`) si no existen equivalentes reutilizables.
- [x] T014 [US1] Agregar al `MatchStatusPanelComponent` (`src/app/features/match/components/match-status-panel/match-status-panel.component.ts`) una señal de tiempo restante que se actualiza mientras hay plazo activo (intervalo de baja frecuencia ~200 ms, detenido al limpiar el plazo) usando `turn-timer.ts`, y `computed` de progreso/urgencia. Incluir guarda: si no hay plazo activo, o `actionDeadline` ya venció al cargar, o los campos del plazo son nulos, no mostrar un reloj "en marcha" (oculto o clavado en 0) sin parpadeo (FR-013). (depende de T004, T011)
- [x] T015 [US1] Renderizar el indicador de progreso (anillo, sin número) sobre `status-panel__turn-dot` del asiento con `hasActiveDeadline` en `src/app/features/match/components/match-status-panel/match-status-panel.component.html`, aplicando estado de urgencia ≤ 5 s. (depende de T014)
- [x] T016 [US1] Estilar el anillo y la urgencia en `src/app/features/match/components/match-status-panel/match-status-panel.component.scss` usando exclusivamente `var(--t3-…)`; verificar a 360 px y desktop con único `@media (min-width: 1024px)`. Correr `pnpm lint:styles`. (depende de T015)
- [x] T017 [US1] Exponer `viewerActionTimedOut` (señal) en `src/app/features/match/pages/match-screen/match-screen.component.ts`: true cuando `deadlineIsSelf === true`, `remainingMs <= 0` y `status === 'IN_PROGRESS'`; resetear al cambiar el plazo o terminar la partida. (depende de T011)
- [x] T018 [US1] Pasar `viewerActionTimedOut` a `AvailableActionsPanelComponent` y deshabilitar los controles + mostrar copy "tiempo agotado" en `src/app/features/match/components/available-actions-panel/available-actions-panel.component.{ts,html,scss}`, sin vaciar `availableActions` del estado (research D4, FR-007, FR-008). (depende de T017)
- [x] T019 [US1] Wire del `match-screen` → `match-status-panel` para que el indicador reciba la vista con el plazo, y validar el ciclo de aparición/limpieza (FR-005) en `src/app/features/match/pages/match-screen/match-screen.component.html`. (depende de T015)
- [x] T020 [P] [US1] Tests de `MatchStatusPanelComponent` en `src/app/features/match/components/match-status-panel/match-status-panel.component.spec.ts`: renderiza el indicador sobre el asiento propio cuando `deadlineIsSelf`, aplica clase de urgencia a ≤ 5 s, no renderiza sin plazo activo, y **oculta el indicador cuando `status !== 'IN_PROGRESS'`** (partida finalizada/cancelada, FR-012). (depende de T015)

**Checkpoint**: US1 funcional e independientemente testeable (MVP).

---

## Phase 4: User Story 2 - Ver el tiempo del rival (Priority: P2)

**Goal**: Mostrar el mismo indicador sobre el asiento del rival cuando es él quien debe actuar.

**Independent Test**: En el turno del rival, el indicador aparece sobre el asiento "RIVAL", se vacía
en tiempo real, y desaparece/transfiere al actuar.

### Implementation for User Story 2

- [x] T021 [US2] Verificar/ajustar el render del indicador para el asiento del rival en `src/app/features/match/components/match-status-panel/match-status-panel.component.html` (caso `deadlineIsSelf === false` → pintar sobre el `status-panel__turn-dot` ubicado dentro de `status-panel__player-header--right`), reutilizando la lógica de US1. (depende de T015)
- [x] T022 [P] [US2] Tests en `src/app/features/match/components/match-status-panel/match-status-panel.component.spec.ts`: el indicador se renderiza sobre el asiento del rival cuando `deadlineIsSelf === false` y se traslada al cambiar `actionDeadlineSeat`. (depende de T021)

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Contrato, reconexión y verificación final.

- [x] T023 [P] Crear contract test `src/tests/contract/action-deadline.contract.spec.ts` que verifique paridad de `eventType` y forma de payloads (`ACTION_DEADLINE_SET`/`ACTION_DEADLINE_CLEARED`) contra `docs/CONTRATOS_API.md §9.6` (patrón de `src/tests/contract/`). (constitución §II)
- [x] T024 Verificar el caso de reconexión/recarga a mitad de turno (FR-009, SC-003): el snapshot inicializa el plazo y el indicador arranca en el restante correcto usando `serverClockOffsetMs`; agregar/ajustar test en `src/app/features/match/services/match-state.service.spec.ts`.
- [ ] T025 [P] Ejecutar `specs/013-turn-timer/quickstart.md` (verificación manual US1/US2/0/reconexión/fin/bot/responsive 360px y desktop). PENDIENTE: requiere correr la app contra el backend con la feature de temporizador activa.
- [x] T026 [P] Correr gates: `pnpm lint`, `pnpm lint:styles`, `pnpm test`, `pnpm build` y dejar verde.
- [x] T027 Manejar el caso de plazo ausente/nulo o ya vencido al cargar el estado (FR-013): en `src/app/features/match/utils/turn-timer.ts` y en la guarda de `MatchStatusPanelComponent` (T014), normalizar `remainingMs <= 0` a "tiempo agotado"/oculto y tratar campos nulos como "sin reloj", sin parpadeo ni reloj en marcha incorrecto.
- [x] T028 [P] Tests de FR-013 en `src/app/features/match/utils/turn-timer.spec.ts` y `match-status-panel.component.spec.ts`: snapshot con `actionDeadline` en el pasado → estado agotado/oculto; campos del plazo nulos en partida en curso → sin indicador. (depende de T027)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. BLOQUEA todas las user stories.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational; reutiliza el render de US1 (T015).
- **Polish (Phase 5)**: depende de las user stories implementadas.

### User Story Dependencies

- **US1 (P1)**: arranca tras Foundational. Sin dependencia de otras stories.
- **US2 (P2)**: arranca tras Foundational; comparte el componente con US1 (no rompe su independencia de test).

### Within Each Story

- Modelo/eventos → reducer → servicio/ruteo → util/vista → componente/UI → tests.

### Parallel Opportunities

- T002, T003, T004 (+ T005) en paralelo (archivos distintos).
- T013 y T020 marcados [P] dentro de US1.
- T022, T023, T025, T026 en paralelo en Polish.

---

## Parallel Example: Foundational

```bash
# Plomería base en paralelo (archivos distintos):
Task: "T002 Campos del plazo en core/models/match.models.ts"
Task: "T003 Tipos de evento del temporizador en features/match/models/match-ws-events.ts"
Task: "T004 Util turn-timer.ts + T005 sus tests"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRÍTICO) → 3. Phase 3 US1 → 4. Validar US1 solo → demo.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → test independiente → MVP.
3. US2 → test independiente.
4. Polish (contrato, reconexión, gates).

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- El backend es el árbitro: el cliente nunca declara derrota por timeout (FR-007).
- Los eventos del temporizador van por `/user/queue/match` con `stateVersion: null` → tratarlos como derivados (research D1).
- Commit tras cada tarea o grupo lógico.
