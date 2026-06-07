# Implementation Plan: Espectar partidas de amigos

**Branch**: `026-spectate-friends` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/026-spectate-friends/spec.md`

## Summary

Permitir que un usuario mire en vivo, en modo solo-lectura, la partida en curso de un amigo
confirmado. El descubrimiento del match ya viene resuelto por el contrato (`spectatableMatch.id` en
la lista de amigos); el alta como espectador es WebSocket-first (suscripción a
`/user/queue/match-spectate` con header nativo `matchId`), y la vista pública reusa el tablero de
partida existente sin manos ni acciones. El trabajo es íntegramente frontend.

Enfoque técnico: (1) extender `WebSocketService.subscribe` para soportar headers nativos en el
`SUBSCRIBE`; (2) tipar la vista pública de spectate y sus eventos contra el contrato; (3) un
`SpectateStateService` análogo a `MatchStateService` que registra/reconcilia el estado de
espectador y re-alta en reconexión; (4) reusar `GameBoardComponent` con un modo espectador que
oculta el panel de acciones; (5) exponer `spectatableMatch` en el modelo social y un botón "Mirar"
en `friend-row`; (6) integrar la presencia: agregar `spectating` a `UserPresenceResponse` y la rama
`spectate` en `derivePresenceDestination`/`PresenceCoordinatorService` para el retorno cross-device y
el estado `busy`; (7) agregar `SPECTATING` a `FriendBusyReason` + `busyReasonCopy`. Todo es
frontend: el contrato ya soporta presencia de spectate, busy y multi-dispositivo (clarificación
2026-06-06).

## Technical Context

**Language/Version**: TypeScript 5.x, Angular 18+ (componentes standalone, signals)

**Primary Dependencies**: Angular, `@ngrx/signals` (signalStore), `@stomp/stompjs` (WebSocket/STOMP),
Angular Material (diálogos), RxJS.

**Storage**: N/A (estado en memoria vía signals; no persiste nada de spectate)

**Testing**: Vitest/Jasmine + Angular TestBed (`pnpm test`), contract tests en `src/tests/contract/`

**Target Platform**: Web (mobile portrait 360–599px y desktop 1024px+)

**Project Type**: SPA Angular (single project bajo `src/`)

**Performance Goals**: Propagación de eventos del juego a la vista del espectador < 2 s (SC-002);
re-alta tras reconexión sin acción manual (SC-004).

**Constraints**: Solo-lectura (0% fuga de cartas ocultas, SC-003); nunca exponer `ApiError.message`
ni el `error` crudo del WS (catálogo de copy del front); tokens CSS obligatorios en SCSS de feature;
un solo breakpoint `@media (min-width: 1024px)`.

**Scale/Scope**: 1 pantalla nueva (espectador), 1 servicio de estado, ~2 modelos nuevos, toques a
social (modelo + store + api + 2 componentes) y a core (websocket.service + 1 modelo). Sin cambios
de backend.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: El SCSS de la pantalla de espectador y del botón "Mirar" usará
>   exclusivamente `var(--t3-…)`. Verificable con `pnpm lint:styles`. No se introducen colores
>   literales.
> - [x] **Validación de contrato**: La vista de spectate (§4.15), los eventos (§9.5g/§9.6) y
>   `spectatableMatch` (§7.4.5) se tipan campo a campo contra `docs/CONTRATOS_API.md`. Se agrega
>   `src/tests/contract/spectate.contract.spec.ts` que verifica paridad por `satisfies`. **D1
>   resuelto** (clarificación 2026-06-06): §4.15 ya incluye el roster (`playerOneUsername`,
>   `playerTwoUsername` nullable) y `gamesToPlay`; se tipan directo sin fallback.
> - [x] **CTAs verticales**: El botón "Mirar" es una acción simple (no un CTA con título+subtítulo
>   apilados), por lo que la regla de CTAs apilados no aplica; igual respeta la paleta de tokens.
> - [x] **Copy de errores**: `SPECTATE_ERROR` (WS) y los errores REST de `/spectate` se mapean a
>   copy del front; nunca se muestra el `error`/`message` crudo del backend. Se agrega el scope
>   `SPECTATE` a `getErrorCopy()` + un mapper dedicado para el string del WS.
> - [x] **Reglas de juego**: Feature de solo-lectura; no toca puntajes ni series (1/3/5). Sin
>   impacto en reglas.

**Resultado**: PASS. Sin violaciones que justificar (la sección Complexity Tracking queda vacía).

## Project Structure

### Documentation (this feature)

```text
specs/026-spectate-friends/
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Fase 0 (/speckit-plan)
├── data-model.md        # Fase 1 (/speckit-plan)
├── quickstart.md        # Fase 1 (/speckit-plan)
├── contracts/
│   └── spectate.md      # Fase 1 (/speckit-plan)
├── checklists/
│   └── requirements.md  # de /speckit-specify
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src/app/
├── core/
│   ├── models/
│   │   ├── spectate.models.ts        # NUEVO: SpectateMatchState, SpectateRoundState, SpectatableMatch
│   │   ├── ws.models.ts              # EDIT: SpectateWsEvent; spectatableMatch en availability items
│   │   ├── social.models.ts          # EDIT: FriendSummary.spectatableMatch + FriendBusyReason 'SPECTATING'
│   │   └── presence.models.ts        # EDIT: PresenceSpectating; UserPresenceResponse.spectating; rama 'spectate'
│   └── services/
│       ├── websocket.service.ts      # EDIT: subscribe(destination, headers?) con headers nativos
│       └── presence-coordinator.service.ts # EDIT: targetUrl case 'spectate' → /spectate/:matchId
├── features/
│   ├── spectate/                     # NUEVO módulo de feature
│   │   ├── pages/spectate-screen/    # SpectateScreenComponent (reusa GameBoard en modo lectura)
│   │   ├── services/
│   │   │   ├── spectate-state.service.ts        # alta/reconciliación/re-alta + adapter a MatchView
│   │   │   └── spectate-api.service.ts          # GET /api/matches/{id}/spectate (refresh)
│   │   └── utils/
│   │       └── adapt-spectate-to-match-view.ts  # SpectateMatchState → MatchState/MatchView
│   ├── match/
│   │   └── components/game-board/    # EDIT: input `spectator` que oculta el panel de acciones
│   └── social/
│       ├── components/friend-row/    # EDIT: input spectatableMatchId + output spectate + botón "Mirar"
│       ├── pages/friends-page/       # EDIT: bind spectatableMatch + handler navega a /spectate/:id
│       ├── services/social.store.ts  # EDIT: merge/upsert conserva spectatableMatch
│       └── services/social-api.service.ts # EDIT: mapear spectatableMatch en listFriends
├── shared/error-copy/error-copy.ts   # EDIT: scope 'SPECTATE' + spectateErrorCopy() + busyReasonCopy 'SPECTATING'
└── app.routes.ts                     # EDIT: ruta 'spectate/:matchId' (lazy, authGuard)

src/tests/contract/
└── spectate.contract.spec.ts         # NUEVO: paridad §4.15 + §7.4.5 spectatableMatch
```

**Structure Decision**: Proyecto único Angular. La feature vive en un nuevo `features/spectate/`
siguiendo el patrón de `features/match` (servicio de estado + pantalla + utils). El descubrimiento y
el punto de entrada se integran en `features/social` (ya dueño de la lista de amigos y su presencia).
La extensión de WS y los modelos compartidos van en `core/`. La reutilización del tablero se logra
con un input mínimo en `GameBoardComponent` en vez de duplicar el árbol de componentes del tablero.

## Complexity Tracking

> Sin violaciones de la Constitution. Sección no aplicable.
