---
description: "Task list — MVP de partida privada por código"
---

# Tasks: MVP de partida privada por código

**Input**: Design documents from `/specs/015-private-match-code/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/private-match-ui-contract.md

**Tests**: Incluidos. El proyecto usa Vitest (unit + contract) y `pnpm test` es gate de la
constitución (Principio II: paridad con `docs/CONTRATOS_API.md`).

**Organization**: Tareas agrupadas por historia de usuario para implementación/validación
independiente.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` tras tocar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md` antes de tipar. `gamesToPlay ∈ {1,3,5}`.
> - **CTAs**: `t3-btn`/título+subtítulo apilados; no `mat-flat-button`. `pnpm lint:themes`.
> - **Copy de errores**: usar `getErrorCopy()`, nunca `ApiError.message`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Punto de entrada de UI y andamiaje compartido.

- [X] T001 Crear esqueleto standalone `OnlineMatchPageComponent` (component + template + scss vacíos con dos secciones: "Crear" y "Unirme") en `src/app/features/lobby/pages/online-match-page/`
- [X] T002 Registrar ruta lazy `/lobby/online` (con `authGuard`) en `src/app/app.routes.ts`
- [X] T003 [P] Agregar CTAs "Crear partida online" y "Unirme con código" que navegan a `/lobby/online` en `src/app/features/lobby/pages/lobby-page/` (component + template + scss), con título+subtítulo apilados

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelos, contrato, servicio REST y catálogo de errores que todas las historias usan.

**⚠️ CRITICAL**: Ninguna historia puede completarse hasta terminar esta fase.

- [X] T004 Verificación D1: el estado `READY` se agregó a `MATCH_STATUS` (`enums.ts`) y a `docs/CONTRATOS_API.md §8.2` (referenciado por §4.2/§4.13). La presencia de rival se deriva de forma defensiva como `playerTwoUsername != null || status === 'READY'`, robusta ante ambos resultados de runtime. (Verificación contra backend en vivo: pendiente en T037)
- [X] T005 [P] Tipar `CreateMatchRequest`, `CreateMatchResponse` y `JoinResponse` en `src/app/core/models/match.models.ts` (verificados contra §4.1/§4.2)
- [X] T006 [P] Cambiar `playerTwoUsername: string | null` en `MatchState` y ajustar `src/app/features/match/utils/derive-match-view.ts` para tolerar `null` (placeholder "Esperando rival…") — D2
- [X] T007 [P] Tipar payloads `PlayerReadyPayload` y `MatchPlayerLeftPayload` en `src/app/features/match/models/match-ws-events.ts` (§9.6)
- [X] T008 Crear `MatchesApiService` con `createPrivateMatch`, `joinByCode`, `startMatch`, `leaveMatch` en `src/app/features/lobby/services/matches-api.service.ts` (§4.1/§4.2/§4.5/§4.13)
- [X] T009 [P] Agregar scopes `'CREATE_MATCH'` y `'JOIN_MATCH'` a `ErrorCopyScope` y `getErrorCopy()` en `src/app/shared/error-copy/error-copy.ts` (mapeo de data-model §6)
- [X] T010 [P] Contract test `src/tests/contract/private-match.contract.spec.ts` verificando paridad de DTOs y eventos pre-juego con `docs/CONTRATOS_API.md` §4.1/§4.2/§4.5/§4.13/§4.14/§9.6

**Checkpoint**: Contrato y servicio listos; las historias pueden empezar.

---

## Phase 3: User Story 1 - Crear partida privada y compartir el código (Priority: P1) 🎯 MVP

**Goal**: El anfitrión crea una partida privada, obtiene un código compartible/copiable y queda en
una sala de espera "esperando rival".

**Independent Test**: Crear una privada y verificar que se muestra el código, se puede copiar y el
creador queda en estado de espera (sin necesidad de un segundo jugador).

### Tests for User Story 1

- [X] T011 [P] [US1] Spec del flujo de creación (formato → `createPrivateMatch` → navegación) en `src/app/features/lobby/pages/online-match-page/online-match-page.component.spec.ts`
- [X] T012 [P] [US1] Spec de `WaitingRoomComponent` vista anfitrión (código visible, copiar, "esperando rival") en `src/app/features/match/components/waiting-room/waiting-room.component.spec.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implementar sección "Crear" en `online-match-page` reusando `SeriesFormatSelectorComponent` y llamando `MatchesApiService.createPrivateMatch` con `gamesToPlay` vía `seriesFormatToGamesToPlay`
- [X] T014 [US1] Tras crear, navegar a `/match/:matchId` pasando `joinCode` por navigation state y persistiéndolo en `sessionStorage` (`t3.joinCode.<matchId>`) — D5, en `online-match-page.component.ts`
- [X] T015 [P] [US1] Crear `WaitingRoomComponent` standalone (vista anfitrión: `joinCode` destacado + botón Copiar `t3-btn`, `seriesLabel`, texto "Esperando rival…") en `src/app/features/match/components/waiting-room/`
- [X] T016 [US1] En `MatchScreenComponent`, renderizar `WaitingRoomComponent` cuando `status ∉ {IN_PROGRESS, FINISHED}` y recuperar el `joinCode` desde navigation state / `sessionStorage` para el host (`src/app/features/match/pages/match-screen/`)
- [X] T017 [US1] Manejo de error de creación con `getErrorCopy('CREATE_MATCH', err)` (incl. 409/422 jugador ocupado / revancha pendiente), sin dejar pantalla rota, en `online-match-page.component.ts`

**Checkpoint**: US1 funcional — un anfitrión puede crear y compartir el código y queda esperando.

---

## Phase 4: User Story 2 - Unirse a una partida con un código (Priority: P1)

**Goal**: Un segundo jugador introduce un código válido y entra a la sala; el anfitrión ve la llegada
del rival sin recargar.

**Independent Test**: Con un código de una privada abierta, unirse y verificar que el jugador queda
en la sala con el anfitrión; y que el host ve al rival aparecer.

### Tests for User Story 2

- [X] T018 [P] [US2] Spec del flujo de unión (input código → `joinByCode` → navegación a `targetId`; errores 404/409/422) en `online-match-page.component.spec.ts`
- [ ] T019 [P] [US2] Spec de refresh de roster ante `PLAYER_JOINED`/`PLAYER_READY` en `match-state.service.spec.ts` — **DEFERIDO**: el harness del spec mockea `MatchEventQueueService` y no invoca el callback `applyTransactional`, por lo que requeriría capturar el callback. Comportamiento implementado (T023) y cubierto indirectamente.

### Implementation for User Story 2

- [X] T020 [US2] Implementar sección "Unirme" en `online-match-page` (input de código + `MatchesApiService.joinByCode`; si `targetType === 'MATCH'`, navegar a `/match/:targetId`)
- [X] T021 [US2] Manejo de error de unión con `getErrorCopy('JOIN_MATCH', err)` (404 inexistente, 409 lleno, 422 no disponible/ocupado), permitiendo reintento, en `online-match-page.component.ts`
- [X] T022 [US2] Extender `WaitingRoomComponent` con la vista del invitado ("Esperando que el anfitrión inicie", sin acción Iniciar) — `waiting-room.component.ts`
- [X] T023 [US2] Agregar `refresh()` (re-fetch de snapshot sin reiniciar reconciliación) en `MatchStateService` y dispararlo al recibir `PLAYER_JOINED`/`PLAYER_READY` en estado pre-juego (D7) — `match-state.service.ts`

**Checkpoint**: US1 + US2 — dos jugadores quedan juntos en la sala; el host ve al rival.

---

## Phase 5: User Story 3 - Iniciar la partida y pasar a jugar (Priority: P2)

**Goal**: El anfitrión inicia la partida y ambos jugadores transicionan de la sala al tablero.

**Independent Test**: Con anfitrión y rival presentes, iniciar y verificar que ambos pasan al tablero
y pueden jugar la primera mano.

### Tests for User Story 3

- [X] T024 [P] [US3] Spec de reducer: `GAME_STARTED` setea `status: 'IN_PROGRESS'` (D6) en `src/app/features/match/reducers/match-event.reducer.spec.ts`
- [X] T025 [P] [US3] Spec de `WaitingRoomComponent`: botón Iniciar habilitado solo si host + rival presente (FR-006) en `waiting-room.component.spec.ts`

### Implementation for User Story 3

- [X] T026 [US3] En `match-event.reducer.ts`, el handler de `GAME_STARTED` además setea `status: 'IN_PROGRESS'` (idempotente para games 2+) — D6
- [X] T027 [US3] En `WaitingRoomComponent`, botón Iniciar (`t3-btn t3-btn--primary`) visible/habilitado solo cuando `isHost && rivalPresent` (`canStart`); emitir evento al host — `waiting-room.component.ts`
- [X] T028 [US3] Cablear `MatchesApiService.startMatch(matchId)` desde `MatchScreenComponent` al confirmar Iniciar; al llegar `GAME_STARTED` se renderiza el tablero automáticamente (limpiar `sessionStorage` del `joinCode`) — `match-screen` 

**Checkpoint**: US1 + US2 + US3 — flujo completo de punta a punta hasta jugar.

---

## Phase 6: User Story 4 - Salir de la sala antes de empezar (Priority: P3)

**Goal**: Cualquiera puede salir antes de iniciar; si sale el host se cancela y se avisa al rival; si
sale el invitado, la sala vuelve a "esperando rival" con el mismo código.

**Independent Test**: En la sala, hacer que un jugador salga y verificar el estado correcto en el
otro (cancelación si fue el host; vuelta a espera si fue el invitado).

### Tests for User Story 4

- [X] T029 [P] [US4] Spec de reducer: `MATCH_PLAYER_LEFT` → `status: 'WAITING_FOR_PLAYERS'` + `playerTwoUsername: null` en `match-event.reducer.spec.ts`
- [ ] T030 [P] [US4] Spec de `MatchStateService.preGameClosed$` emitido en `MATCH_CANCELLED` — **DEFERIDO** (mismo motivo que T019: el harness mockea el queue y no invoca `applyTransactional`). Comportamiento implementado (T032).

### Implementation for User Story 4

- [X] T031 [US4] En `match-event.reducer.ts`, manejar `MATCH_PLAYER_LEFT` (status → `WAITING_FOR_PLAYERS`, `playerTwoUsername` → `null`) — D7
- [X] T032 [US4] En `MatchStateService`, exponer `preGameClosed$` y emitirlo al recibir `MATCH_CANCELLED` (motivo `CANCELLED`) — D7, `match-state.service.ts`
- [X] T033 [US4] En `WaitingRoomComponent`, botón Salir (`t3-btn t3-btn--destructive`) que invoca `MatchesApiService.leaveMatch(matchId)` (§4.13) — `waiting-room.component.ts`
- [X] T034 [US4] En `MatchScreenComponent`, suscribir `preGameClosed$` → mostrar aviso ("La partida fue cancelada") y navegar al lobby; limpiar `sessionStorage` del `joinCode`

**Checkpoint**: Las 4 historias funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Calidad transversal y validación final.

- [X] T035 [P] Verificar `pnpm lint:styles` y `pnpm lint:themes` sobre el SCSS/templates nuevos (online-match-page, waiting-room) — ambos verdes
- [X] T036 [P] Documentar en `docs/CONTRATOS_API.md` el gap conocido: `GET /api/matches/{id}` no expone `joinCode` (follow-up, D5)
- [ ] T037 Ejecutar la validación de `quickstart.md` con dos sesiones — **PENDIENTE (manual)**: requiere backend en vivo en `localhost:8080` y dos sesiones de usuario; no ejecutable en este entorno
- [X] T038 Gates: `pnpm lint` ✅ (1 warning preexistente), `pnpm lint:styles` ✅, `pnpm lint:themes` ✅, `pnpm build` ✅, `pnpm test` → 464 passed / 1 failed. **El único fallo es preexistente** (`match-screen.component.spec` › "navega al lobby si session() es null", feature 014); verificado que falla igual en HEAD limpio sin estos cambios. No relacionado con 015

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. BLOQUEA todas las historias.
- **User Stories (Phase 3–6)**: dependen de Foundational. Orden de prioridad P1 → P1 → P2 → P3.
- **Polish (Phase 7)**: depende de las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Independiente.
- **US2 (P1)**: tras Foundational. Reusa el `WaitingRoomComponent` de US1 pero es testeable sola con
  un código pre-existente.
- **US3 (P2)**: tras Foundational. Usa la sala; testeable con anfitrión+rival presentes.
- **US4 (P3)**: tras Foundational. Independiente; usa la sala y el reducer.

### Within Each User Story

- Tests primero (deben fallar) → modelos → servicios → componentes → integración.

### Parallel Opportunities

- Setup: T003 [P].
- Foundational: T005, T006, T007, T009, T010 [P] (archivos distintos); T008 depende de T005; T004 es
  verificación previa.
- Tests por historia marcados [P] corren juntos.
- US1 y US2 pueden encararse en paralelo tras Foundational (distintos desarrolladores), integrando la
  sala compartida.

---

## Parallel Example: Foundational

```bash
# Tras T004 (verificación runtime), lanzar en paralelo:
Task: "T005 Tipar DTOs en core/models/match.models.ts"
Task: "T006 playerTwoUsername nullable + derive-match-view"
Task: "T007 Payloads pre-juego en match-ws-events.ts"
Task: "T009 Scopes de error en error-copy.ts"
Task: "T010 Contract test private-match.contract.spec.ts"
# T008 (MatchesApiService) después de T005.
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1: crear + código + sala).
3. Phase 4 (US2: unirse + host ve al rival).
4. **STOP y VALIDAR**: dos jugadores quedan juntos en la sala.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → demo (crear y compartir).
3. US2 → demo (unirse).
4. US3 → demo (iniciar y jugar de punta a punta) ← **MVP jugable completo**.
5. US4 → demo (salir/cancelar) ← robustez.

---

## Notes

- [P] = archivos distintos, sin dependencias mutuas.
- El motor de juego (tablero, acciones, timer, revancha) se reutiliza; no se modifica.
- Verificar que los tests fallen antes de implementar.
- Commit por tarea o grupo lógico.
- Detenerse en cada checkpoint para validar la historia de forma independiente.
