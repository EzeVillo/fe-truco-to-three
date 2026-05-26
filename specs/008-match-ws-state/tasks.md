---

description: "Task list template for feature implementation"
---

# Tasks: Estado de partida en tiempo real vía WebSocket

**Input**: Design documents from `/specs/008-match-ws-state/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` después de cambiar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md` antes de tipar un DTO. `gamesToPlay ∈ {1,3,5}`.
> - **CTAs verticales**: título + descripción en spans separados, `flex-direction: column`, no `mat-flat-button`.
> - **Copy de errores**: usar `getErrorCopy()`, nunca `ApiError.message` crudo en la UI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar infraestructura existente del proyecto Angular para la feature

- [X] T001 Verificar que `WebSocketService` y `HttpClient` están configurados y listos para usar en `src/app/core/services/websocket.service.ts`
- [X] T002 Verificar que `RoundWonDialogComponent` existe y es importable desde `src/app/features/match/components/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelos de datos, reducer puro y esqueleto del servicio que TODAS las user stories necesitan

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Crear `src/app/features/match/models/match-ws-events.ts` con tipos `MatchWsEvent`, `MatchDerivedEvent`, enums y payloads de eventos (verificar contra `docs/CONTRATOS_API.md §9.4–9.6`)
- [X] T004 [P] Crear `src/app/features/match/reducers/match-event.reducer.ts` con `applyMatchEvent()` y `applyMatchDerivedEvent()` — funciones puras sin efectos secundarios
- [X] T005 [P] Crear test de contrato `src/tests/contract/match-ws.contract.spec.ts` validando paridad de tipos con `docs/CONTRATOS_API.md §4.14` y `§9.3–9.6`
- [X] T006 Crear `src/app/features/match/reducers/match-event.reducer.spec.ts` con tests por cada tipo de evento que modifica estado e idempotencia
- [X] T007 Crear `src/app/features/match/services/match-state.service.ts` con señales (`state`, `loading`, `error`), `Subject<MatchEndedEvent> matchEnded$`, y esqueleto de `init()` / `destroy()`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Ver el estado real de la partida al ingresar (Priority: P1) 🎯 MVP

**Goal**: Al navegar a `/match/:matchId`, la pantalla muestra el estado real del servidor (marcador, cartas, turno) con un spinner de carga visible mientras se bootstrapa.

**Independent Test**: Navegar a una partida activa y verificar que el marcador, las cartas en mano y el turno actual coinciden con lo que reporta el servidor. El spinner desaparece al terminar la carga.

### Tests for User Story 1 (OPTIONAL - only if tests requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T008 [P] [US1] Escribir tests de bootstrap en `src/app/features/match/services/match-state.service.spec.ts`: verificar que `loading` pasa a `false` tras GET + drain de buffers
- [ ] T009 [P] [US1] Escribir tests de error de carga inicial en `src/app/features/match/services/match-state.service.spec.ts`: verificar `error = true` y `state = null` ante fallo del GET

### Implementation for User Story 1

- [X] T010 [US1] Implementar flujo de bootstrap en `MatchStateService.init()`: suscribirse a `/user/queue/match` y `/user/queue/match-derived` antes del GET, bufferizar eventos, ejecutar `GET /api/matches/{matchId}`, drenar buffers con reducer, pasar `loading` a `false`
- [X] T011 [US1] Agregar manejo de error en bootstrap de `MatchStateService`: si el GET inicial falla, `error.set(true)`, `loading.set(false)`, mostrar mensaje genérico y opción de reintentar/volver al lobby
- [X] T012 [US1] Actualizar `src/app/features/match/pages/match-screen/match-screen.component.ts` para inyectar `MatchStateService`, llamar `init(matchId)` en `ngOnInit`, eliminar uso de datos de prueba
- [X] T013 [US1] Actualizar `src/app/features/match/pages/match-screen/match-screen.component.html` para mostrar `<mat-progress-spinner>` mientras `matchStateService.loading()` es `true`, y renderizar `GameBoardComponent` solo cuando `loading()` es `false` y `state()` no es nulo
- [X] T014 [US1] Actualizar `src/app/features/match/pages/match-screen/match-screen.component.spec.ts` para testear visibilidad del spinner, binding al estado real, y eliminación de datos de prueba

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Recibir actualizaciones de partida en tiempo real (Priority: P1)

**Goal**: Durante la partida, cada acción de cualquier jugador se refleja en la pantalla del otro sin recargar, con deduplicación y detección de huecos en la secuencia.

**Independent Test**: Con dos navegadores en la misma partida, jugar una carta en uno y verificar que el otro muestra la carta en la mesa y el turno cambiado sin recargar. Verificar que eventos duplicados no afectan el estado.

### Tests for User Story 2 (OPTIONAL - only if tests requested) ⚠️

- [ ] T015 [P] [US2] Escribir tests de procesamiento live en `src/app/features/match/services/match-state.service.spec.ts`: evento con `stateVersion == lastApplied + 1` actualiza el estado
- [ ] T016 [P] [US2] Escribir tests de deduplicación en `src/app/features/match/services/match-state.service.spec.ts`: evento con `stateVersion <= lastApplied` se descarta sin mutar estado
- [ ] T017 [P] [US2] Escribir tests de detección de huecos en `src/app/features/match/services/match-state.service.spec.ts`: evento con `stateVersion > lastApplied + 1` dispara re-fetch GET

### Implementation for User Story 2

- [X] T018 [US2] Implementar procesamiento de eventos transaccionales en modo live en `MatchStateService`: aplicar reducer cuando `stateVersion == lastApplied + 1`, actualizar `state` y `lastApplied`
- [X] T019 [US2] Implementar deduplicación en `MatchStateService`: descartar eventos entrantes con `stateVersion <= lastApplied`
- [X] T020 [US2] Implementar detección de huecos en `MatchStateService`: si `stateVersion > lastApplied + 1`, disparar re-fetch de `GET /api/matches/{matchId}` y reiniciar bootstrap
- [X] T021 [US2] Implementar reconexión en `MatchStateService`: observar `WebSocketService.connected`; al detectar reconexión (`false` → `true`), re-suscribirse y re-ejecutar bootstrap con el mismo `matchId`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Ver resultado al finalizar la partida (Priority: P2)

**Goal**: Al terminar la partida (victoria, abandono o forfeit), ambos jugadores ven el diálogo de resultado reutilizando `RoundWonDialogComponent`, y al cerrarlo navegan al lobby.

**Independent Test**: Forzar el fin de partida (victoria normal o abandono) y verificar que el diálogo aparece con el resultado correcto. Cerrar el diálogo y verificar navegación al lobby.

### Tests for User Story 3 (OPTIONAL - only if tests requested) ⚠️

- [ ] T022 [P] [US3] Escribir test de apertura de diálogo en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`: al recibir `MATCH_FINISHED`, se abre `RoundWonDialogComponent` con datos mapeados correctamente
- [ ] T023 [P] [US3] Escribir test de navegación post-diálogo en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`: `afterClosed()` navega a `['/']`

### Implementation for User Story 3

- [X] T024 [US3] En `MatchStateService`, emitir evento por `matchEnded$` al recibir `MATCH_FINISHED`, `MATCH_ABANDONED` o `MATCH_FORFEITED`
- [X] T025 [US3] En `match-screen.component.ts`, suscribirse a `matchStateService.matchEnded$` en `ngOnInit` y abrir `MatDialog.open(RoundWonDialogComponent, { data: mappedData })`
- [X] T026 [US3] Implementar mapeo de payload de fin de partida a `RoundWonDialogData` en `match-screen.component.ts` (resolviendo `playerName`, `opponentName`, `playerRoundsWon`, etc. desde `viewerSeat`)
- [X] T027 [US3] Agregar `afterClosed().subscribe(() => router.navigate(['/']))` tras abrir el diálogo de resultado en `match-screen.component.ts`
- [X] T028 [US3] Manejar edge case en `match-screen.component.ts`: si la partida ya está `FINISHED` al cargar el estado inicial, mostrar el diálogo de resultado inmediatamente

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Actualización de mano y acciones disponibles (Priority: P2)

**Goal**: Las cartas en mano y las acciones disponibles se actualizan automáticamente tras cada evento relevante, sin validación de secuencia.

**Independent Test**: Jugar todas las cartas de una ronda y verificar que la mano del jugador se vacía carta por carta. Verificar que las acciones disponibles cambian al cambiar el turno.

### Tests for User Story 4 (OPTIONAL - only if tests requested) ⚠️

- [ ] T029 [P] [US4] Escribir tests de eventos derivados en `src/app/features/match/services/match-state.service.spec.ts`: `AVAILABLE_ACTIONS_UPDATED` y `PLAYER_HAND_UPDATED` actualizan el estado sin validar `stateVersion`

### Implementation for User Story 4

- [X] T030 [US4] Verificar en `MatchStateService` que la suscripción a `/user/queue/match-derived` aplica todos los eventos derivados directamente vía `applyMatchDerivedEvent()` sin validación de secuencia
- [X] T031 [US4] Eliminar los mock switchers (`mock-actions-state-switcher`, `mock-envido-result-switcher`, `mock-round-won-switcher`) del template de producción en `src/app/features/match/pages/match-screen/match-screen.component.html`
- [X] T032 [US4] Verificar que los componentes mock (`mock-actions-state-switcher`, `mock-envido-result-switcher`, `mock-round-won-switcher`) y los archivos en `src/app/features/match/mocks/` permanecen disponibles para tests automatizados existentes

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validaciones finales, linting, build y verificación del flujo completo

- [X] T033 [P] Ejecutar `pnpm lint` y corregir errores de TypeScript/HTML en archivos modificados
- [X] T034 [P] Ejecutar `pnpm lint:styles` y corregir colores hardcodeados en SCSS de `src/app/features/match/`
- [X] T035 [P] Ejecutar `pnpm lint:themes` y corregir uso de `mat-flat-button` / `mat-raised-button` / `color="primary|accent|warn"` en templates de feature
- [X] T036 Ejecutar `pnpm test` y verificar que pasan `match-event.reducer.spec.ts`, `match-state.service.spec.ts` y `match-screen.component.spec.ts`
- [X] T037 Ejecutar `pnpm build` y verificar compilación de producción sin errores
- [X] T038 Actualizar `docs/CONTRATOS_API.md §9.3` para incluir `/user/queue/match-derived` (documentado en `research.md` §2)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - `T003`, `T004`, `T005` son paralelos (modelos, reducer, contrato)
  - `T006` depende de `T004` (tests del reducer necesitan el reducer)
  - `T007` depende de `T003` y `T004` (servicio necesita modelos y reducer)
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depende de US1 solo por compartir `MatchStateService`; el procesamiento live es independiente del bootstrap inicial
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depende de US1 (necesita estado inicial cargado) pero puede desarrollarse en paralelo sobre el mismo servicio
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Depende de US1 (necesita estado inicial); puede desarrollarse en paralelo con US2 y US3

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
  - `T003` (modelos), `T004` (reducer), `T005` (contrato) son completamente independientes
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members
- Tasks de lint (`T033`, `T034`, `T035`) son paralelos en Polish

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Escribir tests de bootstrap en match-state.service.spec.ts"
Task: "Escribir tests de error de carga inicial en match-state.service.spec.ts"

# Launch all implementation tasks for User Story 1 together:
Task: "Implementar flujo de bootstrap en MatchStateService.init()"
Task: "Agregar manejo de error en bootstrap de MatchStateService"
Task: "Actualizar match-screen.component.ts para inyectar MatchStateService"
Task: "Actualizar match-screen.component.html para mostrar spinner"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (bootstrap + carga inicial + spinner + componente)
4. **STOP and VALIDATE**: Test User Story 1 independently - navegar a `/match/:matchId` y verificar estado real
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently (eventos live, deduplicación, gaps) → Deploy/Demo
4. Add User Story 3 → Test independently (diálogo de fin de partida) → Deploy/Demo
5. Add User Story 4 → Test independently (eventos derivados, eliminación de mocks de producción) → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (bootstrap + componente)
   - Developer B: User Story 2 (live events + gap detection)
   - Developer C: User Story 3 (diálogo de fin de partida)
   - Developer D: User Story 4 (derived events + limpieza de mocks)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
