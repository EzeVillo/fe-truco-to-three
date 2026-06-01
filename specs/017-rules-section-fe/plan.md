# Implementation Plan: Sección de reglas de variante

**Branch**: `017-rules-section-fe` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-rules-section-fe/spec.md`

## Summary

Agregar en el lobby un CTA hacia una página de reglas de la variante a 3 puntos, basada en
`docs/REGLAS_VARIANTE.md`, con contenido local del frontend y sin dependencia de backend. La
implementación se limita al bounded context de lobby: un modelo local de reglas, un componente
presentacional para agruparlas por tema, una página dedicada y la integración del CTA en
`LobbyPageComponent`.

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21

**Primary Dependencies**: Angular standalone components, Angular Router existente, Angular
testing utilities, Vitest

**Storage**: N/A; contenido local de solo lectura en el bundle frontend

**Testing**: Vitest via `pnpm test`; ESLint via `pnpm lint`; stylelint via
`pnpm lint:styles`; theme lint via `pnpm lint:themes`; build via `pnpm build`

**Target Platform**: Aplicación web frontend responsive, mobile desde 360 px y desktop desde
1024 px

**Project Type**: Single-page web application frontend

**Performance Goals**: La sección debe renderizar junto con el lobby sin carga remota y permitir
encontrar la regla de punto exacto en menos de 30 segundos desde el ingreso al lobby

**Constraints**: Usar solo tokens `var(--t3-...)` en SCSS de features; no usar botones Material
crudos prohibidos; no agregar endpoints; la entrada a reglas debe nacer del lobby; mantener copy
y artefactos en español

**Scale/Scope**: Un componente presentacional en `features/lobby`, una página dedicada de reglas,
un modelo local de reglas, tests de contenido/navegación y ajustes visuales acotados a lobby

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: La feature agregará SCSS solo bajo `src/app/features/lobby/**`; todo color/espaciado/radio/sombra debe usar `var(--t3-...)`. Verificar con `pnpm lint:styles`.
> - [x] **Validación de contrato**: No se tipan ni consumen endpoints. Los valores de dominio visibles se validan contra `docs/REGLAS_VARIANTE.md` y las reglas ya documentadas en `docs/CONTRATOS_API.md`.
> - [x] **CTAs verticales**: No se agregan CTAs nuevos. Los CTAs existentes del lobby se preservan con estructura título/subtítulo y clases propias.
> - [x] **Copy de errores**: La feature no introduce paths de error ni consumo remoto.
> - [x] **Reglas de juego**: Se preservan punto exacto a `3`, pasarse pierde y series mejor de `1`, `3` o `5`.

## Project Structure

### Documentation (this feature)

```text
specs/017-rules-section-fe/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- rules-section-ui-contract.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/app/features/lobby/
|-- components/
|   `-- rules-section/
|       |-- rules-section.component.ts
|       |-- rules-section.component.html
|       |-- rules-section.component.scss
|       `-- rules-section.component.spec.ts
|-- models/
|   `-- variant-rules.ts
`-- pages/
    `-- lobby-page/
        |-- lobby-page.component.ts
        |-- lobby-page.component.html
        |-- lobby-page.component.scss
        `-- lobby-page.component.spec.ts
    `-- rules-page/
        |-- rules-page.component.ts
        |-- rules-page.component.html
        |-- rules-page.component.scss
        `-- rules-page.component.spec.ts
```

**Structure Decision**: La sección pertenece al bounded context de lobby. El contenido de reglas
queda en un modelo local de feature para que el componente sea presentacional y para facilitar la
comparación con `docs/REGLAS_VARIANTE.md`. Se agrega una ruta bajo `/lobby/reglas`, no se toca
`core/` y no se crea servicio porque no hay estado ni integración externa.

## Complexity Tracking

No hay violaciones constitucionales ni complejidad excepcional que justificar.

## Phase 0: Research

Ver [research.md](./research.md). Todas las decisiones quedan resueltas sin marcadores pendientes.

## Phase 1: Design & Contracts

Artefactos generados:

- [data-model.md](./data-model.md)
- [contracts/rules-section-ui-contract.md](./contracts/rules-section-ui-contract.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: El diseño limita cambios visuales a `features/lobby` y exige tokens `var(--t3-...)`.
> - [x] **Validación de contrato**: No hay nuevos DTOs ni endpoints; el contrato UI exige paridad de valores críticos con `docs/REGLAS_VARIANTE.md`.
> - [x] **CTAs verticales**: No se introducen nuevos CTAs; se preservan los CTAs existentes.
> - [x] **Copy de errores**: No hay errores remotos ni mensajes de backend.
> - [x] **Reglas de juego**: El data model fija punto exacto a `3`, Falta envido, ancho de espada y restricciones de fold como contenido visible.
