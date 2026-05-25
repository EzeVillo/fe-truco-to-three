# Phase 0 — Research

**Feature**: 005-unify-cta-palette
**Fecha**: 2026-05-24

Esta fase resuelve las incógnitas técnicas detectadas al armar la spec y el plan. Cada decisión queda fijada con su motivo y las alternativas descartadas.

---

## R1 — Cómo tematizar el modal de confirmación sin que la paleta Material "se filtre"

**Decisión**: reemplazar `ConfirmLogoutDialogComponent` (`src/app/shared/components/confirm-logout-dialog/confirm-logout-dialog.component.ts`) por un `ConfirmDialogComponent` reutilizable y tematizado. El componente abre `MatDialog` (sigue usándose por la mecánica de overlay/cdk/focus-trap) pero:

- Recibe `MatDialogConfig.panelClass = 't3-confirm-dialog'`.
- En `styles.scss` (selector global) se sobreescriben los CSS custom properties Material que controlan el panel y el backdrop dentro de `.t3-confirm-dialog`:
  - `--mdc-dialog-container-color: var(--t3-card-bg);`
  - `--mdc-dialog-subhead-color: var(--t3-text);`
  - `--mdc-dialog-supporting-text-color: var(--t3-text-muted);`
  - `--mdc-dialog-container-shape: var(--t3-radius-lg);`
- El template del componente NO usa `mat-dialog-actions` con `mat-button` / `mat-flat-button`; usa botones propios (`<button type="button" class="t3-btn t3-btn--neutral">` y `<button type="button" class="t3-btn t3-btn--destructive">`).
- El backdrop se tonaliza vía `.cdk-overlay-backdrop.t3-confirm-backdrop` con `background-color: var(--t3-surface-overlay)` (negro verde transparente: `rgba(6, 38, 24, 0.65)` — definido como token).

**Rationale**:
- Permite reusar `MatDialog` (foco, ESC, scroll lock, A11y `aria-modal`) sin pelearse con su composición interna.
- Las sobrescrituras de CSS custom properties son la API oficial de Material M3 para theming (no requiere `::ng-deep`).
- Los tokens M3 dialog se sobreescriben sólo dentro de `.t3-confirm-dialog`, así que ningún otro `MatDialog` se ve impactado.

**Alternativas rechazadas**:
- *Construir un overlay propio con `Overlay` del CDK*: viable pero duplica trabajo que Material ya hace bien (focus trap, ARIA). Costo > beneficio para esta entrega.
- *Sólo cambiar copy en el dialog actual*: no resuelve el problema (los botones siguen siendo Material crudos).
- *Aplicar `::ng-deep` desde el componente*: sigue funcionando pero está oficialmente desaconsejado en Angular Material 21 (M3 introdujo los tokens precisamente para evitarlo).

---

## R2 — Cómo reemplazar `mat-button` y `mat-flat-button` por CTAs tematizados sin perder accesibilidad

**Decisión**: usar `<button type="button" class="t3-btn t3-btn--variant">` con clases utilitarias declaradas dentro del SCSS del componente (no globales). Tres variantes:

- `t3-btn--primary` (verde brand sólido, dorado en focus-ring) → CTA "Crear partida".
- `t3-btn--neutral` (transparente con borde dorado tenue) → "Volver", "Cancelar".
- `t3-btn--destructive` (rojo del sistema, basado en `--t3-danger*`) → "Salir" del modal.

Todas conservan:
- `min-height: 44px` (target táctil iOS HIG) en mobile; `48px` para CTA primario.
- `:focus-visible` con `outline: 2px solid var(--t3-gold-400); outline-offset: 2px`.
- `aria-busy` + `disabled` con estilos diferenciados (opacidad 0.6 + cursor not-allowed; no se baja el contraste por debajo de 3:1 sobre el fondo).
- Soporte de spinner inline (mat-spinner sigue siendo Material — sólo se tiñe vía `--mdc-circular-progress-active-indicator-color: var(--t3-text-on-gold)`).

**Rationale**: el patrón ya está validado en `global-header__logout` y `lobby__cta`; extenderlo no aumenta la deuda y es coherente con la decisión histórica del proyecto de tener Material como sustrato pero UI custom en superficies del producto.

**Alternativas rechazadas**:
- *Tematizar `mat-flat-button` vía paleta M3 dorada en `styles.scss`*: contaminaría TODOS los botones Material de la app (incluidos los que se mantienen en flujos no alcanzados por esta feature), aumentando riesgo de regresiones visuales no previstas.
- *Crear un `T3ButtonComponent` standalone*: razonable a largo plazo, pero para 3 pantallas y 3 variantes agrega abstracción que no se amortiza en esta entrega. Se deja como mejora futura.

---

## R3 — Cómo construir un selector segmentado para "Mejor de N" sin `mat-button-toggle-group`

**Decisión**: dentro de `SeriesFormatSelectorComponent` reemplazar el `mat-button-toggle-group` por una `<div role="radiogroup">` con tres `<button type="button" role="radio">` que reflejan `aria-checked`. La selección se controla por signals (input `format`, output `formatChange`). Estilos:

- Contenedor: `display: flex; background: var(--t3-segmented-bg); border-radius: var(--t3-radius-md); padding: 4px; gap: 4px;`.
- Cada opción: `flex: 1; padding: 8px 12px; border-radius: var(--t3-radius-sm); color: var(--t3-text-muted); background: transparent`.
- Estado seleccionado: `background: var(--t3-segmented-active-bg)` (= `--t3-gold-500`) y `color: var(--t3-text-on-gold)`.
- `:focus-visible` con outline dorado.

**Rationale**:
- Reproduce 1:1 el patrón segmented control nativo iOS/Android pero con tokens del producto.
- Elimina la necesidad de `::ng-deep .mat-button-toggle-label-content` (problemático y frágil).
- La API pública del componente (`format` input / `formatChange` output) no cambia, así que `bots-config-page` no requiere ajustes funcionales.

**Alternativas rechazadas**:
- *Sobrescribir tokens M3 `--mat-button-toggle-*` para el grupo*: posible pero los tokens M3 del button-toggle son numerosos y poco documentados; la solución propia tiene menos superficie de bug.
- *Tabs (`MatTabs`)*: cambia la semántica (navegación de paneles) que es incorrecta para una selección de configuración.

---

## R4 — Guardarraíl: cómo evitar que vuelvan a aparecer estos problemas

**Decisión**: doble guardarraíl complementario al `stylelint` actual.

1. **Stylelint extendido** (`.stylelintrc.json`):
   - Añadir `"color-named": "never"` para bloquear `color: red`, `background: white`, etc.
   - Ampliar el glob de `pnpm lint:styles` a `src/app/{features,shared/components}/**/*.scss`. Justificación: el modal compartido vive en `shared/components` y debe estar cubierto.

2. **ESLint para plantillas Angular**: agregar una regla custom mínima (regex sobre HTML) que falle si en `src/app/features/**/*.html` o `src/app/shared/components/**/*.html` aparece:
   - El atributo `color="primary"`, `color="accent"` o `color="warn"`.
   - El selector/atributo `mat-flat-button`, `mat-raised-button`, `mat-fab` o `mat-mini-fab` (botones Material que aplican paleta stock).

   Implementación: script Node propio `scripts/check-themed-templates.mjs` invocado por `pnpm lint:styles` (o un script nuevo `pnpm lint:themes`), corrido también en lint-staged. Más simple y robusto que escribir un plugin ESLint completo dado que `eslint-plugin-angular` no expone reglas para esto out of the box.

3. **Pre-commit (Husky + lint-staged)**: extender el patrón de lint-staged para que ambos checks corran sobre los archivos staged.

**Rationale**:
- Cubre los tres vectores del problema (colores literales, componentes Material primarios sin tematizar, palettes de stock).
- El script propio es ~30 líneas y no requiere mantenimiento ni dependencias nuevas.
- Falla rápido localmente, antes de llegar al historial.

**Alternativas rechazadas**:
- *Plugin ESLint completo con AST de Angular*: overkill para 2 patrones; el AST de plantillas Angular requiere `@angular-eslint`, una dependencia importante para detectar dos cadenas.
- *Sólo documentación en `CLAUDE.md`*: no es ejecutable y la spec exige "mecanismo automático que detecte y bloquee" (FR-010, FR-012).
- *CI-only*: el usuario pide "verificación local antes de integrar", así que pre-commit es mandatorio.

---

## R5 — Compatibilidad con el modal ya existente (`ConfirmLogoutDialogComponent`)

**Decisión**: mantener `ConfirmLogoutDialogComponent` como wrapper delgado que internamente abre `ConfirmDialogComponent` con datos preconfigurados (`title: '¿Cerrar sesión?'`, `confirmLabel: 'Salir'`, `cancelLabel: 'Cancelar'`, `variant: 'destructive'`). Esto evita romper el call site actual en `global-header.component.ts`.

**Rationale**: cambio mínimo, sin tocar el header.

**Alternativas rechazadas**:
- *Borrar el wrapper y usar `ConfirmDialog` directo en el header*: válido, pero amplía el diff sin beneficio y rompe la spec del wrapper actual que pasa el spec test existente.

---

## R6 — Tokens nuevos a agregar a `src/styles.scss`

Para que el lint pase sin meter literales en SCSS de feature, se agregan estos tokens (capa semántica sobre los primitivos ya existentes):

```scss
// Buttons / CTAs
--t3-cta-bg: var(--t3-gold-500);
--t3-cta-bg-hover: var(--t3-gold-400);
--t3-cta-text-on: var(--t3-text-on-gold);
--t3-cta-disabled-bg: rgba(232, 183, 58, 0.25);
--t3-cta-disabled-text: rgba(26, 26, 26, 0.55);

// Botones neutros / secundarios
--t3-btn-neutral-border: var(--t3-card-border);
--t3-btn-neutral-text: var(--t3-gold-500);
--t3-btn-neutral-bg-hover: var(--t3-gold-bg-subtle);

// Segmented control
--t3-segmented-bg: var(--t3-tabs-bg);
--t3-segmented-active-bg: var(--t3-gold-500);
--t3-segmented-active-text: var(--t3-text-on-gold);
--t3-segmented-inactive-text: var(--t3-text-muted);

// Overlay del modal
--t3-surface-overlay: rgba(6, 38, 24, 0.72);
```

Sólo se introducen `rgba(...)` en `src/styles.scss`, que está exento del lint (`ignoreFiles`).

---

## Resumen de decisiones

| ID | Tema | Decisión |
|----|------|----------|
| R1 | Modal | `ConfirmDialog` propio sobre `MatDialog`, sobreescribiendo tokens M3 vía `panelClass`. |
| R2 | Botones | `<button class="t3-btn t3-btn--{variant}">` propio, sin `mat-flat-button`. |
| R3 | Segmented | `<div role="radiogroup">` propio con tres `<button role="radio">`. |
| R4 | Guardarraíl | `color-named: never` en stylelint + script `check-themed-templates.mjs` en pre-commit. |
| R5 | Compatibilidad | `ConfirmLogoutDialogComponent` queda como wrapper delgado de `ConfirmDialog`. |
| R6 | Tokens | Capa semántica nueva en `src/styles.scss` (no se agregan literales en feature SCSS). |

Todas las `NEEDS CLARIFICATION` quedan resueltas. Se procede a Phase 1.
