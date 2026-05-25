# Truco-to-Three Constitution

## Core Principles

### I. Design Tokens Obligatorios en SCSS de Features

Todo color, espaciado, radio de borde y sombra en archivos SCSS bajo `src/app/features/**/*.scss` debe consumirse exclusivamente vía tokens CSS del proyecto (`var(--t3-…)` definidos en `src/styles.scss`).

Está prohibido usar colores hexadecimales literales (`#fff`, `#1a1a1a`, etc.) ni funciones de color directas (`rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`) como valor de propiedad en SCSS de feature.

**Guardarraíl**: `pnpm lint:styles` (stylelint con `color-no-hex` y `declaration-property-value-disallowed-list`) corre en pre-commit via lint-staged. Un PR que introduzca colores hardcodeados fallará el CI.

### II. Validación Cruzada con `docs/CONTRATOS_API.md` antes de Tipar Endpoints

Antes de tipar un DTO o consumir un endpoint del backend, verificar campo a campo contra `docs/CONTRATOS_API.md`. Esta documentación es la fuente autoritativa del contrato.

Puntos críticos:
- `gamesToPlay` en `POST /api/matches/bot` acepta **{1, 3, 5}** (partidas totales). Nunca `2`.
- `seriesFormatToGamesToPlay()` mapea: `BEST_OF_1 → 1`, `BEST_OF_3 → 3`, `BEST_OF_5 → 5`.
- Si el backend diverge en runtime del contrato documentado, **actualizar `docs/CONTRATOS_API.md`** primero y luego alinear el cliente.

**Guardarraíl**: `pnpm test` incluye `src/tests/contract/` que parsea `docs/CONTRATOS_API.md §9.2` y verifica paridad con `CreateBotMatchRequest`/`CreateBotMatchResponse` vía `satisfies`.

### III. CTAs con Título + Descripción Apilados Verticalmente

Los botones de llamada a la acción (CTA) que exponen título y descripción deben presentarlos en **dos líneas separadas y apiladas verticalmente**:

- Usar `display: flex; flex-direction: column` en el botón CTA.
- Título en `<span class="*-title">` y descripción en `<span class="*-subtitle">`.
- Separación mínima entre título y subtítulo: `var(--t3-gap-xs)`.
- **No usar `mat-flat-button`** para CTAs con jerarquía visual interna (Angular Material aplana el contenido).
- Altura máxima en mobile: ≤ 96 px.

## Restricciones Adicionales

- **Idioma del producto**: español (copy de UI, artefactos de Spec Kit, mensajes de error del front).
- **Copy de errores**: nunca mostrar `ApiError.message` del backend; usar el catálogo de copy del front mapeado por scope + HTTP status (`getErrorCopy()`).
- **Reglas del juego**: una partida se gana llegando exactamente a 3 puntos (pasarse pierde). Las series son mejor de 1, 3 o 5 partidas. No modificar estos valores sin aprobación del producto.
- **Mobile floor**: 360 px. Landscape mobile fuera de scope. Un único breakpoint `@media (min-width: 1024px)`.
- **Package manager**: pnpm (v11). No usar npm ni yarn.
- **Componentes standalone**: no usar NgModules en código nuevo.

## Gates de Calidad

Todos los PRs deben pasar antes del merge:

| Gate | Comando | Qué verifica |
|------|---------|--------------|
| Lint TS/HTML | `pnpm lint` | ESLint — errores de código |
| Lint estilos | `pnpm lint:styles` | Colores hardcodeados en SCSS de feature |
| Tests | `pnpm test` | Unit tests + contract tests |
| Build | `pnpm build` | Compilación Angular sin errores |

## Governance

Esta constitution es la referencia normativa del proyecto. Cualquier modificación requiere:
1. Documentar el motivo en el spec de la feature que introduce el cambio.
2. Actualizar `CLAUDE.md` con la regla operativa correspondiente.
3. Agregar un test o guardarraíl que prevenga regresiones.

**Version**: 1.0.0 | **Ratified**: 2026-05-24 | **Last Amended**: 2026-05-24
