# Tasks: Acciones de match contra el backend (REST)

**Input**: Design documents from `/specs/007-match-rest-actions/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Contract tests and unit tests are included as part of this feature (spec.md marks User Scenarios & Testing as mandatory).

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

---

## Phase 1: Setup (Shared Infrastructure)

> No aplica — esta feature se implementa sobre el proyecto Angular existente; no requiere infraestructura ni dependencias nuevas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Extender tipos DTO de acción en `src/app/core/models/match.models.ts` (`PlayCardRequest`, `CallEnvidoRequest`, `RespondTrucoRequest`, `RespondEnvidoRequest`) con enums case-sensitive según `docs/CONTRATOS_API.md §4.6–§4.11` y `§8.1`
- [X] T002 Crear `MatchActionsService` en `src/app/features/match/services/match-actions.service.ts` con los 6 métodos REST fire-and-forget (`callTruco`, `callEnvido`, `respondTruco`, `respondEnvido`, `fold`, `playCard`), manejo silencioso de errores (`console.warn('[match-actions]')`) y sin estado interno
- [X] T003 Actualizar ruta de match a `match/:matchId` en `src/app/app.routes.ts`
- [X] T004 [P] Leer `matchId` desde `ActivatedRoute.snapshot.paramMap` en `src/app/features/match/pages/match-screen/match-screen.component.ts` (conservar `fixture` query param para desarrollo del mock)

**Checkpoint**: Foundation ready — `matchId` via URL, `MatchActionsService` creado, DTOs tipados. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Entrar al match al crear partida contra el bot (Priority: P1) 🎯 MVP

**Goal**: Cuando el usuario crea una partida contra el bot desde el lobby, el frontend consume el endpoint REST de creación y, tras éxito, navega automáticamente a la pantalla de match con el `matchId` en la URL.

**Independent Test**: Desde el lobby vs bots, configurar y crear una partida. Verificar que el frontend llama `POST /api/matches/bot`, recibe un `matchId`, y navega a `/match/<uuid>` sin abrir conexión WebSocket. Si el backend responde error, el usuario permanece en la pantalla de configuración sin mensajes de error visibles.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T005 [P] [US1] Añadir test unitario de navegación post-bot-match en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.spec.ts`: tras `createBotMatch` exitoso, verificar que `Router.navigate` es llamado con `['/match', matchId]`

### Implementation for User Story 1

- [X] T006 [US1] Cablear navegación a `/match/:matchId` tras crear bot match exitoso en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.ts`; en error, permanecer en la página sin mostrar mensaje al usuario

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Disparar acciones de match contra el backend (Priority: P1)

**Goal**: Desde la pantalla de match, cada acción disponible según el mock invoca el endpoint REST correspondiente del backend con el `matchId` del contexto. La invocación es fire-and-forget: no muestra resultado ni error al usuario. La carta clickeada no se mueve a la mesa. Se previene doble disparo con `signal<boolean>` por acción.

**Independent Test**: Estando en `/match/<uuid>?fixture=common`, tocar cada una de las 6 acciones disponibles según el mock. Verificar en Network que cada toque produce exactamente una request HTTP al endpoint REST correspondiente con el `matchId` y el body esperado por el contrato. Verificar que ante respuesta de error (4xx/5xx), la UI no muestra ningún error al usuario.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US2] Crear contract test `src/tests/contract/match-actions.contract.spec.ts` que verifica paridad entre DTOs TypeScript y `docs/CONTRATOS_API.md §4.6–§4.11` + `§8.1` (paths exactos, bodies y enums case-sensitive)
- [X] T008 [P] [US2] Crear unit test `src/tests/unit/match-actions.service.spec.ts` con `HttpTestingController`: cada método (a) dispara request al path correcto con body correcto, (b) ante `flush(404)` / error no propaga excepción, (c) loguea vía `console.warn`

### Implementation for User Story 2

- [X] T009 [P] [US2] Cablear acción "cantar truco" en `src/app/features/match/components/available-actions-panel/available-actions-panel.component.ts`: invocar `MatchActionsService.callTruco(matchId)` con protección `signal<boolean>` anti-doble-tap y deshabilitación del botón durante la request
- [X] T010 [P] [US2] Cablear submenú de envido con `callEnvido` en `src/app/features/match/components/available-actions-panel/envido-submenu/envido-submenu.component.ts`: al seleccionar una variante (`ENVIDO`, `REAL_ENVIDO`, `FALTA_ENVIDO`), invocar `MatchActionsService.callEnvido(matchId, variant)` con protección anti-doble-tap y cerrar el submenú
- [X] T011 [P] [US2] Cablear panel de respuesta de truco en `src/app/features/match/components/available-actions-panel/truco-response-panel/truco-response-panel.component.ts`: invocar `MatchActionsService.respondTruco(matchId, response)` con `response ∈ {QUIERO, NO_QUIERO, QUIERO_Y_ME_VOY_AL_MAZO}` y protección anti-doble-tap
- [X] T012 [P] [US2] Cablear panel de respuesta de envido en `src/app/features/match/components/available-actions-panel/envido-response-panel/envido-response-panel.component.ts`: invocar `MatchActionsService.respondEnvido(matchId, response)` con `response ∈ {QUIERO, NO_QUIERO}` y protección anti-doble-tap
- [X] T013 [P] [US2] Cablear acción "irse al mazo" en `src/app/features/match/components/available-actions-panel/available-actions-panel.component.ts`: invocar `MatchActionsService.fold(matchId)` con protección anti-doble-tap
- [X] T014 [US2] Cablear acción "jugar carta" en `src/app/features/match/components/player-hand/player-hand.component.ts`: al hacer click en una carta jugable, invocar `MatchActionsService.playCard(matchId, { suit, number })`; la carta NO se mueve visualmente a la mesa; usar protección anti-doble-tap

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Habilitación de acciones según el mock (Priority: P2)

**Goal**: La disponibilidad de cada acción en la UI sigue dictada por el mock actual. En el menú por defecto, la opción "envido" sólo aparece marcada/habilitada cuando el mock indica que hay un envido cantable (`CALL_ENVIDO`); en caso contrario, no es clickeable y no abre submenú.

**Independent Test**: Con distintas configuraciones del mock (envido disponible / no disponible, truco disponible / no, fold disponible / no, etc.), verificar que la UI sólo permite activar las acciones marcadas como disponibles y que el menú por defecto sólo marca "envido" cuando hay envido cantable.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [P] [US3] Añadir unit test de disponibilidad de acciones según mock: verificar que `available-actions-panel` sólo habilita "envido" cuando `availableActions` contiene `CALL_ENVIDO`

### Implementation for User Story 3

- [X] T016 [US3] Condicionar opción "envido" del menú según disponibilidad del mock en `src/app/features/match/components/available-actions-panel/available-actions-panel.component.ts`: si el mock no provee `CALL_ENVIDO`, la opción no debe estar marcada ni permitir abrir el submenú
- [X] T017 [US3] Condicionar click de cartas solo a cartas jugables según el mock en `src/app/features/match/components/player-hand/player-hand.component.ts`: si una carta no está marcada como jugable por el mock, el click no dispara request ni produce cambios visuales

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [X] T018 [P] Ejecutar `pnpm lint`, `pnpm lint:styles`, `pnpm lint:themes`, `pnpm test` y `pnpm build`; todos deben pasar en verde
- [X] T019 Validar flujo descrito en `specs/007-match-rest-actions/quickstart.md` manualmente (crear bot match, disparar 6 acciones, verificar 0 errores visibles, 0 conexiones WS, disponibilidad según mock)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. No aplica para esta feature.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories. T001–T004 deben completarse antes de cualquier historia.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User stories can then proceed in parallel (if staffed), aunque US2 prácticamente necesita US1 para tener un `matchId` real en la URL.
  - Or sequentially in priority order: US1 (P1) → US2 (P1) → US3 (P2).
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories. Es el punto de entrada que habilita el resto.
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) and ideally after US1 — requiere un `matchId` en la URL para disparar requests. Puede probarse manualmente ingresando cualquier `matchId` en la URL.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — May integrate with US1/US2 but should be independently testable. Modifica la lógica de renderizado del mock en componentes existentes.

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation.
- Models/DTOs before services (Phase 2 ya provee el servicio base).
- Services before component wiring.
- Core implementation before integration.
- Story complete before moving to next priority.

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (within Phase 2): T001 (tipos), T002 (servicio), T003 (ruta), T004 (lectura matchId).
- Once Foundational phase completes:
  - Developer A: User Story 1 (navegación bot match)
  - Developer B: User Story 2 (cablear 6 acciones + tests)
  - Developer C: User Story 3 (habilitación según mock)
- All tests for a user story marked [P] can run in parallel.
- Different user stories can be worked on in parallel by different team members.

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Crear contract test match-actions.contract.spec.ts (T007)"
Task: "Crear unit test match-actions.service.spec.ts (T008)"

# Launch all component wiring tasks for User Story 2 together (once T002 is ready):
Task: "Cablear callTruco en available-actions-panel.component.ts (T009)"
Task: "Cablear callEnvido en envido-submenu.component.ts (T010)"
Task: "Cablear respondTruco en truco-response-panel.component.ts (T011)"
Task: "Cablear respondEnvido en envido-response-panel.component.ts (T012)"
Task: "Cablear fold en available-actions-panel.component.ts (T013)"
Task: "Cablear playCard en player-hand.component.ts (T014)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T004).
2. Complete Phase 3: User Story 1 (T005–T006).
3. **STOP and VALIDATE**: Test crear partida vs bot y navegación a `/match/:matchId`.
4. Deploy/demo if ready.

### Incremental Delivery

1. Complete Foundational → Foundation ready.
2. Add User Story 1 → Test navegación post-bot-match → Deploy/Demo (MVP!).
3. Add User Story 2 → Test 6 acciones REST fire-and-forget → Deploy/Demo.
4. Add User Story 3 → Test habilitación según mock → Deploy/Demo.
5. Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Phase 2 together.
2. Once Foundational is done:
   - Developer A: User Story 1 (navegación post-bot-match)
   - Developer B: User Story 2 (cablear acciones REST + tests contract/unit)
   - Developer C: User Story 3 (condicionar UI según mock)
3. Stories complete and integrate independently.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate story independently.
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence.
