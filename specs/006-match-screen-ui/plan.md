# Implementation Plan: Match Screen — UI base con datos mock

**Branch**: `006-match-screen-ui` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification en `specs/006-match-screen-ui/spec.md`

## Summary

Construir la pantalla base de partida (`/match` o `/match/:matchId`) de Truco a 3 con datos
**100% mock locales**, sin HTTP ni WebSocket. La UI replica la composición de
`public/referencias/match.png` (rival arriba, mesa central, mano abajo, cabecera con marcador
y formato de serie, placeholder lateral/inferior para acciones disponibles).

El mock tiene la forma exacta de `MatchStateResponse` documentado en
`docs/CONTRATOS_API.md §4.14` — incluyendo los campos nuevos `viewerSeat`,
`playerOneUsername`, `playerTwoUsername`, `gamesToPlay` — y se expone como un set de fixtures
named (`mockMatchViewerPlayerOne`, `mockMatchViewerPlayerTwo`, `mockMatchEmptyTable`,
`mockMatchAsymmetricHand`). El fixture activo se selecciona por query param
(`?fixture=viewer-player-two`), con `mockMatchViewerPlayerOne` por defecto.

La pantalla es **viewer-relative**: el jugador autenticado se renderiza SIEMPRE abajo y el
rival SIEMPRE arriba, sin importar si `viewerSeat` es `PLAYER_ONE` o `PLAYER_TWO` (FR-018).

El layout y los CTAs/colores usan exclusivamente design tokens `var(--t3-…)`. Toda la
estructura de componentes queda preparada para que la siguiente iteración sólo reemplace la
fuente de datos por REST + WebSocket y rellene el `PlaceholderAvailableActionsArea`.

## Technical Context

**Language/Version**: TypeScript 5.x, Angular 21 (componentes standalone, sin NgModules)

**Primary Dependencies**: Angular Router, Angular Common, Angular Material (sólo lo ya
existente), NgRx Signals (sólo `AuthStore` ya existente — no se crea store nuevo en esta
feature). No se introducen dependencias nuevas.

**Storage**: N/A — datos en memoria desde un módulo TS de fixtures. `localStorage` no se
toca.

**Testing**: Vitest. Tests unitarios para:
- `deriveMatchView()` — función pura que mapea `MatchStateResponse` + `viewerSeat` a la
  vista viewer-relative.
- `deriveStatusText()` — función pura que arma "Tu turno" / "Turno del rival" / "Mano N
  de 3" a partir de `currentTurn`, `roundStatus`, `playedHands.length`, `viewerSeat`,
  `playerOneUsername`, `playerTwoUsername`.
- `CardView` — render correcto en modo visible vs `dorso.png`.
- `MatchScreen` — selección de fixture por query param y fallback al default.

**Target Platform**: Browser — mobile portrait (mínimo 360 px) y desktop (≥ 1024 px). Único
breakpoint `@media (min-width: 1024px)`. No landscape mobile.

**Project Type**: Single-project frontend (Angular SPA) — la estructura `src/app/features/`
ya existe; se agrega un módulo de feature `match/`.

**Performance Goals**: First render < 1 s en mobile estándar (SC-002), sin parpadeos ni
layout shift. Las 9 cartas máx. en pantalla son imágenes estáticas servidas desde
`public/cards/` (cache HTTP normal).

**Constraints**:
- Sin HTTP, sin WebSocket en esta etapa (FR-011).
- Sin lógica de reglas del Truco (FR-012).
- Sólo `var(--t3-…)` en SCSS de feature; cero hex / `rgb()` / Material crudo
  (FR-014, constitution I + III).
- Mobile floor 360 px sin scroll horizontal y zonas principales visibles sin scroll
  vertical en mobile (FR-002, FR-017, SC-003).
- Componentes standalone (constitution).

**Scale/Scope**: 1 ruta nueva (`/match` con `:matchId?` opcional), 9 componentes nuevos
standalone (`MatchScreen` + 8 children), 1 módulo de fixtures con 4 fixtures named, 2
funciones puras (`deriveMatchView`, `deriveStatusText`). Estimado total: ~400–600 LOC
producción + ~200 LOC tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: Todo color/espaciado/radio/sombra en SCSS de feature usa `var(--t3-…)`.
>   Verificación: `pnpm lint:styles` cubre `src/app/features/match/**/*.scss` por glob
>   existente. Si falta algún token nuevo (ej. `--t3-table-felt`, `--t3-card-slot-border`),
>   se agrega en `src/styles.scss` ANTES de consumirlo. Sin excepciones.
> - [x] **Validación de contrato**: El mock se tipa contra `MatchStateResponse` (ver
>   `data-model.md`) y refleja 1:1 los campos del §4.14 del contrato, incluidos los
>   agregados en este ciclo (`viewerSeat`, `playerOneUsername`, `playerTwoUsername`,
>   `gamesToPlay`). Se agrega `src/tests/contract/match-state-shape.contract.spec.ts` que
>   valida con `satisfies` la paridad estructural del mock con el tipo.
> - [x] **CTAs verticales**: No aplica directamente — esta feature no introduce nuevos CTAs
>   con título + descripción. El placeholder de acciones no renderiza botones funcionales.
>   Si en la cabecera se incluye un CTA "Volver al lobby", debe usar `t3-btn t3-btn--neutral`
>   (no `mat-flat-button`).
> - [x] **Copy de errores**: No aplica — no hay paths de error en esta etapa (sin HTTP/WS).
>   Si la ruta recibe `?fixture=` inválido, se hace fallback silencioso al default sin
>   mostrar mensaje de error al usuario.
> - [x] **Reglas de juego**: `gamesToPlay` se trata como literal `1 | 3 | 5` (partidas
>   totales de la serie). El score por partida se renderiza en escala 0–3 (regla del
>   producto: pasarse de 3 pierde). No se calcula puntaje en esta feature; sólo se
>   visualiza.

**Resultado del Constitution Check**: ✅ Sin violaciones. Sin entrada en *Complexity
Tracking*. Re-evaluación post Phase 1 al final del documento.

## Project Structure

### Documentation (this feature)

```text
specs/006-match-screen-ui/
├── plan.md              # Este archivo
├── spec.md              # Spec aprobada
├── research.md          # Phase 0 — decisiones técnicas y rationale
├── data-model.md        # Phase 1 — tipos y forma del mock
├── quickstart.md        # Phase 1 — cómo correr y validar la feature en navegador
└── contracts/
    └── match-state.contract.md  # Phase 1 — copia anotada de §4.14 + extensiones
```

> `tasks.md` lo genera `/speckit-tasks` en una corrida posterior; no se crea acá.

### Source Code (repository root)

Estructura nueva que introduce la feature dentro del árbol `src/app/` existente. Sólo se
listan los archivos nuevos o tocados:

```text
src/
├── app/
│   ├── app.routes.ts                                    # MODIFICADO: agregar ruta /match
│   ├── features/
│   │   └── match/                                       # NUEVO — toda la feature acá
│   │       ├── pages/
│   │       │   └── match-screen/
│   │       │       ├── match-screen.component.ts
│   │       │       ├── match-screen.component.html
│   │       │       ├── match-screen.component.scss
│   │       │       └── match-screen.component.spec.ts
│   │       ├── components/
│   │       │   ├── game-board/
│   │       │   │   ├── game-board.component.ts
│   │       │   │   ├── game-board.component.html
│   │       │   │   └── game-board.component.scss
│   │       │   ├── opponent-area/
│   │       │   │   ├── opponent-area.component.ts
│   │       │   │   ├── opponent-area.component.html
│   │       │   │   └── opponent-area.component.scss
│   │       │   ├── player-area/
│   │       │   │   ├── player-area.component.ts
│   │       │   │   ├── player-area.component.html
│   │       │   │   └── player-area.component.scss
│   │       │   ├── played-cards-area/
│   │       │   │   ├── played-cards-area.component.ts
│   │       │   │   ├── played-cards-area.component.html
│   │       │   │   └── played-cards-area.component.scss
│   │       │   ├── player-hand/
│   │       │   │   ├── player-hand.component.ts
│   │       │   │   ├── player-hand.component.html
│   │       │   │   └── player-hand.component.scss
│   │       │   ├── match-status-panel/
│   │       │   │   ├── match-status-panel.component.ts
│   │       │   │   ├── match-status-panel.component.html
│   │       │   │   └── match-status-panel.component.scss
│   │       │   ├── card-view/
│   │       │   │   ├── card-view.component.ts
│   │       │   │   ├── card-view.component.html
│   │       │   │   ├── card-view.component.scss
│   │       │   │   └── card-view.component.spec.ts
│   │       │   └── placeholder-available-actions-area/
│   │       │       ├── placeholder-available-actions-area.component.ts
│   │       │       ├── placeholder-available-actions-area.component.html
│   │       │       └── placeholder-available-actions-area.component.scss
│   │       ├── mocks/
│   │       │   ├── match-state.mocks.ts                 # Fixtures named
│   │       │   ├── match-state.mocks.spec.ts            # Sanidad de fixtures
│   │       │   └── index.ts                             # Barrel + lookup por query param
│   │       └── utils/
│   │           ├── derive-match-view.ts                 # Función pura viewer-relative
│   │           ├── derive-match-view.spec.ts
│   │           ├── derive-status-text.ts                # Función pura status
│   │           └── derive-status-text.spec.ts
│   └── core/
│       └── models/
│           └── match.models.ts                          # MODIFICADO: extender MatchState
└── tests/
    └── contract/
        └── match-state-shape.contract.spec.ts          # NUEVO: paridad mock ↔ contrato
```

**Structure Decision**: Single-project Angular SPA. La feature vive bajo
`src/app/features/match/` siguiendo el patrón de `lobby/` (pages + components + services
locales). Se reutilizan tipos `Card`, `PlayedHand`, `CurrentHand`, `RoundState` ya
existentes en `core/models/match.models.ts` y se extiende `MatchState` para agregar los
4 campos nuevos (`viewerSeat`, `playerOneUsername`, `playerTwoUsername`, `gamesToPlay`)
documentados en el contrato §4.14. Esto deja al cliente listo para que cuando el BE
implemente el endpoint, el reemplazo del data source sea sólo cambiar el provider del mock
por un `HttpClient.get<MatchState>(...)`.

## Complexity Tracking

*Sin violaciones del Constitution Check — tabla vacía.*

---

## Phase 0 — Outline & Research

> Output: [`research.md`](./research.md). Resumen de decisiones:
>
> - **Mecanismo de selección de fixture** → query param de la ruta (no servicio inyectable
>   con DI), porque alcanza con que el evaluador cambie la URL y no necesitamos test
>   harness extra.
> - **Asociar el mock a una `Observable` vs valor síncrono** → valor síncrono envuelto en
>   `signal()` para mantener la API de los componentes alineada con cómo lucirá la
>   integración futura (`toSignal(http$)`).
> - **Reutilizar `MatchState` existente vs nuevo tipo local** → extender `MatchState`
>   in-place con los 4 campos nuevos; sin renombres ni alias.
> - **Cómo derivar "yo / rival"** → función pura `deriveMatchView(state)` que toma
>   `MatchStateResponse` y devuelve `{ self: SeatView, opponent: SeatView }` con todo
>   resuelto (username, score, gamesWon, cartas en mano, cartas jugadas en la mano actual,
>   cartas jugadas en `playedHands`). Los componentes consumen `self`/`opponent` sin
>   conocer la noción de `PLAYER_ONE`/`PLAYER_TWO`.

## Phase 1 — Design & Contracts

> Outputs:
>
> - [`data-model.md`](./data-model.md) — tipos extendidos, forma del mock, contrato de las
>   funciones puras.
> - [`contracts/match-state.contract.md`](./contracts/match-state.contract.md) — anclaje
>   con `docs/CONTRATOS_API.md §4.14` y los 4 campos agregados.
> - [`quickstart.md`](./quickstart.md) — cómo correr `pnpm start`, navegar a `/match`,
>   probar los fixtures por query param, y qué chequea cada uno.
> - **Agent context update**: `CLAUDE.md` apunta a este plan entre los marcadores
>   `<!-- SPECKIT START -->` y `<!-- SPECKIT END -->`.

### Re-evaluación del Constitution Check post-design

Después de definir tipos y artefactos:

- Tokens CSS: el diseño introduce conceptos nuevos (paño de mesa, slot vacío de carta,
  borde de carta dada vuelta). Si los tokens existentes no cubren el verde profundo de la
  mesa o el borde dorado punteado de los slots, se agregan en `src/styles.scss` —
  candidatos: `--t3-table-felt` (verde más oscuro que `--t3-green-900`),
  `--t3-card-slot-border` (dorado tenue punteado), `--t3-card-shadow` (sombra de carta
  jugada sobre la mesa). Sigue pasando `pnpm lint:styles`.
- Contrato: el mock se ata por tipo a `MatchState` extendido. El test
  `match-state-shape.contract.spec.ts` mantiene paridad sin acoplarse al texto del doc.
- Sin nuevas violaciones. ✅

## Reporte

- **Branch**: `006-match-screen-ui`
- **Plan**: `specs/006-match-screen-ui/plan.md` (este archivo)
- **Artefactos generados en Phase 0/1**:
  - `specs/006-match-screen-ui/research.md`
  - `specs/006-match-screen-ui/data-model.md`
  - `specs/006-match-screen-ui/contracts/match-state.contract.md`
  - `specs/006-match-screen-ui/quickstart.md`
- **Próximo paso**: ejecutar `/speckit-tasks` para generar `tasks.md` dependency-ordered.
