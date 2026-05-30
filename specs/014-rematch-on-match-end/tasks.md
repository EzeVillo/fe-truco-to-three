---

description: "Task list for feature 014-rematch-on-match-end"
---

# Tasks: Revancha al terminar una partida

**Feature branch**: `014-rematch-on-match-end` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` después de cambiar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md` §4.17 / §9.6 antes de tipar un DTO.
> - **CTAs tematizados**: usar `t3-btn t3-btn--primary` / `t3-btn--neutral`; nunca `mat-flat-button` ni `color="primary"`.
> - **Copy de errores**: usar `getErrorCopy('REMATCH', error)`; nunca `ApiError.message` crudo en la UI.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: A qué user story pertenece la tarea (US1–US4)
- Las rutas son relativas a la raíz del repositorio

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: No se requieren nuevas dependencias ni configuración de proyecto. Esta fase verifica el punto de partida.

- [x] T001 Verificar que los `eventType` REMATCH_* ya existen en `src/app/features/match/models/match-ws-events.ts` y anotar cuáles interfaces de payload faltan para agregar en Phase 2

**Checkpoint**: Punto de partida confirmado — Phase 2 puede comenzar

---

## Phase 2: Foundational (Prerequisitos bloqueantes)

**Purpose**: Tipos, modelos, copy de errores, canal WS dedicado y contract test. Todo lo demás depende de esta fase.

**⚠️ CRÍTICO**: Ningún user story puede empezar hasta que esta fase esté completa.

- [x] T002 [P] Agregar interfaces de payload `RematchAvailablePayload`, `RematchOpponentWantsPayload`, `RematchConfirmedPayload`, `RematchClosedByLeavePayload`, `RematchExpiredPayload` en `src/app/features/match/models/match-ws-events.ts` (tipando contra §9.6; `expiresAt: number` en epochMillis para `REMATCH_AVAILABLE`)
- [x] T003 [P] Crear `src/app/features/match/models/rematch.models.ts` con enums `RematchSessionStatus` (`OPEN | CONFIRMED | CLOSED_BY_LEAVE | EXPIRED`) y `RematchChoice` (`UNDECIDED | WANTS_REMATCH | LEFT`), tipo `RematchSessionResponse` (DTO REST §4.17.3 con `expiresAt: string` ISO-8601) y tipo `RematchSession` (vista cliente con `expiresAt: number | null` en epochMillis y campos `selfChoice`/`opponentChoice`)
- [x] T004 [P] Agregar scope `'REMATCH'` con mensajes de error mapeados por código HTTP/tipo en `src/app/shared/error-copy/error-copy.ts` (404 = sin sesión, 422 = sesión no disponible/expirada/no participante)
- [x] T005 [P] Crear `src/tests/contract/rematch.contract.spec.ts` que verifique paridad de los 5 `eventType` REMATCH_*, forma de payloads (§9.6), presencia de endpoints (§4.17.1–3) y campos del DTO `RematchSessionResponse` contra `docs/CONTRATOS_API.md`; incluir nota del dual-format de `expiresAt` (epochMillis por WS, ISO-8601 por REST)
- [x] T006 Agregar `rematch$ = new Subject<MatchWsEvent>()` a `src/app/features/match/services/match-state.service.ts` e interceptar los 5 `REMATCH_*` en la callback de `/user/queue/match` antes de `processLiveEvent`: si `isRematchEvent(event.eventType)`, emitir por `rematch$` y retornar sin pasar por la cola ack-gated ni por la reconciliación por `stateVersion` (research D1)

**Checkpoint**: Tipos, error copy, canal WS y contract test listos — cualquier user story puede comenzar en paralelo

---

## Phase 3: US1 — Oferta de revancha visible tras cerrar el modal de resultado (P1) 🎯 MVP

**Goal**: Al terminar una partida casual, el jugador cierra el modal de resultado y ve la oferta de revancha con el tiempo restante real, o bien navega al lobby si no hay sesión disponible.

**Independent Test**: Flujo 1 del quickstart — terminar una partida, cerrar el modal de resultado, verificar que aparece el `RematchDialogComponent` con botones "Revancha" / "Salir" y countdown; verificar que no aparece simultáneo al modal.

### Implementación US1

- [x] T007 [US1] Crear `src/app/features/match/services/rematch-api.service.ts` con método `getSession(matchId: string): Observable<RematchSessionResponse>` para `GET /api/matches/{matchId}/rematch` (§4.17.3); normalizar `expiresAt` de ISO-8601 a epochMillis con `Date.parse()` antes de devolver el resultado
- [x] T008 [US1] Crear `src/app/features/match/services/rematch-state.service.ts` con signal `session = signal<RematchSession | null>(null)`, método `init(matchId, viewerSeat)` que llama `getSession` (200 → setea `session` mapeando `playerOneChoice/playerTwoChoice` a `selfChoice/opponentChoice` por `viewerSeat`; 404 → `session = null`) y reducer para `REMATCH_AVAILABLE` suscrito a `rematch$` de `MatchStateService` (crea sesión OPEN con UNDECIDED/UNDECIDED y `expiresAt` en epochMillis)
- [x] T009 [P] [US1] Crear `src/app/features/match/utils/rematch-view.ts` con funciones de derivación puras: `offerVisible`, `canAccept` (`status=OPEN && selfChoice=UNDECIDED`), `waitingForOpponent` (`status=OPEN && selfChoice=WANTS_REMATCH`), `opponentWants` (`opponentChoice=WANTS_REMATCH && status=OPEN`), `opponentLeft` (`status=CLOSED_BY_LEAVE`), `expired` (`status=EXPIRED`), `confirmedMatchId` (`status=CONFIRMED ? resultMatchId : null`)
- [x] T010 [US1] Crear componente standalone `src/app/features/match/components/rematch-dialog/rematch-dialog.component.ts` (+ `.html`, `.scss`) que inyecta `RematchStateService`: estado inicial OPEN/UNDECIDED muestra botón "Revancha" (`t3-btn t3-btn--primary`), botón "Salir" (`t3-btn t3-btn--neutral`) y countdown del tiempo restante real; SCSS usa exclusivamente tokens `var(--t3-…)`; responsive desde 360 px con `@media (min-width: 1024px)`
- [x] T011 [US1] Modificar `src/app/features/match/pages/match-screen/match-screen.component.ts` para: proveer `RematchStateService` en el componente e inicializarlo con `matchId` y `viewerSeat`; inyectar `ViewContainerRef`; en el `afterClosed` del modal de resultado (`GameWonDialogComponent`), si `session()` es null hacer `getSession(matchId)` puntual para resolver la carrera, luego abrir `RematchDialogComponent` con `viewContainerRef` si hay sesión o navegar al lobby si `404`/null

**Checkpoint**: US1 completo — cerrar el modal de resultado muestra la oferta de revancha con countdown real o navega al lobby

---

## Phase 4: US2 — Reflejo en tiempo real del estado del rival y acciones del jugador (P2)

**Goal**: El jugador puede aceptar o salir de la revancha; la UI refleja en tiempo real la decisión del rival (quiere / rechazó o abandonó).

**Independent Test**: Flujos 2, 3 y 5 del quickstart — jugador A acepta → ve "Esperando al rival…"; jugador B acepta → A ve "El rival quiere revancha"; jugador B sale → A ve "El rival no quiere revancha" + solo "Salir".

### Implementación US2

- [x] T012 [US2] Extender `src/app/features/match/services/rematch-api.service.ts` con `choose(matchId: string): Observable<void>` → `POST /api/matches/{matchId}/rematch/choose` (§4.17.1, 204) y `leave(matchId: string): Observable<void>` → `POST /api/matches/{matchId}/rematch/leave` (§4.17.2, 204)
- [x] T013 [US2] Extender `src/app/features/match/services/rematch-state.service.ts` con: método `accept(matchId)` (setea `selfChoice=WANTS_REMATCH` optimistamente, llama `choose(matchId)`; en error 4xx revierte y setea copy via `getErrorCopy('REMATCH', err)`); método `leave(matchId)` (setea `status=CLOSED_BY_LEAVE`, `selfChoice=LEFT` optimistamente, llama `leave(matchId)`); reducers para `REMATCH_OPPONENT_WANTS` (`opponentChoice=WANTS_REMATCH`) y `REMATCH_CLOSED_BY_LEAVE` (`status=CLOSED_BY_LEAVE`, `opponentChoice=LEFT`) sobre `rematch$`
- [x] T014 [US2] Extender `src/app/features/match/components/rematch-dialog/rematch-dialog.component.ts` para mostrar: texto "Esperando al rival…" cuando `waitingForOpponent`; leyenda "El rival quiere revancha" cuando `opponentWants`; estado "El rival no quiere revancha" + deshabilitar "Revancha" + solo "Salir" cuando `opponentLeft`; mensajes de error del catálogo sin mostrar `ApiError.message`

**Checkpoint**: US2 completo — aceptación/salida del jugador y reflejo del rival funcionan en tiempo real

---

## Phase 5: US3 — Confirmación automática y navegación a la nueva partida (P2)

**Goal**: Cuando ambos jugadores aceptan, ambos navegan automáticamente a la nueva partida sin pasos manuales adicionales.

**Independent Test**: Flujo 4 del quickstart — ambos jugadores aceptan → ambos navegan automáticamente a `/match/{newMatchId}` ya en curso (mismo rival, mismo formato de serie), sin acción extra.

### Implementación US3

- [x] T015 [US3] Extender `src/app/features/match/services/rematch-state.service.ts` con: reducer para `REMATCH_CONFIRMED` sobre `rematch$` (`status=CONFIRMED`, `resultMatchId=newMatchId`); método `reset()` que setea `session = null` para limpiar al re-init con nuevo `matchId`
- [x] T016 [US3] Extender `src/app/features/match/components/rematch-dialog/rematch-dialog.component.ts` con estado CONFIRMED: mostrar brevemente "¡Revancha! Empezando…" y cerrar el diálogo automáticamente con `dialogRef.close({ confirmedMatchId })` al detectar `confirmedMatchId` no-null via `effect()`
- [x] T017 [US3] Modificar `src/app/features/match/pages/match-screen/match-screen.component.ts` para: leer `route.paramMap` de forma reactiva (no solo `route.snapshot`) y re-inicializar `MatchStateService.init` + `RematchStateService.reset()` + limpiar suscripciones del match anterior cuando cambia `matchId`; navegar a `/match/{confirmedMatchId}` al recibir el cierre del `RematchDialogComponent` con `confirmedMatchId`

**Checkpoint**: US3 completo — navegación automática a la nueva partida funcional para ambos jugadores

---

## Phase 6: US4 — Expiración de la ventana de revancha (P3)

**Goal**: Cuando la ventana expira sin confirmación, la UI lo comunica claramente y solo ofrece salir, sin dejar al jugador en espera indefinida.

**Independent Test**: Flujo 7 del quickstart — dejar correr la ventana sin aceptar → aparece "La revancha venció" + solo "Salir"; el countdown muestra el tiempo restante real desde que se abre la oferta.

### Implementación US4

- [x] T018 [US4] Extender `src/app/features/match/services/rematch-state.service.ts` con reducer para `REMATCH_EXPIRED` sobre `rematch$`: setear `status=EXPIRED` en `session`
- [x] T019 [P] [US4] Extender `src/app/features/match/utils/rematch-view.ts` con función `computeCountdown(expiresAt: number | null, serverClockOffsetMs: number, nowMs: number): number` usando `computeRemainingMsFromSnapshot` de `src/app/features/match/utils/turn-timer.ts`; agregar signal `nowMs` con tick de ~200–250 ms activo solo cuando `status=OPEN`
- [x] T020 [US4] Extender `src/app/features/match/components/rematch-dialog/rematch-dialog.component.ts` con: countdown visible calculado con `computeCountdown` (muestra tiempo restante real desde apertura de la oferta); atenuar UI localmente cuando countdown llega a 0 sin declarar expiración por cuenta propia (el cierre efectivo lo marca `REMATCH_EXPIRED`); estado EXPIRED definitivo al recibir el evento: "La revancha venció" + solo "Salir"

**Checkpoint**: US4 completo — expiración correctamente comunicada, sin espera indefinida

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T021 [P] Escribir unit tests en `src/app/features/match/services/rematch-state.service.spec.ts`: reducción de cada uno de los 5 eventos REMATCH_*; init por snapshot (200 con mapeo viewerSeat y 404 = null); acciones optimistas `accept()`/`leave()` y rollback en error; errores via `getErrorCopy('REMATCH', …)`
- [x] T022 [P] Escribir unit tests en `src/app/features/match/utils/rematch-view.spec.ts`: derivados `canAccept`, `waitingForOpponent`, `opponentWants`, `opponentLeft`, `expired`, `confirmedMatchId`; normalización de `expiresAt` ISO → epochMillis; función `computeCountdown`
- [x] T023 [P] Escribir unit tests en `src/app/features/match/services/match-state.service.spec.ts`: verificar que los 5 `REMATCH_*` se emiten por `rematch$` y no rompen `stateVersion` ni quedan atrapados en la cola ack-gated pausada tras `MATCH_FINISHED`
- [x] T024 [P] Escribir unit tests en `src/app/features/match/components/rematch-dialog/rematch-dialog.component.spec.ts`: estados de UI (OPEN/UNDECIDED, waitingForOpponent, opponentWants, opponentLeft, expired, CONFIRMED); botonera solo con `t3-btn` (no `mat-*-button`); copy de errores sin texto crudo del BE; navegación al CONFIRMED
- [x] T025 [P] Escribir unit tests en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`: `afterClosed` abre la oferta si hay sesión o navega al lobby si no (incluir caso de carrera: signal null → `getSession` puntual); re-init por cambio de `matchId` vía `paramMap` (limpia estado anterior)
- [x] T026 Verificar layout responsive del `RematchDialogComponent` a 360 px y ≥ 1024 px sin desbordes ni controles inaccesibles; ajustar SCSS con breakpoint único `@media (min-width: 1024px)` si es necesario
- [x] T027 Correr `pnpm lint:styles` (tokens CSS sin hardcode), `pnpm lint:themes` (no `mat-*-button` ni `color="primary"`), `pnpm lint` (ESLint TS/HTML), `pnpm test` (contract test + unit tests) y `pnpm build` (compilación sin errores); corregir cualquier warning o error

**Checkpoint final**: SC-001…SC-007 verificados — la feature está lista para merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar de inmediato
- **Foundational (Phase 2)**: Depende solo de Phase 1 — **BLOQUEA** todos los user stories
- **US1 (Phase 3)**: Depende de Phase 2 completa — MVP independientemente testeable
- **US2 (Phase 4)**: Depende de Phase 2 (T002–T006) + US1 (T007–T011 — usa RematchStateService y RematchDialogComponent ya creados)
- **US3 (Phase 5)**: Depende de US2 (T013 para RematchStateService, T014 para RematchDialogComponent)
- **US4 (Phase 6)**: Depende de US1 (T008 RematchStateService base, T010 RematchDialogComponent base)
- **Polish (Phase 7)**: Depende de que todos los user stories estén completos

### User Story Dependencies

- **US1 (P1)**: Puede empezar una vez completa Phase 2 — sin dependencias en otros stories
- **US2 (P2)**: Depende de US1 (extiende archivos ya creados) — independientemente testeable
- **US3 (P2)**: Depende de US2 (extiende RematchStateService con CONFIRMED) — independientemente testeable
- **US4 (P3)**: Puede empezar en paralelo con US2 (extiende archivos distintos de US3) — independientemente testeable

### Within Each User Story

- Servicios de API (`rematch-api.service.ts`) antes que servicios de estado (`rematch-state.service.ts`)
- Servicios de estado antes que componentes de UI (`rematch-dialog.component.ts`)
- Componentes de UI antes que integración en `match-screen.component.ts`

### Parallel Opportunities

- T002, T003, T004, T005 pueden correr en paralelo (archivos distintos)
- T009 puede correr en paralelo con T007 y T008 (archivo distinto)
- T018, T019 pueden correr en paralelo (T019 en archivo distinto)
- T021, T022, T023, T024, T025 pueden correr en paralelo (spec files distintos)

---

## Parallel Example: Phase 2 (Foundational)

```
# Lanzar en paralelo (archivos distintos):
T002: match-ws-events.ts  → payload interfaces de REMATCH_*
T003: rematch.models.ts   → enums + tipos RematchSession + RematchSessionResponse
T004: error-copy.ts       → scope 'REMATCH'
T005: rematch.contract.spec.ts → contract test §4.17/§9.6

# Después, en secuencia (depende de T002):
T006: match-state.service.ts → canal rematch$
```

## Parallel Example: US1 (Phase 3)

```
# Secuencia interna (cada uno depende del anterior):
T007: rematch-api.service.ts     → getSession()
T008: rematch-state.service.ts   → init() + REMATCH_AVAILABLE
T010: rematch-dialog.component   → UI base con countdown

# Puede correr en paralelo con T007–T008:
T009: rematch-view.ts            → funciones de derivación puras

# Al final (depende de T008 + T010):
T011: match-screen.component.ts  → afterClosed + decisión oferta-vs-lobby
```

---

## Implementation Strategy

### MVP First (US1 solamente)

1. Completar Phase 1: Setup (T001)
2. Completar Phase 2: Foundational (T002–T006) ← crítico, bloquea todo
3. Completar Phase 3: US1 (T007–T011)
4. **PARAR Y VALIDAR**: flujo 1 del quickstart — cerrar resultado → oferta visible con countdown
5. Demo/review si está listo

### Entrega incremental

1. Setup + Foundational → base de tipos y canal WS lista
2. US1 → oferta básica visible → validar → demo (MVP)
3. US2 → acciones bidireccionales + reflejo del rival → validar
4. US3 → confirmación automática → validar
5. US4 → expiración + countdown → validar
6. Polish → tests, responsive, lint, build → merge

---

## Notes

- `[P]` = diferentes archivos, sin dependencias entre sí
- `[USn]` = tarea pertenece a ese user story para trazabilidad
- El `GameWonDialogComponent` **no** se modifica (la oferta es un diálogo aparte: research D3)
- `expiresAt`: normalizar siempre a epochMillis en el cliente (`Date.parse` para el path REST)
- El FE no declara expiración localmente al llegar a 0; espera `REMATCH_EXPIRED` del backend
- Cada tarea debe poder completarse y commitearse de forma independiente
