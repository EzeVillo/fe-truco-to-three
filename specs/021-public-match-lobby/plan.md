# Implementation Plan: Lobby público de matches

**Branch**: `021-public-match-lobby` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-public-match-lobby/spec.md`

## Summary

Sumar un **lobby público de matches** dentro del flujo existente "Jugar online": listar las partidas
públicas abiertas (bootstrap REST `GET /api/matches/public` + reconciliación con deltas WS del topic
`/topic/public-match-lobby`), permitir unirse a cualquiera (reusando `POST /api/join/{joinCode}`, con
autostart del backend), y permitir crear partidas con visibilidad **Pública/Privada**
(`POST /api/matches`). El mecanismo de reconciliación (snapshot + deltas) se implementa como un
**motor genérico reutilizable** (`PublicLobbyStore<T>`) para que copas y ligas públicas lo reusen sin
reescribir la lógica delicada. Ante una race condition al unirse (partida llena/cerrada justo antes),
se muestra un **toast no bloqueante** (`MatSnackBar`) sin forzar refresco; la partida desaparece sola
con el delta en tiempo real.

## Technical Context

**Language/Version**: TypeScript 5.x / Angular 21 (componentes standalone, signals)

**Primary Dependencies**: Angular Material (`MatSnackBar` para el toast, ya con
`provideAnimationsAsync()`), `@stomp/stompjs` + SockJS vía `WebSocketService`, RxJS, NgRx Signals
(patrón existente). No se agregan dependencias nuevas.

**Storage**: N/A (estado en memoria con signals; nada persistido salvo el flujo existente de `joinCode`).

**Testing**: Vitest — unit tests del motor genérico y del store de matches; contract test que verifica
paridad de los DTOs nuevos contra `docs/CONTRATOS_API.md §1.5/§4.3/§4.4/§9.4`.

**Target Platform**: Web (mobile portrait 360 px+ y desktop 1024 px+).

**Project Type**: Web frontend (Angular SPA) — single project bajo `src/app/`.

**Performance Goals**: Lista inicial visible (o estado vacío) < 2 s (SC-002); deltas reflejados < 3 s
(SC-003), limitado por la latencia del topic STOMP.

**Constraints**: Mobile floor 360 px, único breakpoint `@media (min-width: 1024px)`; tokens
`var(--t3-…)` obligatorios en SCSS; CTAs tematizados (`t3-btn`); copy de error vía `getErrorCopy()`,
nunca `ApiError.message` crudo; `:hover` gateado tras `@media (hover: hover)`.

**Scale/Scope**: 1 motor genérico + 1 store de matches + 1 servicio REST extendido + ~3 componentes UI
(lista, card, toggle de visibilidad) integrados en `online-match-page`. Alcance = solo matches.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: Todo SCSS nuevo (lista, card, toggle, panel) usará `var(--t3-…)`. Verificable con `pnpm lint:styles`. Sin colores hardcodeados.
> - [x] **Validación de contrato**: Los DTOs `PublicMatchLobbyItem`, `PublicMatchesPage` y los eventos `PublicMatchLobby{Upsert,Removed}` se tipan campo a campo contra `docs/CONTRATOS_API.md §4.3` y §9.4. Se agrega contract test. `gamesToPlay` se mapea con `seriesFormatToGamesToPlay` (1/3/5).
> - [x] **CTAs verticales**: No se introducen CTAs título+descripción nuevos con `mat-flat-button`. El toggle de visibilidad y los botones de unirse usan variantes `t3-btn`. El CTA de crear ya existe.
> - [x] **Copy de errores**: Carga de lista, creación y unión usan `getErrorCopy()`. El 409 de race condition ya está cubierto por el scope `JOIN_MATCH` ("La partida se llenó justo antes de que entraras."). Se agrega scope `PUBLIC_LOBBY` solo si la carga de lista necesita copy propio.
> - [x] **Reglas de juego**: Series mejor de 1/3/5; `gamesToPlay ∈ {1,3,5}`. El selector de serie reusa `SeriesFormatSelectorComponent`.

**Resultado**: PASS. No hay violaciones; no se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/021-public-match-lobby/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — decisiones (motor genérico, reconcile, toast, ubicación)
├── data-model.md        # Phase 1 — entidades y DTOs
├── quickstart.md        # Phase 1 — cómo probar la feature
├── contracts/
│   └── public-match-lobby.md   # Contrato FE: REST + WS consumidos
├── checklists/
│   └── requirements.md  # Checklist de calidad del spec (ya existe)
└── tasks.md             # Phase 2 — /speckit-tasks (NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src/app/
├── shared/
│   └── public-lobby/                       # NUEVO — motor genérico reutilizable
│       ├── public-lobby-store.ts           # createPublicLobby<T>() / PublicLobbyStore<T>
│       ├── public-lobby-store.spec.ts      # tests de reconciliación (snapshot + deltas, orden, dedup)
│       └── public-lobby.types.ts           # tipos genéricos (PublicLobbyDelta<T>, config)
├── core/models/
│   └── match.models.ts                     # EXTENDER — DTOs públicos + generalizar createMatch
├── shared/error-copy/
│   └── error-copy.ts                        # EXTENDER si hace falta scope 'PUBLIC_LOBBY' (carga lista)
└── features/lobby/
    ├── models/
    │   └── public-match-lobby.models.ts    # NUEVO — PublicMatchLobbyItem + eventos WS del topic
    ├── services/
    │   ├── matches-api.service.ts          # EXTENDER — listPublicMatches() + createMatch() genérico
    │   ├── public-match-lobby.store.ts     # NUEVO — instancia el motor genérico para matches
    │   └── public-match-lobby.store.spec.ts
    ├── components/
    │   ├── public-match-list/              # NUEVO — lista + estados vacío/carga/error + "cargar más"
    │   ├── public-match-card/              # NUEVO — card de una partida + acción "Unirse"
    │   └── visibility-selector/            # NUEVO — toggle Pública/Privada (estilo SeriesFormatSelector)
    └── pages/online-match-page/            # EXTENDER — orquesta lista + toggle + toast (MatSnackBar)
```

**Structure Decision**: Single project Angular bajo `src/app/`. El **motor genérico** vive en
`src/app/shared/public-lobby/` (reusable por features distintas: matches ahora, copas/ligas a futuro,
FR-015). La **vista** es específica de matches y vive en `features/lobby/` integrada en la página
`online-match-page` existente, sin agregar un modo nuevo en la pantalla de modos. Se generaliza el
método `createPrivateMatch` → `createMatch` (ya recibe `visibility`) para soportar `PUBLIC`.

## Complexity Tracking

No aplica — la Constitution Check pasa sin violaciones.
