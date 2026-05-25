# Tasks: Lobby post-login y creación de partida contra bots

**Input**: Design documents from `/specs/003-lobby-bots/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluidos — el plan los pide explícitamente (`BotsApiService`, `ErrorCopyService`, `BotsConfigPage`, `GlobalHeader`).

**Organization**: Tasks agrupadas por user story para implementación y testing independientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias bloqueantes)
- **[Story]**: User story al que pertenece la task (US1, US2, US3)
- Cada task incluye ruta exacta del archivo

## Path Conventions

Single-project Angular SPA. Todo el código bajo `src/app/` per `plan.md`. Tests Vitest colocados junto al archivo (`*.spec.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar prerrequisitos del proyecto. La estructura de Angular ya existe; nada nuevo a inicializar.

- [X] T001 Verificar que `pnpm install`, `pnpm lint` y `pnpm test` corren limpios en la base actual antes de empezar (sin cambios; baseline)
- [X] T002 [P] Crear carpetas vacías de la feature: `src/app/features/lobby/pages/lobby-page/`, `src/app/features/lobby/pages/bots-config-page/`, `src/app/features/lobby/components/bot-card/`, `src/app/features/lobby/components/series-format-selector/`, `src/app/features/lobby/services/`, `src/app/shared/components/global-header/`, `src/app/shared/components/confirm-logout-dialog/`, `src/app/shared/error-copy/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelos de dominio, catálogo de copy de errores, servicio HTTP y rutas. Todo lo que las US consumen.

**⚠️ CRITICAL**: Ninguna user story puede empezar antes de completar esta fase.

- [X] T003 [P] Crear modelo `Bot` y `BotPersonality` en `src/app/core/models/bot.models.ts` (interfaces según `data-model.md` §Bot)
- [X] T004 [P] Extender `src/app/core/models/match.models.ts` con `SeriesFormat`, `DEFAULT_SERIES_FORMAT`, `SERIES_FORMAT_LABELS`, `seriesFormatToGamesToPlay`, `CreateBotMatchRequest`, `CreateBotMatchResponse` (según `data-model.md` §SeriesFormat / §CreateBotMatch*)
- [X] T005 [P] Implementar catálogo de copy de errores como función pura `getErrorCopy(scope, error)` en `src/app/shared/error-copy/error-copy.ts` (scopes `BOT_CATALOG` y `CREATE_BOT_MATCH`, strings exactas según FR-014 / FR-014a / D-005)
- [X] T006 [P] Test `src/app/shared/error-copy/error-copy.spec.ts`: cubrir cada combinación scope × status (401, 403, 404, 409, 422, 0, 5xx, otro) con la copy esperada
- [X] T007 Implementar `BotsApiService` en `src/app/features/lobby/services/bots-api.service.ts` con `getBots(): Observable<Bot[]>` (GET `/api/bots`) y `createBotMatch(req): Observable<CreateBotMatchResponse>` (POST `/api/matches/bot`), usando `environment.apiBaseUrl` y `HttpClient` (depende de T003, T004)
- [X] T008 [P] Test `src/app/features/lobby/services/bots-api.service.spec.ts` con `HttpTestingController`: verificar URL + método + body de cada call y mapeo de respuesta (depende de T007)
- [X] T009 Actualizar `src/app/app.routes.ts`: reemplazar el stub de `/lobby` (líneas ~23-30) por lazy `loadComponent` hacia `LobbyPageComponent`; agregar ruta `/lobby/vs-bots` con lazy `loadComponent` hacia `BotsConfigPageComponent`; ambas con `canMatch: [authGuard]` (per D-008)

**Checkpoint**: Foundation lista — modelos, error copy, servicio HTTP y rutas funcionando.

---

## Phase 3: User Story 1 - Acceso al lobby tras iniciar sesión (Priority: P1) 🎯 MVP

**Goal**: Tras login exitoso, el usuario aterriza en `/lobby`, ve el header global con su username + acción "Salir" (con confirm dialog) y la CTA "Jugar contra bots".

**Independent Test**: Login con usuario válido → redirige a `/lobby` → header muestra username y "Salir" → "Salir" abre dialog → confirmar limpia sesión y vuelve a `/login`. Acceder a `/lobby` sin sesión redirige a `/login`.

### Tests for User Story 1

- [X] T010 [P] [US1] Test `src/app/shared/components/global-header/global-header.component.spec.ts`: visibilidad condicional del bloque username + "Salir" según `AuthStore.isAuthenticated()`, marca siempre visible, click en "Salir" abre `ConfirmLogoutDialog`
- [X] T011 [P] [US1] Test `src/app/shared/components/confirm-logout-dialog/confirm-logout-dialog.component.spec.ts`: render del texto "¿Cerrar sesión?", botones "Cancelar" (cierra con `false`) y "Salir" (cierra con `true`)
- [X] T012 [P] [US1] Test `src/app/features/lobby/pages/lobby-page/lobby-page.component.spec.ts`: render del CTA "Jugar contra bots" y navegación a `/lobby/vs-bots` al click

### Implementation for User Story 1

- [X] T013 [P] [US1] Implementar `ConfirmLogoutDialogComponent` (standalone) en `src/app/shared/components/confirm-logout-dialog/confirm-logout-dialog.component.ts` + `.html`: `MatDialog` con título "¿Cerrar sesión?", botones "Cancelar" / "Salir"
- [X] T014 [P] [US1] Implementar `GlobalHeaderComponent` (standalone) en `src/app/shared/components/global-header/global-header.component.ts` + `.html` + `.scss`: sticky top, marca siempre, bloque username + "Salir" condicionado a `inject(AuthStore).isAuthenticated()`, click en "Salir" abre `ConfirmLogoutDialog`; al confirmar llama `authStore.clearSession()` y `router.navigateByUrl('/auth/login')` (depende de T013)
- [X] T015 [US1] Montar `<app-global-header/>` en `src/app/app.html` por encima de `<router-outlet/>` (depende de T014)
- [X] T016 [P] [US1] Implementar `LobbyPageComponent` (standalone) en `src/app/features/lobby/pages/lobby-page/lobby-page.component.ts` + `.html` + `.scss`: tarjeta/CTA primaria "Jugar contra bots" que navega a `/lobby/vs-bots`; layout responsivo mobile-first per design system
- [X] T017 [US1] Verificar/ajustar redirect post-login en `src/app/features/auth/...` (login page): tras éxito navega a `/lobby` (no al stub previo). Per D-008
- [X] T018 [US1] Verificar safe-area-inset top en `global-header.component.scss` (`padding-top: env(safe-area-inset-top)`) y que el header no tape contenido en mobile

**Checkpoint**: US1 funcional — login → lobby → header global con logout confirmable.

---

## Phase 4: User Story 2 - Selección de bot y configuración de la partida (Priority: P1)

**Goal**: Desde `/lobby/vs-bots`, listar bots, permitir selección radio de exactamente 1, bottom action bar fija con selector "Mejor de 1/3/5" (default 3) y CTA "Crear partida" que dispara POST y navega a `/match/:matchId`.

**Independent Test**: Entrar a `/lobby/vs-bots` con catálogo cargado → tocar un bot lo selecciona (radio) → cambiar formato a "Mejor de 5" → tap "Crear partida" → POST a `/api/matches/bot` con `{ botId, gamesToPlay: 3 }` → navegación a `/match/<matchId>`. Error 404 al crear recarga catálogo y resetea selección.

### Tests for User Story 2

- [X] T019 [P] [US2] Test `src/app/features/lobby/components/bot-card/bot-card.component.spec.ts`: render de nombre + iniciales sobre color derivado de `botId`, `aria-pressed` refleja `selected` input, emit `select` al click
- [X] T020 [P] [US2] Test `src/app/features/lobby/components/series-format-selector/series-format-selector.component.spec.ts`: render de 3 opciones, default `BEST_OF_3`, emisión del cambio al seleccionar otra opción, `aria-label="Formato de serie"`
- [X] T021 [P] [US2] Test `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.spec.ts`: (a) loading inicial, (b) render del catálogo, (c) selección radio (tap mueve selección), (d) CTA deshabilitado sin selección y habilitado con selección, (e) POST dispara con body correcto y navega a `/match/:matchId`, (f) error 404 recarga catálogo y resetea selección, (g) error 5xx muestra copy y mantiene selección, (h) doble tap dispara 1 sola request

### Implementation for User Story 2

- [X] T022 [P] [US2] Implementar `BotCardComponent` (standalone) en `src/app/features/lobby/components/bot-card/bot-card.component.ts` + `.html` + `.scss`: `<button>` con `aria-pressed`, inputs `bot: Bot` y `selected: boolean`, output `select`, render iniciales del `name` sobre círculo de color (hash determinístico del `botId`), tap target ≥ 44 px
- [X] T023 [P] [US2] Implementar `SeriesFormatSelectorComponent` (standalone) en `src/app/features/lobby/components/series-format-selector/series-format-selector.component.ts` + `.html` + `.scss`: `mat-button-toggle-group` single-select con 3 opciones usando `SERIES_FORMAT_LABELS`, input/output `format: SeriesFormat`, `aria-label="Formato de serie"` (depende de T004)
- [X] T024 [US2] Implementar `BotsConfigPageComponent` (standalone) en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.ts` + `.html` + `.scss`: signals `bots`, `loadingCatalog`, `catalogError`, `selectedBotId`, `seriesFormat`, `creatingMatch`, `createMatchError` y computed `canCreate` per `data-model.md` §Estado UI; layout: header fijo arriba (ya montado global), grilla CSS auto-fill minmax(160px, 1fr) gap 12px, bottom action bar fija con `SeriesFormatSelectorComponent` + botón "Crear partida"; padding inferior = `calc(var(--t3-bottom-bar-h) + env(safe-area-inset-bottom) + 16px)` (depende de T007, T022, T023)
- [X] T025 [US2] En `BotsConfigPageComponent`: implementar lógica de carga del catálogo en `ngOnInit` usando `BotsApiService.getBots()`, traducción de errores con `getErrorCopy('BOT_CATALOG', err)`, estado vacío con mensaje explícito (FR-018), opción "Reintentar" (FR-019) (depende de T024, T005)
- [X] T026 [US2] En `BotsConfigPageComponent`: implementar handler `onCreate()` → seteo `creatingMatch=true`, POST `createBotMatch({ botId, gamesToPlay: seriesFormatToGamesToPlay(seriesFormat) })`, en éxito `router.navigate(['/match', matchId])`, en error setear `createMatchError` con `getErrorCopy('CREATE_BOT_MATCH', err)`; caso especial 404 recarga catálogo y resetea `selectedBotId=null` (per `data-model.md` §Estado UI transición 4) (depende de T024, T005, T007)
- [X] T027 [US2] En `BotsConfigPageComponent`: garantizar que el CTA queda deshabilitado durante `creatingMatch` (evita doble tap — edge case) y que la deshabilitación es inmediata al primer tap
- [X] T028 [US2] En `BotsConfigPageComponent`: agregar acción visible "Volver" al lobby (FR-015) que navega a `/lobby`

**Checkpoint**: US2 funcional — usuario crea partida vs bot, todos los errores traducidos por catálogo.

---

## Phase 5: User Story 3 - Exploración cómoda del catálogo de bots (Priority: P2)

**Goal**: Catálogo de ≥ 30 bots con scroll fluido a 60 fps, grilla responsiva (mobile 1-2 columnas, desktop 5-6), última tarjeta visible sin tape de la bottom bar, identificación visual clara.

**Independent Test**: Cargar `/lobby/vs-bots` con ≥ 12 bots → scrollear hasta el final → última tarjeta visible. Resize a 360 px → grilla compacta. Resize a 1440 px → varias columnas.

### Tests for User Story 3

- [X] T029 [P] [US3] Extender `bots-config-page.component.spec.ts` (de T021) con un test específico: con catálogo de 30 bots, el contenedor de scroll aplica el padding-bottom correcto (no overlap con bottom bar)

### Implementation for User Story 3

- [X] T030 [P] [US3] Refinar `bot-card.component.scss`: `min-height: 88px`, tap target confortable, focus visible (per D-009)
- [X] T031 [P] [US3] Refinar `bots-config-page.component.scss`: grilla `repeat(auto-fill, minmax(160px, 1fr))` con `gap: 12px`, único `@media (min-width: 1024px)` (per design-system-standards) ajustando `gap` a 16px si aplica; `role="region"` + `aria-label="Acciones de partida"` en la bottom bar (per D-009)
- [ ] T032 [US3] Validar visualmente en navegador a 360 px, 720 px y 1440 px que la grilla escala correctamente y que no se introducen sub-breakpoints intermedios (per responsive-scope memory) — **pendiente QA manual**

**Checkpoint**: Todas las US funcionales e independientemente entregables.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T033 [P] Pasar `pnpm lint:fix` y `pnpm format` sobre los archivos nuevos/modificados
- [X] T034 [P] Verificar que `pnpm test` corre verde (todas las suites nuevas + cero regresiones)
- [ ] T035 Ejecutar manualmente el flujo de `specs/003-lobby-bots/quickstart.md` (US1 + US2 + US3 + edge cases) y registrar en una sección "Validación QA" del PR — **pendiente QA manual**
- [ ] T036 [P] Verificar SC-001 (lobby sin scroll a 360×780 y 1440×900), SC-003 (CTA siempre visible), SC-004 (60 fps con 30 bots) usando DevTools Performance — **pendiente QA manual**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **BLOQUEA** todas las US. T007 depende de T003+T004; T008 depende de T007.
- **US1 (Phase 3)**: depende de Phase 2 (especialmente T009 para la ruta `/lobby`).
- **US2 (Phase 4)**: depende de Phase 2 (T007 servicio, T004 modelos, T005 error copy, T009 ruta `/lobby/vs-bots`).
- **US3 (Phase 5)**: depende de US2 (refina componentes ya implementados).
- **Polish (Phase 6)**: depende de todas las US deseadas.

### User Story Dependencies

- **US1 (P1)**: independiente. Entrega valor sin US2/US3 (login → lobby con CTA muerta — pero el header global y la confirmación de logout son standalone).
- **US2 (P1)**: depende del header global de US1 montado en `app.html` para respetar el layout. Funcionalmente independiente del CTA del lobby (se puede acceder a `/lobby/vs-bots` directo).
- **US3 (P2)**: refinamientos sobre US2; no aporta valor sin US2.

### Within Each User Story

- Tests primero (escribir, ver fallar) antes de implementación.
- Modelos antes de servicios; servicios antes de componentes; componentes hijos antes de páginas que los consumen.

### Parallel Opportunities

- T003, T004, T005, T006 corren en paralelo (archivos distintos, no dependen entre sí).
- T010, T011, T012 (tests US1) en paralelo.
- T013, T014, T016 son `[P]` pero T014 depende de T013 (dialog antes que header lo invoque); T015 depende de T014.
- T019, T020, T021 (tests US2) en paralelo.
- T022 y T023 en paralelo (componentes hoja independientes).
- T030 y T031 en paralelo dentro de US3.

---

## Parallel Example: Phase 2 (Foundational)

```
# Lanzar en paralelo modelos + error copy + tests del catálogo de copy:
T003 — bot.models.ts
T004 — match.models.ts (extensión)
T005 — error-copy.ts
T006 — error-copy.spec.ts
# Cuando T003+T004 terminen:
T007 — bots-api.service.ts
# Después:
T008 — bots-api.service.spec.ts (paralelo con T009)
T009 — app.routes.ts
```

## Parallel Example: User Story 2 tests

```
T019 — bot-card.component.spec.ts
T020 — series-format-selector.component.spec.ts
T021 — bots-config-page.component.spec.ts
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Ambas historias son **P1**: el MVP de esta feature requiere las dos. Orden recomendado:

1. Phase 1 (Setup): T001–T002.
2. Phase 2 (Foundational): T003–T009.
3. Phase 3 (US1): T010–T018.
4. Phase 4 (US2): T019–T028.
5. **STOP & VALIDATE**: ejecutar quickstart US1 + US2.
6. Demo / merge candidato.

### Incremental Delivery

1. Foundational ready (T003–T009) → CI verde.
2. US1 entregada → demo: login funcional con header global + logout confirmable.
3. US2 entregada → demo: crear partida vs bot end-to-end.
4. US3 entregada → refinamiento visual y QA responsivo.
5. Polish → merge.

### Parallel Team Strategy

- Dev A: Phase 2 (foundational) + US1.
- Dev B: empieza US2 en paralelo a US1 una vez T007/T009 listos (modelos, servicio y ruta `/lobby/vs-bots`).
- Dev C: toma US3 cuando US2 esté estable.

---

## Notes

- `[P]` = archivos distintos, sin dependencias bloqueantes.
- `[Story]` mapea trazabilidad task ↔ spec.
- Cada US es independientemente testeable y entregable (US3 modulo dependencia visual de US2).
- Sin WebSockets en esta feature (FR-017).
- Todos los errores mostrados al usuario pasan por `getErrorCopy(...)` — jamás `ApiError.message` ([[error-messaging]]).
- Mobile-first con único `@media (min-width: 1024px)` ([[responsive-scope]]).
- Ruta `/match/:matchId` aún no existe — navegación quedará en `'**'` hasta que se entregue la feature de partida (D-008 / quickstart §Flujo a verificar US2).
