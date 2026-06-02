# Implementation Plan: Quick Match

**Branch**: `020-quick-match` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-quick-match/spec.md`

## Summary

Agregar el modo **Partida rápida** al lobby siguiendo la UI existente: CTA vertical en el hub de
modos, pantalla de configuración con selector de serie, estado de búsqueda/cancelación y navegación
automática al match cuando el emparejamiento queda `MATCHED` o llega `GAME_STARTED` por WebSocket.

Enfoque técnico: extender la feature `lobby` con una nueva página standalone
`QuickMatchPageComponent`, sumar DTOs tipados en `match.models.ts`, agregar métodos
`enterQuickMatch()`/`cancelQuickMatch()` a `MatchesApiService`, reutilizar
`SeriesFormatSelectorComponent`, `WebSocketService` y `getErrorCopy()`. La pantalla se mantiene fina:
orquesta señales, REST, suscripción a `/user/queue/match` y navegación a `/match/:matchId`. Se agrega
test de contrato contra `docs/CONTRATOS_API.md §9.3` para evitar divergencias.

## Technical Context

**Language/Version**: TypeScript 5.9 / Angular 21 (componentes standalone)

**Primary Dependencies**: Angular Router, Angular Material (`MatProgressSpinnerModule`), RxJS,
`@stomp/stompjs` vía `WebSocketService`, NgRx Signals para auth existente

**Storage**: N/A; estado efímero de búsqueda en el componente. El backend mantiene la cola.

**Testing**: Vitest + Angular TestBed + contract tests en `src/tests/contract/`

**Target Platform**: SPA web en navegador; mobile-first 360 px y desktop 1024 px+

**Project Type**: Aplicación web frontend Angular standalone

**Performance Goals**: CTA y pantalla inicial renderizan sin espera perceptible; transición a match
en menos de 1 segundo tras recibir `MATCHED`/`GAME_STARTED`; sin scroll necesario para cancelar en
360 x 780.

**Constraints**: DDD estricto; no NgModules; pnpm; SCSS con tokens `var(--t3-...)`; CTAs tematizados
sin `mat-flat-button`/`mat-raised-button`; `:hover` gateado; errores con copy controlado; no mostrar
`ApiError.message`; `gamesToPlay` solo `{1,3,5}` como partidas totales de la serie.

**Scale/Scope**: 1 ruta nueva, 1 página, 2 métodos REST, 2 DTOs request/response, 1 scope de errores,
1 contract test, tests de componente y servicio.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: La nueva pantalla vive bajo `src/app/features/lobby/**`; todo color,
>   espaciado, radio y sombra se consumirá con `var(--t3-...)`. Verificable con
>   `pnpm lint:styles`.
> - [x] **Validación de contrato**: `QuickMatchRequest` y `QuickMatchResponse` se validan campo a
>   campo contra `docs/CONTRATOS_API.md §9.3`; `gamesToPlay` se trata como partidas totales `{1,3,5}`
>   por la regla documentada del proyecto.
> - [x] **CTAs verticales**: El CTA nuevo del lobby seguirá el patrón existente
>   `lobby__cta-title`/`lobby__cta-subtitle`; no se usarán botones Material crudos.
> - [x] **Copy de errores**: Se agrega scope `QUICK_MATCH`; ningún path muestra `ApiError.message`.
> - [x] **Reglas de juego**: Se reutiliza `seriesFormatToGamesToPlay()`:
>   `BEST_OF_1 -> 1`, `BEST_OF_3 -> 3`, `BEST_OF_5 -> 5`.

**Resultado**: PASS. No hay violaciones de constitution.

## Project Structure

### Documentation (this feature)

```text
specs/020-quick-match/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── quick-match.md
└── tasks.md
```

### Source Code (repository root)

```text
src/app/
├── app.routes.ts                              # + ruta /lobby/quick-match
├── core/models/
│   └── match.models.ts                        # + QuickMatchRequest/Response/Status
├── features/lobby/
│   ├── pages/lobby-page/
│   │   ├── lobby-page.component.ts            # + navegación a quick match
│   │   ├── lobby-page.component.html          # + CTA Partida rápida
│   │   └── lobby-page.component.spec.ts       # + navegación/CTA
│   ├── pages/quick-match-page/
│   │   ├── quick-match-page.component.ts      # NUEVO
│   │   ├── quick-match-page.component.html    # NUEVO
│   │   ├── quick-match-page.component.scss    # NUEVO
│   │   └── quick-match-page.component.spec.ts # NUEVO
│   └── services/
│       ├── matches-api.service.ts             # + enter/cancel quick match
│       └── matches-api.service.spec.ts        # NUEVO o ampliado
├── shared/error-copy/
│   └── error-copy.ts                          # + scope QUICK_MATCH
└── tests/contract/
    └── quick-match.contract.spec.ts           # NUEVO
```

**Structure Decision**: Se extiende la feature `lobby`, porque quick match es un modo de entrada al
juego y comparte UI/servicios con bots y online. Los modelos del contrato quedan en
`core/models/match.models.ts` junto al resto de DTOs de match. No se crea store global: el estado de
búsqueda es efímero y el backend conserva la cola.

## Phase 0 Research

Ver [research.md](./research.md).

## Phase 1 Design

Ver [data-model.md](./data-model.md), [contracts/quick-match.md](./contracts/quick-match.md) y
[quickstart.md](./quickstart.md).

## Constitution Check (Post-Design)

> - [x] **Tokens CSS**: El diseño limita SCSS nuevo a `quick-match-page.component.scss` y cambios
>   menores en `lobby-page.component.scss`, ambos bajo tokens.
> - [x] **Validación de contrato**: El contrato de feature define `POST /api/matches/quick` y
>   `DELETE /api/matches/quick`; se planifica contract test específico de §9.3.
> - [x] **CTAs verticales**: El CTA del lobby replica el patrón existente. En la pantalla, el CTA
>   principal usa `t3-btn t3-btn--primary`.
> - [x] **Copy de errores**: El modelo de errores se resuelve por `getErrorCopy('QUICK_MATCH', err)`.
> - [x] **Reglas de juego**: El data model restringe `gamesToPlay` a `1 | 3 | 5`.

**Resultado**: PASS. Sin complejidad adicional.

## Complexity Tracking

No aplica.
