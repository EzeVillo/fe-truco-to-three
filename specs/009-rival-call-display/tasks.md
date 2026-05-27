# Tasks: Visualización de cantos del rival en panel de estado

**Input**: Documentos de diseño de `/specs/009-rival-call-display/`

**Prerequisites**: plan.md (requerido), spec.md (requerido para user stories), research.md, data-model.md, contracts/

**Tests**: Incluidos según plan.md (match-state.service.spec.ts, match-status-panel.component.spec.ts, match-screen.component.spec.ts, call-display-mapper.spec.ts).

**Organization**: Las tareas se agrupan por user story para permitir implementación y testing independiente de cada historia.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` después de cambiar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md` antes de tipar un DTO. `gamesToPlay ∈ {1,3,5}`.
> - **CTAs verticales**: título + descripción en spans separados, `flex-direction: column`, no `mat-flat-button`.
> - **Copy de errores**: usar `getErrorCopy()`, nunca `ApiError.message` crudo en la UI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos diferentes, sin dependencias)
- **[Story]**: A qué user story pertenece la tarea (US1, US2, US3)
- Incluir rutas de archivo exactas en las descripciones

## Path Conventions

- **Proyecto**: Angular SPA single project — `src/app/` a nivel de repositorio
- Las rutas asumen estructura single project según plan.md

---

## Phase 1: Setup (Infraestructura Compartida)

**Purpose**: Verificar proyecto existente e identificar archivos objetivo

- [X] T001 Verificar estructura del proyecto Angular y archivos objetivo existentes según plan.md en `src/app/features/match/`

---

## Phase 2: Foundational (Prerrequisitos Bloqueantes)

**Purpose**: Infraestructura central que DEBE estar completa antes de implementar cualquier user story

**⚠️ CRITICAL**: Ningún trabajo de user story puede comenzar hasta que esta fase esté completa

- [X] T002 Modificar `MatchStateService` para exponer `matchEvent$ = new Subject<MatchWsEvent>()` que emita tras `applyAndIncrement` en `src/app/features/match/services/match-state.service.ts`
- [X] T003 [P] Agregar tests en `src/app/features/match/services/match-state.service.spec.ts` para verificar que `matchEvent$` emite eventos WS después de aplicarlos al estado
- [X] T004 [P] Crear utilitario `callDisplayMapper(event: MatchWsEvent): CallDisplayEvent | null` con mapeo completo de eventos a texto legible en `src/app/features/match/utils/call-display-mapper.ts`
- [X] T005 [P] Agregar tests unitarios para `call-display-mapper.ts` en `src/app/features/match/utils/call-display-mapper.spec.ts` verificando todos los mapeos del contrato

**Checkpoint**: Infraestructura lista — `matchEvent$` expone eventos y el mapper traduce eventos a texto. Puede comenzar implementación de user stories.

---

## Phase 3: User Story 1 - Ver canto del rival en el panel (Priority: P1) 🎯 MVP

**Goal**: Mostrar el texto del último canto o respuesta debajo del nombre de cada jugador en el panel de estado (`MatchStatusPanel`).

**Independent Test**: Simular un evento WS `TRUCO_CALLED` y verificar que el texto "¡Truco!" aparece debajo del nombre del rival en el panel.

### Tests for User Story 1

> **NOTE: Escribir estos tests PRIMERO, asegurar que FALLAN antes de la implementación**

- [X] T006 [P] [US1] Agregar tests de renderizado de call text en `src/app/features/match/components/match-status-panel/match-status-panel.component.spec.ts`
- [X] T007 [P] [US1] Agregar tests de actualización de señales de call text en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`

### Implementation for User Story 1

- [X] T008 [P] [US1] Agregar `@Input() selfCallText` y `@Input() opponentCallText` en `src/app/features/match/components/match-status-panel/match-status-panel.component.ts`
- [X] T009 [P] [US1] Actualizar template de `MatchStatusPanelComponent` para renderizar `<span class="status-panel__call-text">` bajo cada nombre de jugador en `src/app/features/match/components/match-status-panel/match-status-panel.component.html`
- [X] T010 [P] [US1] Agregar estilos SCSS para texto de canto usando `var(--t3-gold-500)`, `font-weight: 600` y tamaños responsive en `src/app/features/match/components/match-status-panel/match-status-panel.component.scss`
- [X] T011 [P] [US1] Implementar señales `selfCallText` / `opponentCallText`, suscripción a `matchEvent$` y mapeo con `callDisplayMapper` en `src/app/features/match/pages/match-screen/match-screen.component.ts`
- [X] T012 [US1] Actualizar template de `MatchScreenComponent` para pasar `[selfCallText]` y `[opponentCallText]` al `MatchStatusPanelComponent` en `src/app/features/match/pages/match-screen/match-screen.component.html`

**Checkpoint**: En este punto, User Story 1 debe ser completamente funcional e independientemente testeable. Simular cualquier evento de canto debe mostrar el texto correcto bajo el jugador correspondiente.

---

## Phase 4: User Story 2 - Auto-limpieza de aceptaciones (Priority: P2)

**Goal**: Las respuestas de aceptación (`QUIERO`) desaparecen automáticamente del panel a los 3 segundos.

**Independent Test**: Simular un evento `TRUCO_RESPONDED` con `response: QUIERO` y verificar que el texto desaparece pasados 3 segundos sin interacción del usuario.

### Tests for User Story 2

- [X] T013 [P] [US2] Agregar tests de comportamiento de auto-limpieza (3s de delay, cancelación de timer previo, cleanup al destruir) en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`

### Implementation for User Story 2

- [X] T014 [US2] Implementar lógica de auto-limpieza con `setTimeout` para textos de aceptación (`isAcceptance: true`) y cancelación de timers previos al recibir nuevo evento en `src/app/features/match/pages/match-screen/match-screen.component.ts`
- [X] T015 [US2] Agregar tracking de timers con `Map<Seat, number>` y limpieza automática mediante `DestroyRef` al destruir el componente en `src/app/features/match/pages/match-screen/match-screen.component.ts`

**Checkpoint**: User Stories 1 y 2 deben funcionar independientemente. El texto de aceptación desaparece a los ~3s y los timers se cancelan correctamente.

---

## Phase 5: User Story 3 - Reset al iniciar nueva ronda (Priority: P2)

**Goal**: Todos los textos de canto se borran al iniciar una nueva ronda, juego o al finalizar/abandonar la partida.

**Independent Test**: Simular un evento `ROUND_STARTED` y verificar que cualquier texto de canto previo desaparece inmediatamente del panel.

### Tests for User Story 3

- [X] T016 [P] [US3] Agregar tests de reset de call texts ante eventos `ROUND_STARTED`, `GAME_STARTED`, `MATCH_FINISHED`, `MATCH_ABANDONED` y `MATCH_FORFEITED` en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`

### Implementation for User Story 3

- [X] T017 [US3] Implementar reset de señales `selfCallText` / `opponentCallText` a `null` ante eventos `ROUND_STARTED`, `GAME_STARTED`, `MATCH_FINISHED`, `MATCH_ABANDONED` y `MATCH_FORFEITED` en `src/app/features/match/pages/match-screen/match-screen.component.ts`

**Checkpoint**: Todas las user stories deben ser funcionalmente independientes. El panel limpia cantos al cambiar de ronda o finalizar partida.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras y verificaciones que afectan múltiples user stories

- [X] T018 [P] Ejecutar `pnpm lint`, `pnpm lint:styles` y `pnpm lint:themes` y corregir errores
- [X] T019 [P] Ejecutar `pnpm test` y resolver fallas en mapper, panel y timers
- [X] T020 [P] Ejecutar `pnpm build` y verificar ausencia de errores de compilación
- [X] T021 Verificar manejo del gap `ENVIDO_RESOLVED` (sin `responderSeat` en payload): mostrar texto centrado sin atribución de asiento, según `contracts/rival-call-display-contract.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Setup — BLOQUEA todas las user stories
- **User Stories (Phase 3+)**: Todas dependen de Foundational (Phase 2)
  - Las user stories pueden proceder en paralelo (si hay capacidad de equipo)
  - O secuencialmente en orden de prioridad (P1 → P2 → P2)
- **Polish (Fase Final)**: Depende de que todas las user stories deseadas estén completas

### User Story Dependencies

- **User Story 1 (P1)**: Puede comenzar tras Foundational (Phase 2) — Sin dependencias de otras stories. Es el MVP.
- **User Story 2 (P2)**: Puede comenzar tras Foundational (Phase 2) — Depende lógicamente de US1 (necesita que el texto de canto exista para poder limpiarlo), pero se puede testar independientemente simulando el flujo completo.
- **User Story 3 (P2)**: Puede comenzar tras Foundational (Phase 2) — Depende lógicamente de US1 (necesita texto visible para resetearlo), pero se puede testar independientemente.

### Within Each User Story

- Tests DEBEN escribirse primero y FALLAR antes de la implementación
- Modelos/inputs antes de servicios/lógica
- Lógica del componente antes de binding de template
- Implementación core antes de integración
- Story completa antes de pasar a la siguiente prioridad

### Parallel Opportunities

- Tareas de Setup marcadas [P] pueden ejecutarse en paralelo
- Tareas de Foundational marcadas [P] pueden ejecutarse en paralelo (dentro de Phase 2)
- Una vez completada la fase Foundational, todas las user stories pueden comenzar en paralelo (si la capacidad del equipo lo permite)
- Todos los tests de una user story marcados [P] pueden ejecutarse en paralelo
- Inputs/template/estilos del panel (T008–T010) pueden desarrollarse en paralelo
- Señales y suscripción de `MatchScreenComponent` (T011) pueden desarrollarse en paralelo con cambios del panel

---

## Parallel Example: User Story 1

```bash
# Lanzar todos los tests de User Story 1 juntos:
Task: "Agregar tests de renderizado de call text en match-status-panel.component.spec.ts"
Task: "Agregar tests de actualización de señales en match-screen.component.spec.ts"

# Lanzar inputs, template y estilos del panel juntos:
Task: "Agregar @Input() selfCallText y opponentCallText en match-status-panel.component.ts"
Task: "Actualizar template de MatchStatusPanelComponent para renderizar call text"
Task: "Agregar estilos SCSS para texto de canto"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRÍTICO — bloquea todas las stories)
3. Completar Phase 3: User Story 1
4. **DETENERSE Y VALIDAR**: Testear User Story 1 independientemente
5. Deploy/demo si está listo

### Incremental Delivery

1. Completar Setup + Foundational → Infraestructura lista
2. Agregar User Story 1 → Testear independientemente → Deploy/Demo (¡MVP!)
3. Agregar User Story 2 → Testear independientemente → Deploy/Demo
4. Agregar User Story 3 → Testear independientemente → Deploy/Demo
5. Cada story agrega valor sin romper las anteriores

### Parallel Team Strategy

Con múltiples desarrolladores:

1. El equipo completa Setup + Foundational juntos
2. Una vez terminado Foundational:
   - Desarrollador A: User Story 1 (panel + señales + tests)
   - Desarrollador B: User Story 2 (timers de auto-limpieza + tests)
   - Desarrollador C: User Story 3 (reset de ronda + tests)
3. Las stories se completan e integran independientemente

---

## Notes

- `[P]` tareas = archivos diferentes, sin dependencias
- `[Story]` label mapea la tarea a una user story específica para trazabilidad
- Cada user story debe poder completarse y testearse de forma independiente
- Verificar que los tests fallen antes de implementar
- Commitear después de cada tarea o grupo lógico
- Detenerse en cualquier checkpoint para validar una story de forma independiente
- Evitar: tareas vagas, conflictos de archivos, dependencias cruzadas entre stories que rompan la independencia
