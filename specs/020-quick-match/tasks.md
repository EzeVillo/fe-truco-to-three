# Tasks: Quick Match

**Input**: Design documents from `/specs/020-quick-match/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/quick-match.md](./contracts/quick-match.md)

**Tests**: Incluidos porque el plan exige contract test y la feature toca contrato, servicio REST, WebSocket y UI.

**Organization**: Tareas agrupadas por user story para permitir implementación incremental y pruebas independientes.

> **Guardarraíles del proyecto**:
> - SCSS bajo `src/app/features/**` solo con `var(--t3-...)`.
> - Validar DTOs contra `docs/CONTRATOS_API.md §9.3`; `gamesToPlay` es partidas totales `{1,3,5}`.
> - CTAs tematizados; no usar `mat-flat-button`, `mat-raised-button` ni `color="primary|accent|warn"`.
> - No mostrar `ApiError.message`; usar `getErrorCopy()`.
> - No ejecutar tests por clase; ejecutar la suite completa cuando corresponda.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar estructura y rutas base de la feature.

- [X] T001 Crear la carpeta `src/app/features/lobby/pages/quick-match-page/` para la nueva pantalla standalone.
- [X] T002 [P] Crear archivos vacíos iniciales `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`, `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.html`, `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.scss` y `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts`.
- [X] T003 Agregar la ruta protegida `/lobby/quick-match` en `src/app/app.routes.ts` cargando `QuickMatchPageComponent`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contratos, modelos, servicio y copy compartidos que bloquean las historias.

**CRITICAL**: No iniciar historias hasta completar esta fase.

- [X] T004 [P] Agregar tipos `QuickMatchStatus`, `QuickMatchRequest` y `QuickMatchResponse` en `src/app/core/models/match.models.ts` según `specs/020-quick-match/contracts/quick-match.md`.
- [X] T005 [P] Crear `src/tests/contract/quick-match.contract.spec.ts` que valide `docs/CONTRATOS_API.md §9.3`, status `SEARCHING|MATCHED`, `matchId` nullable y `gamesToPlay` `{1,3,5}`.
- [X] T006 Agregar `enterQuickMatch(req: QuickMatchRequest)` y `cancelQuickMatch()` en `src/app/features/lobby/services/matches-api.service.ts` usando `POST /matches/quick` y `DELETE /matches/quick`.
- [X] T007 [P] Crear o ampliar `src/app/features/lobby/services/matches-api.service.spec.ts` para verificar request body de `enterQuickMatch()` y `204` de `cancelQuickMatch()`.
- [X] T008 Agregar scope `QUICK_MATCH` y sus copys controlados en `src/app/shared/error-copy/error-copy.ts`.
- [X] T009 [P] Ampliar tests de `getErrorCopy()` si existen o crear cobertura en `src/app/shared/error-copy/error-copy.spec.ts` para `QUICK_MATCH` sin exponer `error.message`.

**Checkpoint**: Tipos, contrato REST y copy están listos para construir UI.

---

## Phase 3: User Story 1 - Entrar a una partida rápida desde el lobby (Priority: P1) MVP

**Goal**: El jugador ve "Partida rápida", entra a la pantalla, elige formato de serie y dispara la búsqueda con el default correcto.

**Independent Test**: Abrir lobby, navegar a Partida rápida, confirmar que "Mejor de 3" es default y que buscar rival envía `gamesToPlay: 3`; cambiar a "Mejor de 5" y confirmar `gamesToPlay: 5`.

### Tests for User Story 1

- [X] T010 [P] [US1] Ampliar `src/app/features/lobby/pages/lobby-page/lobby-page.component.spec.ts` para verificar CTA "Partida rápida" y navegación a `/lobby/quick-match`.
- [X] T011 [P] [US1] Crear tests iniciales en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para default `BEST_OF_3`, cambio de formato y llamada a `enterQuickMatch()` con `seriesFormatToGamesToPlay()`.

### Implementation for User Story 1

- [X] T012 [US1] Agregar método `goToQuickMatch()` en `src/app/features/lobby/pages/lobby-page/lobby-page.component.ts`.
- [X] T013 [US1] Agregar CTA vertical "Partida rápida" en `src/app/features/lobby/pages/lobby-page/lobby-page.component.html` siguiendo `lobby__cta-title` y `lobby__cta-subtitle`.
- [X] T014 [US1] Implementar estado inicial, selector de serie y acción `onSearch()` en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`.
- [X] T015 [US1] Implementar template inicial con `app-back-button`, `app-series-format-selector`, CTA `t3-btn t3-btn--primary` y spinner en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.html`.
- [X] T016 [US1] Implementar layout responsive de configuración en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.scss` usando solo tokens `var(--t3-...)`.

**Checkpoint**: US1 permite iniciar búsqueda desde lobby con el formato correcto.

---

## Phase 4: User Story 2 - Esperar rival y cancelar la búsqueda (Priority: P1)

**Goal**: Si el servicio responde `SEARCHING`, el jugador ve estado de espera y puede cancelar sin quedar en cola.

**Independent Test**: Mockear `enterQuickMatch()` con `SEARCHING`, verificar estado "Buscando rival", ejecutar cancelar y confirmar llamada a `cancelQuickMatch()` y regreso a estado operable.

### Tests for User Story 2

- [X] T017 [P] [US2] Agregar tests en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para render de estado `SEARCHING` con `enqueuedAt` y formato elegido.
- [X] T018 [P] [US2] Agregar tests en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para cancelar búsqueda, estado `cancelling` y regreso a `idle`.
- [X] T019 [P] [US2] Agregar test en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para "Volver al lobby" durante búsqueda cancelando antes de navegar.

### Implementation for User Story 2

- [X] T020 [US2] Implementar estados `searching` y `cancelling`, `enqueuedAt`, `cancelSearch()` y prevención de doble click en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`.
- [X] T021 [US2] Implementar `goBack()` para cancelar búsqueda activa antes de navegar a `/lobby` en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`.
- [X] T022 [US2] Agregar vista "Buscando rival", formato elegido, spinner y botón "Cancelar búsqueda" en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.html`.
- [X] T023 [US2] Estilar estado de espera y cancelación sin scroll necesario en 360 x 780 en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.scss`.

**Checkpoint**: US2 permite esperar y cancelar de forma consistente.

---

## Phase 5: User Story 3 - Pasar automáticamente a la partida al encontrar rival (Priority: P1)

**Goal**: Si el emparejamiento es inmediato o llega por `/user/queue/match`, navegar automáticamente a `/match/:matchId`.

**Independent Test**: Mockear `MATCHED` en REST y `GAME_STARTED` en WebSocket; ambos casos navegan a la partida correcta sin acciones adicionales.

### Tests for User Story 3

- [X] T024 [P] [US3] Agregar test en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para respuesta `MATCHED` navegando a `/match/:matchId`.
- [X] T025 [P] [US3] Agregar test en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para evento WebSocket `GAME_STARTED` navegando a `/match/:matchId` mientras está `searching`.
- [X] T026 [P] [US3] Agregar test en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para ignorar eventos no `GAME_STARTED` o sin búsqueda activa.

### Implementation for User Story 3

- [X] T027 [US3] Inyectar `WebSocketService`, conectar y suscribirse a `/user/queue/match` durante la vida de `QuickMatchPageComponent` en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`.
- [X] T028 [US3] Implementar `handleQuickMatchResponse()` para navegar inmediatamente cuando `status === 'MATCHED'` y `matchId` existe en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`.
- [X] T029 [US3] Implementar filtro de evento `GAME_STARTED` y navegación a `/match/:matchId` solo mientras el estado sea `searching` en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`.
- [X] T030 [US3] Limpiar suscripción WebSocket al destruir el componente en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`.

**Checkpoint**: US3 completa el flujo feliz de quick match de punta a punta.

---

## Phase 6: User Story 4 - Manejar impedimentos y errores sin mensajes crudos (Priority: P2)

**Goal**: Errores de entrada/cancelación muestran copy controlado y permiten reintentar sin filtrar mensajes técnicos.

**Independent Test**: Mockear errores 422, 0 y 5xx en entrar/cancelar; verificar copy visible controlado, estado recuperable y ausencia de `ApiError.message`.

### Tests for User Story 4

- [X] T031 [P] [US4] Agregar tests en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para error 422 de `enterQuickMatch()` usando copy `QUICK_MATCH`.
- [X] T032 [P] [US4] Agregar tests en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para error de red en `enterQuickMatch()` permitiendo reintentar.
- [X] T033 [P] [US4] Agregar tests en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` para error de `cancelQuickMatch()` manteniendo estado recuperable.
- [X] T034 [P] [US4] Agregar test en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.spec.ts` que asegure que un `error.message` crudo no aparece en el DOM.

### Implementation for User Story 4

- [X] T035 [US4] Integrar `getErrorCopy('QUICK_MATCH', err)` en errores de búsqueda y cancelación dentro de `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.ts`.
- [X] T036 [US4] Renderizar alertas accesibles `role="alert"` y acciones de reintento en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.html`.
- [X] T037 [US4] Estilar alertas y estado de error con tokens en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.scss`.

**Checkpoint**: US4 cubre errores sin mensajes crudos y con recuperación.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentación, consistencia visual y verificación final.

- [X] T038 [P] Actualizar `README.md` con el modo Partida rápida y la ruta `/lobby/quick-match`.
- [X] T039 Revisar si `docs/CONTRATOS_API.md` requiere aclarar que `gamesToPlay` en quick match es partidas totales de la serie; actualizar solo si se decide corregir la redacción del contrato.
- [X] T040 [P] Verificar que no existan botones Material crudos ni `color="primary|accent|warn"` en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.html`.
- [X] T041 [P] Verificar que todo `:hover` nuevo esté gateado tras `@media (hover: hover)` en `src/app/features/lobby/pages/quick-match-page/quick-match-page.component.scss`.
- [X] T042 Ejecutar verificación completa con `pnpm test`, `pnpm lint`, `pnpm lint:styles`, `pnpm lint:themes`, `pnpm lint:hover` y `pnpm build`.
- [ ] T043 Ejecutar quickstart manual de `specs/020-quick-match/quickstart.md` contra el backend local si está disponible.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Phase 1; bloquea historias.
- **US1 (Phase 3)**: depende de Phase 2.
- **US2 (Phase 4)**: depende de US1 porque extiende la misma pantalla.
- **US3 (Phase 5)**: depende de US2 para estado `searching`.
- **US4 (Phase 6)**: depende de US1/US2 para paths de entrada y cancelación.
- **Polish (Phase 7)**: depende de las historias implementadas.

### User Story Dependencies

- **US1**: MVP de descubrimiento/configuración; puede validarse después de Foundational.
- **US2**: requiere pantalla y acción de búsqueda de US1.
- **US3**: requiere estado de búsqueda de US2.
- **US4**: puede desarrollarse tras US1 para errores de entrada y completarse tras US2 para cancelación.

### Parallel Opportunities

- T004, T005, T007, T009 pueden desarrollarse en paralelo tras T001-T003.
- T010 y T011 pueden escribirse en paralelo.
- T017, T018 y T019 pueden escribirse en paralelo una vez exista el componente.
- T024, T025 y T026 pueden escribirse en paralelo.
- T031, T032, T033 y T034 pueden escribirse en paralelo.
- T038, T040 y T041 pueden ejecutarse en paralelo durante polish.

---

## Parallel Example: User Story 1

```text
Task: "Ampliar lobby-page.component.spec.ts para verificar CTA y navegación"
Task: "Crear tests iniciales de quick-match-page.component.spec.ts para default y búsqueda"
```

---

## Parallel Example: User Story 3

```text
Task: "Agregar test para respuesta MATCHED"
Task: "Agregar test para evento WebSocket GAME_STARTED"
Task: "Agregar test para ignorar eventos no aplicables"
```

---

## Implementation Strategy

### MVP First

1. Completar Phase 1 y Phase 2.
2. Completar US1 para exponer Partida rápida y enviar `gamesToPlay` correcto.
3. Completar US2 para soportar búsqueda real y cancelación.
4. Completar US3 para cerrar el flujo feliz con navegación automática.
5. Validar con `pnpm test` y quickstart básico.

### Incremental Delivery

1. US1: CTA + pantalla + request correcto.
2. US2: estado `SEARCHING` + cancelación.
3. US3: `MATCHED` inmediato y `GAME_STARTED` diferido.
4. US4: hardening de errores y copys.
5. Polish: README, verificación completa y quickstart.

### Notas

- Mantener componentes standalone; no crear NgModules.
- No introducir store global salvo que una tarea posterior demuestre una necesidad real.
- No ejecutar tests por clase; usar la suite completa cuando se valide.
- Si una tarea toca contrato de endpoints, revisar `docs/CONTRATOS_API.md` antes de editar código.
