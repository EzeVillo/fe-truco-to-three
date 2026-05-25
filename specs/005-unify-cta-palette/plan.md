# Implementation Plan: Unificación de paleta en CTAs, modales y selectores del lobby vs-bot

**Branch**: `005-unify-cta-palette` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

## Summary

Las pantallas del flujo vs-bot (lobby, `bots-config-page` y los modales de confirmación que se invocan desde ellas) hoy mezclan componentes de Angular Material "crudos" (`mat-button`, `mat-flat-button color="primary"`, `mat-button-toggle-group`, `mat-dialog` con `mat-flat-button`) con el sistema visual propio (`--t3-*`). Esto produce CTAs apagados, un botón "Volver" gris stock, un selector de formato sin énfasis y un modal de salida con paleta ajena.

La aproximación técnica:

1. **Reemplazar los componentes Material "crudos" por variantes propias tematizadas**, usando exclusivamente tokens `--t3-*` y siguiendo el patrón ya establecido en `global-header__logout` (`src/app/shared/components/global-header/global-header.component.scss:62`) y `lobby__cta` (`src/app/features/lobby/pages/lobby-page/lobby-page.component.scss:42`).
2. **Introducir un `ConfirmDialogComponent` compartido y tematizado** (con variantes `destructive` / `neutral`) que sustituya a `ConfirmLogoutDialogComponent` y se reutilice en el "Salir" del lobby/vs-bot. El backdrop y la superficie del diálogo se tematizan vía sobrescritura de los CSS custom properties `--mdc-dialog-*` desde una clase `panelClass` propia.
3. **Crear un selector segmentado propio `SeriesFormatSelectorComponent` (reemplazo interno)** sin `mat-button-toggle-group`, con tres botones radio y estado seleccionado destacado con `--t3-gold-500`.
4. **Endurecer el guardarraíl** existente con dos reglas adicionales:
   - Una verificación de plantillas (ESLint + regex) que prohíbe el uso de `color="primary|accent|warn"` y de directivas `mat-flat-button` / `mat-raised-button` en HTML bajo `src/app/features/**`.
   - Una regla `stylelint` extra que prohíbe colores nombrados (`color: red`, `background: white`, etc.) además de hex/rgb/hsl.

El alcance no toca scoring ni contratos REST/WebSocket; sólo presentación + guardarraíles.

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21 (standalone components, control-flow nativo `@if`/`@for`).

**Primary Dependencies**: Angular Material 21 (M3) — sólo para `MatDialog`, `MatSpinner` y temas globales tipográficos; el resto del UI custom; `stylelint` 17 + `stylelint-config-standard-scss`; `eslint` 10 + `eslint-plugin-angular`; Vitest 4.

**Storage**: N/A (feature puramente de presentación).

**Testing**: Vitest para unit tests de componentes (`*.component.spec.ts`); contract tests en `src/tests/contract/` (no se tocan en esta feature). Se agregan tests de comportamiento para `ConfirmDialogComponent` y `SeriesFormatSelectorComponent` (interacción, emisión de evento, atributos ARIA).

**Target Platform**: Web (Chrome/Edge/Firefox/Safari evergreen). Mobile 360 px – 1023 px y desktop ≥ 1024 px.

**Project Type**: Web — frontend Angular SPA (proyecto único; el backend vive en otro repo).

**Performance Goals**: Repintado del modal < 16 ms (un frame a 60 fps); no introducir hojas de estilo globales nuevas (`@Component.styles` scoped). Bundle JS sin aumento neto: la baja de `MatButtonToggleModule` en `bots-config-page` compensa el alta de un componente propio.

**Constraints**:
- 100 % de los colores en SCSS de feature deben pasar `pnpm lint:styles`.
- 0 ocurrencias de `mat-flat-button`/`mat-raised-button` ni atributos `color="primary|accent|warn"` en plantillas bajo `src/app/features/**` y `src/app/shared/components/**` (excluyendo el dialog wrapper que define la `panelClass` themed).
- Mobile-first; único media query `@media (min-width: 1024px)`.
- No introducir landscape ni breakpoints intermedios.
- Mantener compatibilidad con la API pública existente del `SeriesFormatSelectorComponent` (`format` input, `formatChange` output, valores `BEST_OF_1 | BEST_OF_3 | BEST_OF_5`).

**Scale/Scope**: 3 pantallas alcanzadas + 1 modal compartido; ~6 archivos de componente modificados/creados; ~2 reglas de guardarraíl nuevas; suite de tests +~6 specs nuevos.

## Constitution Check

*GATE: debe pasar antes de Phase 0 research. Re-chequeado tras Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: Todo color/espaciado/radio/sombra nuevo se consume vía `var(--t3-…)`. Se agregan tokens semánticos nuevos en `src/styles.scss` (`--t3-cta-bg`, `--t3-cta-bg-hover`, `--t3-cta-text-on`, `--t3-cta-disabled-bg`, `--t3-cta-disabled-text`, `--t3-surface-overlay`, `--t3-segmented-bg`, `--t3-segmented-active-bg`, `--t3-segmented-active-text`) si no existe un token equivalente. `pnpm lint:styles` cubre todos los `*.scss` bajo `src/app/features/**`. Se amplía el patrón para incluir `src/app/shared/components/**`.
> - [x] **Validación de contrato**: la feature no modifica DTOs ni endpoints. No hay impacto en `docs/CONTRATOS_API.md`.
> - [x] **CTAs verticales**: el CTA "Crear partida" no tiene subtítulo, así que la regla de apilado vertical no aplica. El CTA del lobby ("Jugar contra bots") ya cumple. Se documenta y se prohíbe `mat-flat-button` para CTAs por guardarraíl (no sólo aquellos con jerarquía interna).
> - [x] **Copy de errores**: no se introducen nuevos paths de error; `bots-config-page` ya usa `getErrorCopy()` para `catalogError()` y `createMatchError()`.
> - [x] **Reglas de juego**: el selector mantiene exactamente `BEST_OF_1`/`BEST_OF_3`/`BEST_OF_5` y el mapeo a `gamesToPlay ∈ {1,3,5}`. Sin cambios.

Resultado: **PASS**. No hay violaciones que justificar en *Complexity Tracking*.

## Project Structure

### Documentation (this feature)

```text
specs/005-unify-cta-palette/
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones de theming + guardarraíl
├── data-model.md        # Phase 1: tokens nuevos + variantes de ConfirmDialog
├── quickstart.md        # Phase 1: cómo verificar visualmente la feature
├── contracts/
│   └── themed-components.md   # "contrato" de componentes tematizados y reglas de lint
└── checklists/
    └── requirements.md  # ya existente (de /speckit-specify)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── features/
│   │   └── lobby/
│   │       ├── components/
│   │       │   └── series-format-selector/
│   │       │       ├── series-format-selector.component.ts        # MODIFICAR: reemplaza mat-button-toggle-group por segmented propio
│   │       │       ├── series-format-selector.component.html      # MODIFICAR
│   │       │       ├── series-format-selector.component.scss      # MODIFICAR
│   │       │       └── series-format-selector.component.spec.ts   # AMPLIAR: cubre A11y y selección
│   │       └── pages/
│   │           └── bots-config-page/
│   │               ├── bots-config-page.component.html            # MODIFICAR: <button> propios en lugar de mat-button / mat-flat-button
│   │               ├── bots-config-page.component.scss            # MODIFICAR: estilos de CTA primaria + Volver secundario
│   │               └── bots-config-page.component.spec.ts         # AMPLIAR
│   ├── shared/
│   │   └── components/
│   │       ├── confirm-dialog/                                    # NUEVO: reemplazo tematizado y reutilizable
│   │       │   ├── confirm-dialog.component.ts
│   │       │   ├── confirm-dialog.component.html
│   │       │   ├── confirm-dialog.component.scss
│   │       │   └── confirm-dialog.component.spec.ts
│   │       └── confirm-logout-dialog/                             # MODIFICAR: delega en ConfirmDialog con variante destructive
│   │           ├── confirm-logout-dialog.component.ts
│   │           ├── confirm-logout-dialog.component.html
│   │           └── confirm-logout-dialog.component.spec.ts
│   └── styles.scss                                                # MODIFICAR: tokens semánticos nuevos para CTA/segmented/overlay
├── tests/
│   └── contract/                                                  # SIN CAMBIOS
└── ...

# Guardarraíles (raíz)
.stylelintrc.json                                                  # MODIFICAR: añade color-named="never"
eslint.config.js (o .eslintrc.*)                                   # MODIFICAR: regla custom que prohíbe mat-flat-button/mat-raised-button y color="primary|accent|warn" en templates bajo features/** y shared/components/**
package.json                                                       # MODIFICAR: amplía glob de lint:styles a shared/components/**
```

**Structure Decision**: proyecto único (Angular SPA standalone). La feature se concentra en `src/app/features/lobby/**` y `src/app/shared/components/**`, más actualizaciones de `src/styles.scss` y de la configuración raíz de stylelint/eslint. No requiere ni `frontend/`+`backend/` ni proyectos adicionales.

## Complexity Tracking

> **Sin violaciones**. No hay desvíos respecto del constitution check que requieran justificación.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
