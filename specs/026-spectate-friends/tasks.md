---
description: "Task list â€” Espectar partidas de amigos (026-spectate-friends)"
---

# Tasks: Espectar partidas de amigos

**Input**: Design documents from `/specs/026-spectate-friends/`

**Prerequisites**: plan.md, spec.md, research.md (D1â€“D11), data-model.md, contracts/spectate.md, quickstart.md

**Tests**: Incluidas. El proyecto tiene cobertura `.spec` por componente/servicio y la Constitution
exige `pnpm test` + contract tests en `src/tests/contract/`. Las tareas de test acompaÃ±an a su
unidad (no TDD estricto: ver guardarraÃ­les).

**Organization**: Tareas agrupadas por user story. US1 + US2 son ambas P1 y forman el MVP
indivisible (entrar a mirar + ver en vivo). US3 (P2) es la capa de robustez (reconexiÃ³n, salir,
cross-device, busy).

> **GuardarraÃ­les del proyecto** â€” verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature â†’ solo `var(--t3-â€¦)`. Correr `pnpm lint:styles` tras cambiar estilos.
> - **Contrato**: verificar campos contra `docs/CONTRATOS_API.md` antes de tipar. Spectate = Â§4.15/Â§9.6; presence = Â§7.6; busyReason = Â§7.4.5.
> - **Copy de errores**: usar `getErrorCopy()`/`spectateErrorCopy()`, nunca el `error`/`message` crudo del backend en la UI.
> - **Solo-lectura**: el espectador NUNCA ve `myCards` ni acciones jugables.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias incompletas)
- **[Story]**: US1 / US2 / US3 (Setup/Foundational/Polish sin label)

## Path Conventions

Proyecto Ãºnico Angular bajo `src/`. Feature en `src/app/features/spectate/`; toques a `src/app/core/`,
`src/app/features/{match,social}/`, `src/app/shared/`, y contract tests en `src/tests/contract/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Esqueleto de carpetas de la feature.

- [X] T001 Crear estructura de carpetas de la feature en `src/app/features/spectate/` (`pages/spectate-screen/`, `services/`, `utils/`) con `.gitkeep` o archivos placeholder a reemplazar.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de contrato, transporte WS con headers, estado de espectador y copy de errores.
Bloquea TODAS las user stories.

**âš ï¸ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

- [X] T002 Extender `WebSocketService.subscribe<T>(destination, headers?)` para pasar headers nativos al `SUBSCRIBE` (`client.subscribe(destination, cb, headers)`), retrocompatible, en `src/app/core/services/websocket.service.ts` (research D2).
- [X] T003 [P] Test de `subscribe` con headers en `src/app/core/services/websocket.service.spec.ts` (verifica que el header `matchId` viaja en el frame).
- [X] T004 [P] Crear modelos de spectate en `src/app/core/models/spectate.models.ts`: `SpectatableMatch`, `SpectateRoundState`, `SpectateMatchState` (incluye `playerOneUsername`, `playerTwoUsername` nullable, `gamesToPlay`, `spectatorCount`, `stateVersion`; sin `myCards`/`availableActions`) â€” verificar campo a campo contra Â§4.15 (D1/D3).
- [X] T005 [P] Agregar `SpectateWsEvent` (`SPECTATE_STATE`, `SPECTATE_ERROR`, `SPECTATOR_COUNT_CHANGED` + eventos pÃºblicos re-difundidos + `ACTION_DEADLINE_*`) en `src/app/core/models/ws.models.ts` (Â§9.5g/Â§9.6).
- [X] T006 [P] Agregar scope `SPECTATE` a `getErrorCopy()` (404/422) y helper `spectateErrorCopy(rawError?)` (mensaje genÃ©rico, sin echo) en `src/app/shared/error-copy/error-copy.ts` (D6).
- [X] T007 [P] Test de copy en `src/app/shared/error-copy/error-copy.spec.ts` para scope `SPECTATE` y `spectateErrorCopy` (nunca expone el string crudo).
- [X] T008 Contract test `src/tests/contract/spectate.contract.spec.ts`: paridad por `satisfies` de la vista Â§4.15 y de `spectatableMatch`/`SPECTATING` (Â§7.4.5) contra los tipos del front (Constitution II).
- [X] T009 [P] `SpectateApiService.getSpectate(matchId)` (GET `/api/matches/{id}/spectate`) en `src/app/features/spectate/services/spectate-api.service.ts`.
- [X] T010 [P] Adapter puro `adaptSpectateToMatchState(state)` â†’ `MatchState` (`viewerSeat:'PLAYER_ONE'`, `roundGame=currentRound` con `myCards:[]`/`availableActions:[]`, roster por copia) en `src/app/features/spectate/utils/adapt-spectate-to-match-view.ts` (D3).
- [X] T011 [P] Test del adapter en `src/app/features/spectate/utils/adapt-spectate-to-match-view.spec.ts` (sin `myCards`/acciones; roster y scores mapeados; `currentRound:null` â‡’ `roundGame:null`).
- [X] T012 `SpectateStateService` en `src/app/features/spectate/services/spectate-state.service.ts`: `init(matchId)` (connect â†’ subscribe `/user/queue/match-spectate` con header `matchId`), maneja `SPECTATE_STATE`/`SPECTATE_ERROR`/`SPECTATOR_COUNT_CHANGED`, reconciliaciÃ³n por `stateVersion` reusando `applyMatchEvent`, re-fetch por hueco vÃ­a `SpectateApiService`, signals `state/loading/error/serverClockOffsetMs`, `destroy()` (unsubscribe) (D4).
- [X] T013 Test de `SpectateStateService` en `src/app/features/spectate/services/spectate-state.service.spec.ts` (alta + snapshot, evento en orden aplica, hueco dispara re-fetch, SPECTATE_ERROR setea copy).

**Checkpoint**: Transporte, tipos, estado y errores listos â€” pueden empezar las user stories.

---

## Phase 3: User Story 1 - Entrar a mirar la partida de un amigo (Priority: P1) ðŸŽ¯ MVP

**Goal**: Desde la lista de amigos, ver quiÃ©n tiene partida espectable y entrar a mirarla, viendo el
estado inicial.

**Independent Test**: Con un amigo confirmado en partida en curso, aparece "Mirar"; al tocarlo
navega a `/spectate/:matchId` y se muestra el snapshot inicial con banner "EstÃ¡s mirando" y contador.

### Implementation for User Story 1

- [X] T014 [P] [US1] Agregar `spectatableMatch: SpectatableMatch | null` a `FriendSummary` en `src/app/core/models/social.models.ts` (reemplaza la nota "fuera de alcance" de 025; Â§7.4.5).
- [X] T015 [P] [US1] Agregar `spectatableMatch` a `FriendAvailabilitySnapshotItem` y `FriendAvailabilityDelta` en `src/app/core/models/ws.models.ts` (Â§9.6).
- [X] T016 [US1] Mapear `spectatableMatch` en `listFriends()` de `src/app/features/social/services/social-api.service.ts` (+ ajustar su spec en `social-api.service.spec.ts`).
- [X] T017 [US1] Conservar `spectatableMatch` en `mergeAvailability`/`upsertFriend` (default `null`) de `src/app/features/social/services/social.store.ts` (+ casos en `social.store.spec.ts`).
- [X] T018 [US1] Agregar a `FriendRowComponent` input `spectatableMatchId: string | null`, computed `canSpectate`, output `spectate`, y botÃ³n "Mirar" (gated por `canSpectate`) en `src/app/features/social/components/friend-row/friend-row.component.{ts,html,scss}` (tokens CSS; `@media (hover: hover)` si hay hover).
- [X] T019 [P] [US1] Test de `FriendRowComponent` para "Mirar" (visible/oculto segÃºn `spectatableMatchId`, emite `spectate`) en `friend-row.component.spec.ts`.
- [X] T020 [US1] En `FriendsPageComponent` enlazar `spectatableMatch` a la fila y manejar `(spectate)` â†’ `router.navigate(['/spectate', matchId])` en `src/app/features/social/pages/friends-page/friends-page.component.{ts,html}` (+ spec).
- [X] T021 [US1] Agregar ruta `spectate/:matchId` (lazy, `authGuard`) â†’ `SpectateScreenComponent` en `src/app/app.routes.ts`.
- [X] T022 [US1] `SpectateScreenComponent` shell en `src/app/features/spectate/pages/spectate-screen/spectate-screen.component.{ts,html,scss}`: lee `matchId` del paramMap, `provide`/init `SpectateStateService`, estados loading/error (usa `spectateErrorCopy`), banner "EstÃ¡s mirando" + `spectatorCount`; `OnDestroy` â†’ `destroy()` (tokens CSS).
- [X] T023 [P] [US1] Test de `SpectateScreenComponent` (init con matchId, muestra loadingâ†’snapshot, error muestra copy del front) en `spectate-screen.component.spec.ts`.

**Checkpoint**: Se puede descubrir y entrar a mirar; se ve el snapshot inicial. (AÃºn sin render de tablero en vivo.)

---

## Phase 4: User Story 2 - Seguir el desarrollo en tiempo real (Priority: P1) ðŸŽ¯ MVP

**Goal**: Render del tablero en vivo, solo-lectura (sin manos ni acciones), con cantos, turno, reloj
y puntaje; hitos (fin de partida/game/envido) neutros e inline.

**Independent Test**: Como espectador, cada carta/canto de los jugadores aparece en <2s; nunca se ven
manos ni botones de acciÃ³n; al terminar la partida se muestra "GanÃ³ X" + CTA volver (sin modal de jugador).

### Implementation for User Story 2

- [X] T024 [US2] Agregar input `spectator: boolean` (default false) a `GameBoardComponent` que oculta `AvailableActionsPanelComponent` y rinde ambos asientos sin cartas en mano, en `src/app/features/match/components/game-board/game-board.component.{ts,html}` (D7).
- [X] T025 [P] [US2] Test de `GameBoardComponent` en modo `spectator` (no renderiza panel de acciones; no muestra manos) en `game-board.component.spec.ts`.
- [X] T026 [US2] En `SpectateScreenComponent`, derivar `MatchView` desde `adaptSpectateToMatchState` + `deriveMatchView` y renderizar `<app-game-board [spectator]="true">`; cablear temporizador de turno (reusar `turn-timer` utils + `serverClockOffsetMs`) en `spectate-screen.component.{ts,html}`.
- [X] T027 [US2] Mostrar burbujas de canto del espectador (truco/envido) reusando `callDisplayMapper`/`derive-pending-call`, hidratando desde el snapshot inicial, sin modales, en `spectate-screen.component.ts`.
- [X] T028 [US2] Hitos inline y neutros (FR-014): fin de partida (`MATCH_FINISHED/ABANDONED/FORFEITED`) â†’ estado "GanÃ³ X" + CTA "Volver a amigos"; fin de game (`GAME_SCORE_CHANGED`) y `ENVIDO_RESOLVED` â†’ indicador inline sin marco "ganaste/perdiste"; en `spectate-screen.component.{ts,html,scss}` (NO usar `GameWonDialog`/`EnvidoResultDialog`).
- [X] T029 [P] [US2] Test de hitos/solo-lectura en `spectate-screen.component.spec.ts` (carta/canto en vivo actualizan la vista; sin manos ni acciones; fin de partida muestra resultado neutro + CTA).

**Checkpoint**: MVP completo â€” descubrir, entrar, ver en vivo solo-lectura con hitos inline.

---

## Phase 5: User Story 3 - Robustez de la sesiÃ³n de espectador (Priority: P2)

**Goal**: ReconexiÃ³n automÃ¡tica, "Dejar de mirar", contexto Ãºnico, retorno cross-device y estado
busy con `busyReason = SPECTATING`.

**Independent Test**: Cortar/recuperar conexiÃ³n re-engancha la vista; abrir en otro dispositivo lleva
a `/spectate/:matchId`; mientras especta, el usuario estÃ¡ ocupado y los amigos ven "Mirando una partida".

### Implementation for User Story 3

- [X] T030 [US3] Re-alta en reconexiÃ³n en `SpectateStateService`: observar `WebSocketService.connected`; al reconectar, re-subscribe con header `matchId`, `loading=true`, limpiar buffers, esperar nuevo `SPECTATE_STATE` (research D5) en `src/app/features/spectate/services/spectate-state.service.ts` (+ caso en su spec).
- [X] T031 [US3] AcciÃ³n "Dejar de mirar" en `SpectateScreenComponent`: `destroy()` (UNSUBSCRIBE) + `router.navigate(['/friends'])`, botÃ³n en `spectate-screen.component.{ts,html,scss}` (+ caso en spec).
- [X] T032 [P] [US3] Agregar `PresenceSpectating { matchId }`, `spectating: PresenceSpectating | null` a `UserPresenceResponse`, variante `{ kind:'spectate'; matchId }` a `PresenceDestination` y rama en `derivePresenceDestination` (tras match/rematch) en `src/app/core/models/presence.models.ts` (Â§7.6, D10).
- [X] T033 [P] [US3] Test de `derivePresenceDestination` con `spectating` â†’ `{kind:'spectate'}` en `presence.models` (spec correspondiente / `presence.contract.spec.ts`).
- [X] T034 [US3] `PresenceCoordinatorService.targetUrl`: `case 'spectate' â†’ /spectate/${matchId}` en `src/app/core/services/presence-coordinator.service.ts` (+ caso en `presence-coordinator.service.spec.ts`) â€” habilita retorno cross-device (FR-017).
- [X] T035 [P] [US3] Agregar `'SPECTATING'` a `FriendBusyReason` en `src/app/core/models/social.models.ts` y `case 'SPECTATING' â†’ 'Mirando una partida'` en `busyReasonCopy` de `src/app/shared/error-copy/error-copy.ts` (D11; + caso en `error-copy.spec.ts`).
- [X] T036 [US3] Verificar/ajustar que `FriendRowComponent` muestra el motivo `SPECTATING` y no ofrece "Invitar" a un amigo `BUSY` por spectate (FR-018) en `friend-row.component.{ts,html}` (+ caso en spec).
- [X] T037 [US3] Manejo de `SPECTATE_ERROR` de "ya estÃ¡s mirando otra"/no elegible: mostrar copy del front y volver a `/friends`; reflejar busy (no ofrecer acciones de lobby mientras especta) usando `PresenceCoordinatorService.busy` donde aplique (FR-015/FR-016) en `spectate-screen.component.ts` / consumidores de lobby.

**Checkpoint**: SesiÃ³n robusta, cross-device y con estado de ocupaciÃ³n correctos.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T038 [P] Actualizar `docs/CONTRATOS_API.md` solo si la verificaciÃ³n runtime (T004/T008) detecta divergencia con Â§4.15/Â§9.6 (Constitution II: doc primero).
- [ ] T039 Ejecutar la verificaciÃ³n manual de `specs/026-spectate-friends/quickstart.md` (incluye busy y cross-device).
- [X] T040 Gates: `pnpm lint` Â· `pnpm lint:styles` Â· `pnpm test` (incluye `spectate.contract.spec.ts`) Â· `pnpm build`. Corregir lo que falle.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. BLOQUEA todas las user stories.
- **US1 (Phase 3)** y **US2 (Phase 4)**: dependen de Foundational. US2 depende de US1 solo porque
  comparten `SpectateScreenComponent` (US1 crea el shell, US2 le agrega el tablero). Juntas = MVP.
- **US3 (Phase 5)**: depende de Foundational; integra con US1 (friend-row/presence) y US2 (screen)
  pero es testeable por separado.
- **Polish (Phase 6)**: tras las stories deseadas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Sin dependencia de otras stories.
- **US2 (P1)**: tras Foundational; extiende el shell de US1.
- **US3 (P2)**: tras Foundational; capa de robustez sobre US1/US2.

### Within Each Story

- Tests acompaÃ±an a su unidad; modelos antes que servicios; servicios antes que componentes.

### Parallel Opportunities

- Foundational: T003, T004, T005, T006, T007, T009, T010, T011 son [P] (archivos distintos). T002 antes de T003; T012 tras T004/T005/T009/T010.
- US1: T014, T015 [P]; T019, T023 [P]. T016/T017 tras T014/T015. T022 tras T021.
- US2: T025 [P], T029 [P]; T026â€“T028 secuenciales (mismo componente).
- US3: T032, T033, T035 [P]; T030/T031 tocan el mismo servicio/componente que US2.

---

## Implementation Strategy

### MVP First (US1 + US2 â€” ambas P1)

1. Phase 1: Setup.
2. Phase 2: Foundational (CRÃTICO â€” bloquea todo).
3. Phase 3 (US1) + Phase 4 (US2): descubrir, entrar y ver en vivo solo-lectura.
4. **STOP y VALIDAR**: pasos 1â€“9 del quickstart.
5. Demo del MVP.

### Incremental Delivery

1. Setup + Foundational â†’ base lista.
2. US1 + US2 â†’ MVP (mirar en vivo) â†’ demo.
3. US3 â†’ robustez (reconexiÃ³n, cross-device, busy) â†’ demo.

---

## Notes

- [P] = archivos distintos, sin dependencias.
- Solo-lectura es invariante de seguridad (SC-003): ningÃºn path debe exponer `myCards`/acciones.
- Verificar contrato antes de tipar (D1 resuelto: roster + `gamesToPlay` en Â§4.15).
- Commit por tarea o grupo lÃ³gico; correr gates antes del PR.
