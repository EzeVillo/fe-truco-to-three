# Implementation Plan: Acciones de match contra el backend (REST)

**Branch**: `007-match-rest-actions` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-match-rest-actions/spec.md`

## Summary

Cablear las acciones de la pantalla de match (truco, envido + submenú, responder truco, responder envido, fold, jugar carta) a sus endpoints REST del backend definidos en `docs/CONTRATOS_API.md §4.6 – §4.11`, manteniendo el mock actual como única fuente de verdad para la UI. Las invocaciones son fire-and-forget: cualquier error 4xx/5xx/timeout se silencia (sólo log en consola). Además, al crear partida vs bot la app navega a `/match/:matchId` consumiendo el endpoint REST de bot match que ya existe (`POST /api/matches/bot`). No se introduce ninguna conexión WebSocket en esta iteración: el feedback visual de cartas yendo a la mesa, cambios de turno y marcador sigue derivándose del mock y se conectará a WS en una iteración posterior.

## Technical Context

**Language/Version**: TypeScript 5.x + Angular 21 (standalone components)

**Primary Dependencies**: Angular HttpClient (con `jwtInterceptor` existente), RxJS, NgRx Signals (sólo `AuthStore`), Angular Router

**Storage**: N/A (esta feature no persiste estado en cliente más allá de la URL `/match/:matchId`)

**Testing**: Vitest (unit + contract tests bajo `src/tests/contract/`)

**Target Platform**: Web (Angular SPA, mobile 360 px+ / desktop 1024 px+)

**Project Type**: Frontend SPA (single project)

**Performance Goals**: Click → request disparada en menos de 50 ms. Navegación post-creación bot match ≤ 2 s en red local (SC-002).

**Constraints**:
- Cero mensajes de error visibles al usuario (FR-010, SC-003).
- Debounce / disable temporal para evitar dobles disparos (FR-015, SC-005).
- No abrir ningún WebSocket en el flujo de match (FR-016, SC-006).
- Mock sigue siendo única fuente de verdad para qué acciones están disponibles (FR-011).
- Enums case-sensitive según `docs/CONTRATOS_API.md §8.1`.

**Scale/Scope**: 1 pantalla afectada (`match-screen`), ~6 acciones REST nuevas + 1 navegación, ~3 componentes UI tocados (`available-actions-panel`, `envido-submenu`, `player-hand`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: Esta feature no introduce SCSS nuevo de color/espaciado. Si algún botón/submenú agrega estilos, usar `var(--t3-…)`. Se verifica con `pnpm lint:styles`.
> - [x] **Validación de contrato**: Los DTOs de cada acción (`PlayCardRequest`, `CallEnvidoRequest`, `RespondTrucoRequest`, `RespondEnvidoRequest`) se tipan en `src/app/core/models/match.models.ts` con los enums ya definidos en `enums.ts` y se cubren con contract tests bajo `src/tests/contract/` que verifican paridad con `docs/CONTRATOS_API.md §4.6 – §4.11` y §8.1.
> - [x] **CTAs verticales**: No aplica — esta feature no introduce CTAs nuevos con título+descripción; los botones de acciones del match ya existen y respetan la convención.
> - [x] **Copy de errores**: No aplica directamente — la feature manda 0 copy de error a la UI (los errores se silencian, FR-010). Cuando se agregue manejo visible de errores en una feature posterior, deberá pasar por `getErrorCopy()`.
> - [x] **Reglas de juego**: Series mejor de 1/3/5, `gamesToPlay ∈ {1,3,5}`. Esta feature no modifica scoring; sólo agrega navegación con el `matchId` devuelto por el endpoint ya en producción.

**Resultado del gate**: PASS. No hay violaciones que justificar; no se llena Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-match-rest-actions/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (snapshots de §4.6 – §4.11 del contrato)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (lo genera /speckit-tasks)
```

### Source Code (repository root)

```text
src/app/
├── core/
│   ├── interceptors/jwt.interceptor.ts          # ya existe, no se toca
│   └── models/
│       ├── enums.ts                              # contiene Suit, AvailableActionType, etc. (ya existe)
│       └── match.models.ts                       # extender con DTOs de acción (PlayCardRequest, CallEnvidoRequest, ...)
├── features/
│   ├── lobby/
│   │   ├── pages/bots-config-page/               # ya crea bot match; se agrega navegación tras éxito
│   │   └── services/bots-api.service.ts          # ya tiene createBotMatch() — sin cambios
│   └── match/
│       ├── pages/match-screen/                    # lee matchId desde route param
│       ├── services/
│       │   └── match-actions.service.ts          # NUEVO: 6 métodos REST fire-and-forget + log silencioso
│       ├── components/
│       │   ├── available-actions-panel/
│       │   │   ├── available-actions-panel.component.ts        # cablea CALL_TRUCO / FOLD / abre submenú envido
│       │   │   ├── envido-submenu/                              # dispara CALL_ENVIDO con la variante elegida
│       │   │   ├── truco-response-panel/                        # dispara RESPOND_TRUCO
│       │   │   └── envido-response-panel/                       # dispara RESPOND_ENVIDO
│       │   └── player-hand/player-hand.component.ts             # click en carta → playCard, sin mover la carta visualmente
│       ├── mocks/                                # se mantiene como fuente de verdad para UI
│       └── utils/derive-match-view.ts            # se mantiene
├── app.routes.ts                                  # ruta 'match' se cambia a 'match/:matchId'

src/tests/
├── contract/
│   ├── match-actions.contract.spec.ts            # NUEVO: cubre §4.6 – §4.11 y §8.1
│   └── create-bot-match.contract.spec.ts         # ya existe
└── (unit tests co-ubicados con cada servicio/componente)
```

**Structure Decision**: Single-project Angular SPA. Se elige no introducir un store global de match (NgRx Signals/Store) en esta iteración, ya que el estado sigue viviendo en el mock; el `MatchActionsService` es un servicio fino sin estado interno. Se introduce una ruta parametrizada (`match/:matchId`) para que el `matchId` viaje por URL como contexto único.

## Complexity Tracking

> No aplica — el gate de Constitution Check pasa sin violaciones.
