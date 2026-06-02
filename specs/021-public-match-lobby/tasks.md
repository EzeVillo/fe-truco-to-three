---
description: "Task list — Lobby público de matches (021)"
---

# Tasks: Lobby público de matches

**Input**: Design documents from `/specs/021-public-match-lobby/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-match-lobby.md, quickstart.md

**Tests**: INCLUIDOS — el proyecto exige contract tests (Principio II) y unit tests del motor de reconcile.

**Organization**: Tareas agrupadas por user story para implementación/validación independiente.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` tras cambiar estilos.
> - **Contrato**: verificar campos contra `docs/CONTRATOS_API.md` antes de tipar un DTO. `gamesToPlay ∈ {1,3,5}`.
> - **CTAs**: variantes `t3-btn`, nunca `mat-flat-button`/`color="primary"`.
> - **Copy de errores**: `getErrorCopy()`, nunca `ApiError.message` crudo.
> - **`:hover`**: gateado en `@media (hover: hover)`. Correr `pnpm lint:hover`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: a qué user story pertenece (US1/US2/US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estructura de carpetas para la feature.

- [X] T001 [P] Crear scaffolding de directorios: `src/app/shared/public-lobby/` y `src/app/features/lobby/components/{public-match-list,public-match-card,visibility-selector}/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Motor genérico de reconcile + DTOs + acceso REST de lista. Prerrequisito de US1 y US3.

**⚠️ CRITICAL**: Ninguna user story puede completarse hasta terminar esta fase.

- [X] T002 [P] Tipar DTOs del lobby de matches: agregar `PublicMatchesPage` en `src/app/core/models/match.models.ts` y crear `PublicMatchLobbyItem` + eventos `PublicMatchLobbyUpsertEvent`/`PublicMatchLobbyRemovedEvent`/`PublicMatchLobbyEvent` en `src/app/features/lobby/models/public-match-lobby.models.ts` (campos verificados contra `docs/CONTRATOS_API.md §4.3` y §9.4)
- [X] T003 [P] Definir tipos genéricos del motor en `src/app/shared/public-lobby/public-lobby.types.ts` (`PublicLobbyPage<T>`, `PublicLobbyDelta<T>`, `PublicLobbyConfig<T>`, `PublicLobbyStatus`) según `data-model.md`
- [X] T004 Implementar el motor genérico `PublicLobbyStore<T>` en `src/app/shared/public-lobby/public-lobby-store.ts` (estado `Map<id,T>` + `removedIds`, signals `items()/status()/hasMore()`, métodos `start()/loadMore()/retry()/stop()`; suscribe deltas antes del bootstrap; dedup e idempotencia por id) — depende de T003
- [X] T005 [P] Unit tests del motor genérico en `src/app/shared/public-lobby/public-lobby-store.spec.ts` (bootstrap, upsert, removed, delta-antes-de-bootstrap vía `removedIds`, dedup en update, `loadMore`, `retry`, orden estable) — depende de T004
- [X] T006 [P] Contract test en `src/tests/contract/public-match-lobby.contract.spec.ts` validando `PublicMatchLobbyItem` y los eventos WS contra `docs/CONTRATOS_API.md §4.3/§9.4` con `satisfies` (incluye `gamesToPlay: 1|3|5`) — depende de T002
- [X] T007 Extender `src/app/features/lobby/services/matches-api.service.ts` con `listPublicMatches(limit?, after?)` → `PublicMatchesPage` (`GET /api/matches/public`, parseo de `joinCode` desde `_links.join.href` y `nextCursor` desde `_links.next.href`) — depende de T002

**Checkpoint**: Motor genérico testeado + lista REST disponible. US1/US3 pueden comenzar.

---

## Phase 3: User Story 1 - Ver y unirse a una partida pública abierta (Priority: P1) 🎯 MVP

**Goal**: Listar partidas públicas abiertas y unirse a una con una sola acción, con estados vacío/carga/error y toast no bloqueante ante race condition.

**Independent Test**: Con ≥1 partida pública abierta, abrir "Jugar online", ver la partida (host, formato, x/y) y tocar "Unirse" → entra a `/match/:id`; si la partida se llenó justo, ve un toast y queda en el lobby.

- [X] T008 [US1] Mapper topic→delta en `src/app/features/lobby/services/public-match-lobby.store.ts`: suscribir `/topic/public-match-lobby` vía `WebSocketService` y mapear `UPSERT → {kind:'upsert', item: payload.lobby}` / `REMOVED → {kind:'removed', id: payload.id}`
- [X] T009 [US1] Implementar `PublicMatchLobbyStore` en `src/app/features/lobby/services/public-match-lobby.store.ts` instanciando `PublicLobbyStore<PublicMatchLobbyItem>` con `loadPage = listPublicMatches`, `deltas$` del mapper y `idOf = matchId` — depende de T007, T008
- [X] T010 [P] [US1] `PublicMatchCardComponent` en `src/app/features/lobby/components/public-match-card/` (muestra host, label de formato vía `SERIES_FORMAT_LABELS`, `occupiedSlots/totalSlots`, botón "Unirse" `t3-btn`; emite evento `join`)
- [X] T011 [P] [US1] `PublicMatchListComponent` en `src/app/features/lobby/components/public-match-list/` (renderiza cards, estados vacío/carga/error con reintento, botón "Cargar más" gobernado por `hasMore()`)
- [X] T012 [P] [US1] Agregar scope `'PUBLIC_LOBBY'` en `src/app/shared/error-copy/error-copy.ts` para el copy de error de carga de lista (reintento); el join sigue usando scope `JOIN_MATCH`
- [X] T013 [US1] Integrar la lista en `OnlineMatchPageComponent` (`.ts/.html/.scss` en `src/app/features/lobby/pages/online-match-page/`): sección superior con `PublicMatchListComponent`, arrancar el store en init y pararlo en destroy, handler `onJoinPublic(item)` que extrae `joinCode` y reusa `joinByCode` → navega a `/match/:targetId` (sin `/start`)
- [X] T014 [US1] Toast de race condition en `OnlineMatchPageComponent`: en error de join abrir `MatSnackBar` con `getErrorCopy('JOIN_MATCH', err)`, permanecer en el lobby y **no** forzar refresco ni remover la partida (la baja llega por delta) — depende de T013
- [X] T015 [US1] Manejo de partida propia: marcar `host === username actual` como "tuya"; su acción navega a `/match/:matchId` en vez de re-unirse (edge case spec) — depende de T010, T013
- [X] T016 [P] [US1] Unit test de `PublicMatchLobbyStore` + mapper en `src/app/features/lobby/services/public-match-lobby.store.spec.ts` (bootstrap vía REST, aplicación de deltas del topic, navegación de join)
- [X] T017 [P] [US1] SCSS de lista y card con tokens `var(--t3-…)`, responsive 360/desktop, `:hover` gateado; `pnpm lint:styles` y `pnpm lint:hover` en verde

**Checkpoint**: US1 funcional e independiente — el lobby se ve, se puede unir y el toast de race condition funciona. **MVP listo.**

---

## Phase 4: User Story 2 - Crear una partida pública y esperar rival (Priority: P2)

**Goal**: Poder crear una partida eligiendo visibilidad Pública/Privada; la pública aparece en el lobby de otros.

**Independent Test**: Elegir "Pública" + formato, confirmar → quedar esperando rival; en otro navegador la partida aparece en la lista. Elegir "Privada" → genera código, no aparece en lobby.

- [X] T018 [US2] Generalizar `MatchesApiService.createPrivateMatch` → `createMatch(req)` en `src/app/features/lobby/services/matches-api.service.ts` (el DTO `CreateMatchRequest` ya lleva `visibility`); actualizar el único call site
- [X] T019 [P] [US2] `VisibilitySelectorComponent` (toggle Pública/Privada, al estilo de `series-format-selector`) en `src/app/features/lobby/components/visibility-selector/` con SCSS en tokens y `:hover` gateado
- [X] T020 [US2] Integrar en el panel "Crear partida" de `OnlineMatchPageComponent`: signal `visibility` (default `PRIVATE`), `VisibilitySelectorComponent`, pasar `visibility` a `createMatch`, ajustar copy del CTA y de la sala de espera según visibilidad — depende de T018, T019
- [X] T021 [P] [US2] Actualizar `online-match-page.component.spec.ts` cubriendo creación pública vs privada y default `PRIVATE`

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Listado en tiempo real (Priority: P3)

**Goal**: La lista se mantiene fresca sola: aparecen partidas nuevas, desaparecen las que se cierran, y los cambios de partidas visibles se reflejan sin recargar ni duplicar.

**Independent Test**: Con el lobby abierto, otro jugador crea/llena/cancela una partida → la lista se actualiza < 3 s sin recargar; al reconectar el WS, se reconcilia.

- [X] T022 [US3] Re-bootstrap en reconexión: en `PublicMatchLobbyStore` suscribir `WebSocketService.connected` y re-ejecutar el bootstrap de la primera página al reconectar (edge case "pérdida y recuperación") — depende de T009
- [X] T023 [US3] Verificar el path de update en vivo en `PublicMatchListComponent`/store: un `UPSERT` de partida ya visible actualiza la card sin duplicar (trackBy por `matchId`); un `REMOVED` la quita — depende de T009, T011
- [X] T024 [P] [US3] Unit tests de reconcile en vivo en `public-match-lobby.store.spec.ts` (alta por delta, baja por delta, update sin duplicado, re-bootstrap al reconectar) — depende de T022, T023

**Checkpoint**: Las tres user stories funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 [P] Estilar el panel del `MatSnackBar` con tokens en `src/styles.scss` (vía `panelClass` global, fuera del glob de feature para no romper `lint:styles`)
- [X] T026 [P] Revisar/actualizar specs de componentes nuevos (`public-match-card`, `public-match-list`, `visibility-selector`) con casos de render mínimos
- [ ] T027 Validar `quickstart.md` con dos navegadores (US1/US2/US3 + race condition) y correr gates: `pnpm lint`, `pnpm lint:styles`, `pnpm lint:hover`, `pnpm test`, `pnpm build`
- [ ] T028 [P] Confirmar contra backend real si el `payload.lobby` del UPSERT trae lo necesario para unirse (joinCode); si no, deshabilitar "Unirse" en cards solo-WS y anotar en `contracts/public-match-lobby.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **BLOQUEA** las user stories. (T004→T003; T005→T004; T006→T002; T007→T002)
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de Foundational (solo necesita `createMatch` + página); independiente de US1.
- **US3 (Phase 5)**: depende de Foundational + el store de US1 (T009).
- **Polish (Phase 6)**: depende de las stories que se vayan a entregar.

### User Story Dependencies

- **US1 (P1)**: arranca tras Foundational. Sin dependencias de otras stories.
- **US2 (P2)**: arranca tras Foundational. Toca la misma página que US1 (coordinar `online-match-page`), pero es testeable por separado.
- **US3 (P3)**: requiere `PublicMatchLobbyStore` (T009 de US1); hardening del reconcile en vivo.

### Within Each User Story

- Tests antes de la implementación cuando aplican (motor y contrato ya en Foundational).
- Modelos → servicios/stores → componentes → integración en la página.
- En US1, los tasks que tocan `online-match-page` (T013, T014, T015) son **secuenciales** entre sí.

### Parallel Opportunities

- Foundational: T002 y T003 en paralelo; T005 y T006 en paralelo (tras sus deps).
- US1: T010, T011, T012 en paralelo (archivos distintos); T016, T017 en paralelo al final.
- US2: T019 y T021 en paralelo respecto a T018/T020.
- Distintos devs: US1 y US2 en paralelo tras Foundational.

---

## Parallel Example: User Story 1

```bash
# Componentes y copy en paralelo (archivos distintos):
Task: "PublicMatchCardComponent en features/lobby/components/public-match-card/"
Task: "PublicMatchListComponent en features/lobby/components/public-match-list/"
Task: "Agregar scope 'PUBLIC_LOBBY' en shared/error-copy/error-copy.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational (motor + DTOs + REST) → 3. Phase 3 US1.
4. **STOP y VALIDAR**: listar + unirse + toast de race condition de forma independiente.
5. Demo/deploy del MVP.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → listar + unirse (MVP, ya con baja en vivo por deltas).
3. US2 → crear pública/privada.
4. US3 → robustez del tiempo real (reconexión, dedup, tests de borde).
5. Polish → estilo del toast, specs, gates, validación E2E.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Reusa lo existente: `joinByCode` (join), `SeriesFormatSelectorComponent`/`SERIES_FORMAT_LABELS`, `getErrorCopy`, `WebSocketService.subscribe`.
- El motor genérico (`shared/public-lobby/`) queda listo para copas/ligas a futuro (FR-015) — no implementarlas acá.
- Commit por tarea o grupo lógico. Parar en cada checkpoint para validar la story.
