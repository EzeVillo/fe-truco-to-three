# Implementation Plan: Corrección de Lobby vs Bots y Guardarraíles de Consistencia

**Branch**: `004-lobby-bots-fixes` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification en `/specs/004-lobby-bots-fixes/spec.md`

## Summary

Esta feature corrige tres defectos detectados después del cierre de la feature 003 (lobby vs bots) y añade guardarraíles para que no vuelvan a aparecer:

1. **UI**: el CTA "Jugar contra bots" en `/lobby` no respeta la paleta del proyecto (colores fuera de los tokens `--t3-…`) y presenta título + descripción mal jerarquizados (pegados / en una sola línea visualmente) además de un tamaño desproporcionado.
2. **Contrato**: `POST /api/matches/bot` falla con `422 InvalidGamesToPlayException` porque el cliente envía `gamesToPlay = 2` para `BEST_OF_3`, cuando el backend exige valores literales `{1, 3, 5}` (partidas totales de la serie). El error se confirmó en runtime (requestId `9aa17514-…`, 2026-05-24T22:51:21Z) y `docs/CONTRATOS_API.md §9.2` describía mal la semántica del campo.
3. **Guardarraíles**: agregar verificaciones automáticas (stylelint para colores hardcodeados; test de contrato para DTOs vs `docs/CONTRATOS_API.md`) y reflejar las reglas en `CLAUDE.md` + constitution + templates del Spec Kit, para que el modelo y los devs no reincidan.

Enfoque técnico: ajustes locales en `src/app/features/lobby/**` (HTML/SCSS del CTA, mapeo `seriesFormatToGamesToPlay`, tipos `CreateBotMatchRequest`), corrección de `docs/CONTRATOS_API.md §9.2`, alta de un stylelint config + plugin con regla "no literal colors" alcanzando los `.scss` de feature, y un test Vitest que parsea el markdown del contrato para validar paridad de campos del DTO. No se introducen nuevas dependencias mayores fuera del ecosistema ya presente.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Angular 21 (componentes standalone).

**Primary Dependencies**: Angular 21, Angular Material, NgRx Signals, `@stomp/stompjs` + SockJS, RxJS. Tooling: Vitest, ESLint, Prettier, Husky + lint-staged, pnpm 11. Para esta feature se añade **stylelint** + **stylelint-config-standard-scss** (y opcionalmente `stylelint-no-restricted-syntax`) limitado a `src/app/features/**/*.scss` con regla `color-no-hex` y `declaration-property-value-disallowed-list` para `rgb(/rgba(/hsl(/hsla(` literales.

**Storage**: N/A (frontend; `auth_token`/`auth_username` en localStorage ya existentes).

**Testing**: Vitest (unitario + integración del front). Tests nuevos:
- contract test: `tests/contract/create-bot-match.contract.spec.ts` que parsea `docs/CONTRATOS_API.md §9.2` y verifica paridad con `CreateBotMatchRequest`/`CreateBotMatchResponse`.
- unit tests actualizados sobre `seriesFormatToGamesToPlay` y sobre el componente `BotsConfigPageComponent`/`LobbyPageComponent` para reflejar nuevos contratos.
- e2e/UI manual: lobby a 360 px y 1440 px verificando alto del CTA y disposición vertical.

**Target Platform**: Navegadores modernos en mobile portrait (360–1023 px) y desktop (≥1024 px). El backend Spring corre en `http://localhost:8080`.

**Project Type**: Single-project frontend Angular (`src/app/**`). Sin backend en este repo.

**Performance Goals**: N/A funcional; mantener LCP/Interactivity actuales del lobby (no agregar work síncrono en pintado).

**Constraints**: Mobile floor 360 px; sin landscape; usar exclusivamente tokens `--t3-…` para color/espaciado/radio/sombra (memoria `design_system_standards`); enums backend case-sensitive; no mostrar `ApiError.message` crudo (memoria `error_messaging`); contrato `gamesToPlay ∈ {1,3,5}` (memoria `contract_gamestoplay`).

**Scale/Scope**: 1 pantalla principal afectada (`/lobby`) + 1 pantalla derivada (`/lobby/bots`) + 1 servicio (`BotsApiService`) + 1 doc (`docs/CONTRATOS_API.md`) + 2 piezas de tooling (stylelint, contract test) + 3 documentos de guía (CLAUDE.md, constitution, templates Spec Kit).

## Constitution Check

*GATE: debe pasar antes de Phase 0 research. Se re-evalúa después de Phase 1.*

El archivo `.specify/memory/constitution.md` actualmente contiene **placeholders sin ratificar** (`[PRINCIPLE_X_NAME]`, etc.). No hay principios formalmente ratificados todavía. Las reglas operativas vigentes del proyecto viven en `CLAUDE.md` y en las memorias persistentes (`design_system_standards`, `error_messaging`, `game_rules`, `contract_gamestoplay`, `responsive_scope`).

**Gates evaluados contra reglas operativas vigentes (CLAUDE.md + memorias):**

| Gate | Regla | Estado |
|------|-------|--------|
| G1 — Idioma | Artefactos de Spec Kit en español. | ✅ Plan, research, data-model, quickstart y contratos se escriben en español. |
| G2 — Design tokens | Todo color/espaciado/radio/sombra en SCSS de feature vía `var(--t3-…)`. | ✅ Toda regresión visual del CTA se resuelve consumiendo tokens. Se añade stylelint para forzarlo. |
| G3 — Mobile floor 360 px / sin landscape | Layout debe funcionar desde 360 px sin media queries de `max-height` ni sub-breakpoints. | ✅ Una sola media query `min-width: 1024px`; CTA testeado a 360 y 1440. |
| G4 — Reglas del juego | Series mejor de 1/3/5; default mejor de 3. | ✅ Se preservan; se corrige sólo el wire-format (`gamesToPlay`). |
| G5 — Copy de errores | No mostrar `ApiError.message` crudo; usar catálogo del front. | ✅ Se mantiene `getErrorCopy()` y se añade cobertura de tests. |
| G6 — Contrato BE como fuente | `docs/CONTRATOS_API.md` es autoritativo; si el BE diverge en runtime, **se actualiza la doc** y el cliente se alinea con runtime. | ✅ Se corrige §9.2 (descripción de `gamesToPlay`) en esta feature (FR-007a) y se añade contract test para que la divergencia no se cuele. |
| G7 — pnpm como package manager | No usar npm/yarn. | ✅ Cualquier nueva dep se agrega vía `pnpm add -D`. |

**Resultado**: gates pasan. No hay violaciones que justificar en Complexity Tracking.

**Acción pendiente derivada del spec (FR-012, SC-006)**: ratificar formalmente la constitution con los principios mencionados arriba como parte del scope de esta feature. Esa edición se planifica en Phase 1 como entrega documental, no como gate.

## Project Structure

### Documentation (this feature)

```text
specs/004-lobby-bots-fixes/
├── plan.md              # Este archivo
├── spec.md              # Existente
├── research.md          # Phase 0 (creado por /speckit-plan)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── POST_api_matches_bot.md   # Phase 1 — contrato corregido
└── tasks.md             # Phase 2 (lo crea /speckit-tasks)
```

### Source Code (repository root)

Proyecto **single-project Angular** (no hay split front/back en este repo). Rutas reales afectadas:

```text
src/
├── app/
│   ├── core/
│   │   └── models/
│   │       └── match.models.ts                 # MODIFICA: seriesFormatToGamesToPlay + CreateBotMatchRequest
│   ├── features/
│   │   └── lobby/
│   │       ├── pages/
│   │       │   ├── lobby-page/
│   │       │   │   ├── lobby-page.component.html   # MODIFICA: estructura del CTA
│   │       │   │   ├── lobby-page.component.scss   # MODIFICA: tokens + jerarquía vertical + alto ≤96px
│   │       │   │   └── lobby-page.component.spec.ts# AÑADE: tests de layout/tokens
│   │       │   └── bots-config-page/
│   │       │       └── bots-config-page.component.spec.ts  # MODIFICA: nuevo mapeo 1/3/5
│   │       └── services/
│   │           └── bots-api.service.spec.ts        # MODIFICA: payload 1/3/5
│   └── shared/
│       └── error-copy/                              # ya existente — se asume estable
├── styles.scss                                      # fuente única de tokens (no se toca aquí)
└── ...
tests/
└── contract/
    └── create-bot-match.contract.spec.ts            # AÑADE: parsea docs/CONTRATOS_API.md §9.2
docs/
└── CONTRATOS_API.md                                 # MODIFICA §9.2: descripción de gamesToPlay
.stylelintrc.json                                    # AÑADE: regla no-literal-colors para src/app/features/**
.specify/
├── memory/
│   └── constitution.md                              # MODIFICA: ratifica principios (FR-012)
└── templates/
    ├── plan-template.md                             # MODIFICA: checklist tokens + contrato
    └── tasks-template.md                            # MODIFICA: ítems checklist por defecto
CLAUDE.md                                            # MODIFICA: secciones explícitas (FR-012)
```

**Structure Decision**: se mantiene la estructura existente de **un único proyecto Angular** con features en `src/app/features/<dominio>/{pages,components,services}` y modelos compartidos en `src/app/core/models`. Esta feature **no agrega features nuevas**: edita archivos del feature `lobby`, añade un test de contrato bajo `tests/contract/`, e introduce configuración de stylelint en la raíz. La referencia al plan en `CLAUDE.md` (entre los marcadores `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->`) se actualiza para apuntar a este archivo.

## Complexity Tracking

> Sin violaciones de constitution. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
