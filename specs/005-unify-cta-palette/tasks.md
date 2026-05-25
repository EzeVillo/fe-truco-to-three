# Tasks: Unificación de paleta en CTAs, modales y selectores del lobby vs-bot

**Input**: Design documents from `/specs/005-unify-cta-palette/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/themed-components.md ✅ · quickstart.md ✅

**Tests**: Se agregan tests de comportamiento para `ConfirmDialogComponent` y `SeriesFormatSelectorComponent` (solicitados explícitamente en plan.md).

**Organization**: Tareas agrupadas por historia de usuario para permitir implementación y testeo independiente. Las US1-3 y US5 son P1; US4 es P2.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` después de cambiar estilos.
> - **Templates**: no usar `mat-flat-button`, `mat-raised-button` ni `color="primary|accent|warn"` en `src/app/features/**` ni `src/app/shared/components/**`. Correr `pnpm lint:themes` si el script ya existe.
> - **CTAs**: usar `<button type="button" class="t3-btn t3-btn--primary|neutral|destructive">`, nunca `mat-flat-button` para CTAs.
> - **Reglas de juego**: selector mantiene exactamente `BEST_OF_1 | BEST_OF_3 | BEST_OF_5`; `gamesToPlay ∈ {1,3,5}`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1–US5)
- Paths exactos incluidos en cada descripción

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Preparar la capa de tokens que todo el sistema visual de la feature consume. Es el único bloqueo antes de arrancar las historias de usuario.

- [X] T001 Agregar los 13 tokens CSS semánticos (`--t3-cta-bg`, `--t3-cta-bg-hover`, `--t3-cta-text-on`, `--t3-cta-disabled-bg`, `--t3-cta-disabled-text`, `--t3-btn-neutral-border`, `--t3-btn-neutral-text`, `--t3-btn-neutral-bg-hover`, `--t3-segmented-bg`, `--t3-segmented-active-bg`, `--t3-segmented-active-text`, `--t3-segmented-inactive-text`, `--t3-surface-overlay`) al bloque `:root` en `src/styles.scss` tal como especifica `data-model.md §1`
- [X] T002 Agregar las reglas de theming `.t3-confirm-dialog` y `.cdk-overlay-backdrop.t3-confirm-backdrop` en `src/styles.scss` para sobrescribir los tokens MDC del panel (`--mdc-dialog-container-color`, `--mdc-dialog-subhead-color`, `--mdc-dialog-supporting-text-color`, `--mdc-dialog-container-shape`) y el backdrop (`background-color: var(--t3-surface-overlay)`) según `research.md §R1`

**Checkpoint**: Tokens definidos — todas las historias de usuario pueden arrancar.

---

## Phase 2: Historia de Usuario 1 — Modal de salida con paleta coherente (Priority: P1) 🎯 MVP

**Goal**: Crear `ConfirmDialogComponent` reutilizable y tematizado, actualizar `ConfirmLogoutDialogComponent` como wrapper delgado, y cablear la página vs-bot para abrir el nuevo dialog al presionar "Salir".

**Independent Test**: Abrir el lobby o la página vs-bot, presionar "Salir"/"Cerrar sesión" desde el header, verificar que el modal usa la paleta del sistema (backdrop verde oscuro semi-transparente, superficie `--t3-card-bg`, botón destructivo rojo, botón cancelar neutral dorado). Ver quickstart.md §2.2 y §2.4.

### Implementación — US1

- [X] T003 [US1] Crear `ConfirmDialogComponent` TypeScript con la interfaz `ConfirmDialogData`, inyección de `MAT_DIALOG_DATA`, validación `throwError` si `title` está vacío, y lógica de `role` según `variant` en `src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`
- [X] T004 [US1] Crear la plantilla de `ConfirmDialogComponent` con `role="alertdialog"|"dialog"` dinámico, `aria-labelledby`, `aria-describedby`, `aria-modal="true"`, título en `<h2>`, mensaje opcional en `<p>`, y dos botones `t3-btn--neutral` (cancelar) y `t3-btn--primary|destructive` (confirmar) en `src/app/shared/components/confirm-dialog/confirm-dialog.component.html`
- [X] T005 [US1] Crear el SCSS de `ConfirmDialogComponent` declarando las clases `.t3-btn`, `.t3-btn--neutral` y `.t3-btn--destructive` con todos sus estados (default, hover, active, focus-visible, disabled) usando exclusivamente `var(--t3-*)` en `src/app/shared/components/confirm-dialog/confirm-dialog.component.scss`
- [X] T006 [P] [US1] Crear el barrel export de `ConfirmDialogComponent` y `ConfirmDialogData` en `src/app/shared/components/confirm-dialog/index.ts`
- [X] T007 [US1] Escribir los tests de `ConfirmDialogComponent`: interacción (ESC emite `false`, click confirm emite `true`), variante `destructive` aplica `role="alertdialog"`, variante `primary` aplica `role="dialog"`, `title` vacío lanza error, foco inicial en botón neutral (cancelar) en `src/app/shared/components/confirm-dialog/confirm-dialog.component.spec.ts`
- [X] T008 [US1] Actualizar `ConfirmLogoutDialogComponent` para que sea un wrapper delgado que inyecta `MatDialog` y en su constructor/ngOnInit abre `ConfirmDialogComponent` con datos preconfigurados (`variant: 'destructive'`, labels en español) y cierra devolviendo el resultado booleano, en `src/app/shared/components/confirm-logout-dialog/confirm-logout-dialog.component.ts`
- [X] T009 [US1] Simplificar la plantilla de `ConfirmLogoutDialogComponent` eliminando el markup del modal (ahora delega a `ConfirmDialogComponent`) en `src/app/shared/components/confirm-logout-dialog/confirm-logout-dialog.component.html`
- [X] T010 [US1] Actualizar el spec de `ConfirmLogoutDialogComponent` para verificar que delega en `ConfirmDialogComponent` y propaga el resultado booleano correctamente en `src/app/shared/components/confirm-logout-dialog/confirm-logout-dialog.component.spec.ts`
- [X] T011 [US1] Cablear la página vs-bot para que al presionar "Salir" abra `ConfirmDialogComponent` con `variant: 'destructive'` y los labels apropiados (`confirmLabel: 'Salir'`, `cancelLabel: 'Seguir jugando'`), reemplazando cualquier dialog genérico existente, en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.ts`

**Checkpoint**: El modal de salida invocado desde el header y desde vs-bot muestra la paleta del sistema. Testeable independientemente con `pnpm test` y revisión visual (quickstart.md §2.2 y §2.4).

---

## Phase 3: Historia de Usuario 2 — Botón "Volver" integrado al sistema visual (Priority: P1)

**Goal**: Reemplazar el botón "Volver" de `bots-config-page` (actualmente gris stock de Material) por la variante neutral tematizada `t3-btn--neutral`.

**Independent Test**: Navegar a `/lobby/bots` y verificar que el botón "Volver" (top-left) tiene borde dorado tenue, texto dorado y fondo transparente — no gris stock. Ver quickstart.md §2.3.

### Implementación — US2

- [X] T012 [US2] Reemplazar el botón "Volver" en la plantilla de `bots-config-page` por `<button type="button" class="t3-btn t3-btn--neutral">` manteniendo el handler `(click)` y el texto existente en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.html`
- [X] T013 [US2] Agregar la clase `.t3-btn` base y la variante `.t3-btn--neutral` (default, hover, active, focus-visible, disabled) con todos los tokens `var(--t3-btn-neutral-*)` al SCSS de `bots-config-page` en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.scss`

**Checkpoint**: El botón "Volver" tiene la paleta del sistema. `pnpm lint:styles` pasa sin errores en este archivo.

---

## Phase 4: Historia de Usuario 3 — CTA "Crear partida" con jerarquía visual fuerte (Priority: P1)

**Goal**: Reemplazar el CTA "Crear partida" de `bots-config-page` por la variante primaria `t3-btn--primary`, con estados disabled y busy (spinner) coherentes con la paleta.

**Independent Test**: Abrir `/lobby/bots`, verificar que "Crear partida" tiene fondo dorado sólido y es el elemento más prominente. Deshabilitar la configuración (si aplica) y verificar el estado disabled (fondo dorado semitransparente, texto oscuro atenuado). Ver quickstart.md §2.3.

> **⚠️ Nota**: Esta fase modifica los mismos archivos que US2 (T012/T013). Completar US2 (Phase 3) antes de comenzar estas tareas.

### Implementación — US3

- [X] T014 [US3] Reemplazar el CTA "Crear partida" en la plantilla de `bots-config-page` por `<button type="button" class="t3-btn t3-btn--primary" [disabled]="..." [attr.aria-busy]="...">` con spinner inline (`mat-spinner` tintado) cuando `aria-busy="true"` en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.html`
- [X] T015 [US3] Agregar la variante `.t3-btn--primary` (default, hover, active, focus-visible, disabled, busy con spinner `--mdc-circular-progress-active-indicator-color: var(--t3-cta-text-on)`) al SCSS de `bots-config-page` con tokens `var(--t3-cta-*)` en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.scss`
- [X] T016 [US3] Actualizar el spec de `bots-config-page` para cubrir: CTA habilitado tiene clase `t3-btn--primary`, CTA deshabilitado tiene atributo `disabled`, estado busy muestra spinner en `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.spec.ts`

**Checkpoint**: El CTA "Crear partida" es el elemento más prominente de la pantalla con paleta del sistema. `pnpm lint:styles` y `pnpm test` pasan sin errores.

---

## Phase 5: Historia de Usuario 5 — Guardarraíl automático (Priority: P1)

**Goal**: Crear el script `check-themed-templates.mjs`, ampliar `stylelint` con `color-named: "never"`, ampliar el glob de cobertura a `shared/components/**`, e integrar ambos checks en `pnpm lint:themes` y en `lint-staged`.

**Independent Test**: Ejecutar las pruebas dirigidas del quickstart.md §5 — introducir un color literal o un `mat-flat-button` en un archivo de feature y verificar que `pnpm lint:styles` / `pnpm lint:themes` fallan con mensaje de archivo + línea. Ver quickstart.md §5.

> **⚠️ Nota**: Esta fase puede correr en paralelo con US2 y US3 (archivos distintos).

### Implementación — US5

- [X] T017 [P] [US5] Crear el script `scripts/check-themed-templates.mjs` que: (a) recorre `src/app/{features,shared/components}/**/*.html`, (b) detecta `color="primary|accent|warn"`, `mat-flat-button`, `mat-raised-button`, `mat-fab`, `mat-mini-fab` fuera de comentarios HTML, (c) imprime `file:line:col + mensaje` por hallazgo, (d) exita con código 1 si hay al menos uno, (e) whitelist para `src/app/shared/components/confirm-dialog/**`, (f) soporta flag `--self-test` con fixture interno según `data-model.md §5.2`
- [X] T018 [P] [US5] Actualizar `.stylelintrc.json` para agregar la regla `"color-named": "never"` (bloqueando `red`, `white`, etc.) y ampliar el `files` glob a `["src/app/{features,shared/components}/**/*.scss"]` para cubrir `shared/components/**` según `data-model.md §5.1`
- [X] T019 [US5] Actualizar `package.json` para: (a) agregar script `"lint:themes": "node scripts/check-themed-templates.mjs"`, (b) ampliar `"lint:styles"` para incluir `shared/components/**/*.scss`, (c) extender `lint-staged` para que `src/app/{features,shared/components}/**/*.scss` ejecute `stylelint --fix` y `src/app/{features,shared/components}/**/*.html` ejecute `node scripts/check-themed-templates.mjs`, según `data-model.md §5.3`

**Checkpoint**: `pnpm lint:themes` existe y pasa con el código actual. Las pruebas dirigidas del quickstart.md §5 fallan correctamente con violaciones.

---

## Phase 6: Historia de Usuario 4 — Selector "Mejor de N" con color expresivo (Priority: P2)

**Goal**: Reemplazar el `mat-button-toggle-group` de `SeriesFormatSelectorComponent` por un segmented control propio con `role="radiogroup"` / `role="radio"` y estilos tematizados con `--t3-segmented-*`.

**Independent Test**: Abrir `/lobby/bots` y verificar que las tres opciones del selector son visibles y que la seleccionada tiene fondo dorado sólido con texto oscuro, mientras las inactivas tienen texto atenuado. Cambiar la selección y verificar feedback visual inmediato. Ver quickstart.md §2.3.

### Implementación — US4

- [X] T020 [P] [US4] Reemplazar el `mat-button-toggle-group` en la plantilla de `SeriesFormatSelectorComponent` por `<div role="radiogroup" aria-label="Formato de serie">` con tres `<button type="button" role="radio" [attr.aria-checked]="..." (click)="select(option)">` manteniendo los valores `BEST_OF_1 | BEST_OF_3 | BEST_OF_5` y los `aria-label` de `data-model.md §4` en `src/app/features/lobby/components/series-format-selector/series-format-selector.component.html`
- [X] T021 [P] [US4] Actualizar el TypeScript de `SeriesFormatSelectorComponent` para eliminar `MatButtonToggleModule` del array `imports` y ajustar cualquier binding de template al nuevo markup nativo, preservando la API pública (`format` input, `formatChange` output) sin cambios en `src/app/features/lobby/components/series-format-selector/series-format-selector.component.ts`
- [X] T022 [US4] Reemplazar el SCSS de `SeriesFormatSelectorComponent` con el segmented control tematizado (contenedor flex con `--t3-segmented-bg`, opción seleccionada con `--t3-segmented-active-bg` y `--t3-segmented-active-text`, opción inactiva con `--t3-segmented-inactive-text`, focus-visible con outline dorado) según `research.md §R3` y `data-model.md §1` en `src/app/features/lobby/components/series-format-selector/series-format-selector.component.scss`
- [X] T023 [US4] Escribir/actualizar tests de `SeriesFormatSelectorComponent`: `aria-checked` correcto según `format` input, click emite `formatChange` con el valor correcto, las tres opciones `BEST_OF_1/3/5` están presentes, la opción seleccionada tiene clase CSS activa en `src/app/features/lobby/components/series-format-selector/series-format-selector.component.spec.ts`

**Checkpoint**: El selector segmentado muestra la paleta del sistema. `pnpm lint:styles` pasa. `pnpm test` pasa todos los specs nuevos.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validación integral, correcciones residuales y actualización de documentación.

- [X] T024 Ejecutar `pnpm lint:styles`, `pnpm lint:themes`, `pnpm test` y `pnpm build` desde la raíz del proyecto y corregir cualquier falla residual en los archivos modificados por la feature (tokens, templates, SCSS, specs)
- [X] T025 [P] Actualizar la sección de guardarraíles en `CLAUDE.md` para documentar: `pnpm lint:themes` (nuevo script), prohibición de `mat-flat-button`/`mat-raised-button` en features, y la ampliación del glob de `lint:styles` a `shared/components/**`
- [X] T026 [P] Ejecutar la verificación de regresiones visuales descritas en `quickstart.md §2`, §3 y §4 (mobile 360 px y desktop 1024 px): lobby, modal de cerrar sesión, vs-bot page, modal de salida desde vs-bot

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → SIN dependencias — arrancar inmediatamente
Phase 2 (US1)   → Depende de Phase 1
Phase 3 (US2)   → Depende de Phase 1
Phase 4 (US3)   → Depende de Phase 3 (mismo archivo: bots-config-page)
Phase 5 (US5)   → Depende de Phase 1; puede correr en paralelo con US2/US3
Phase 6 (US4)   → Depende de Phase 1
Phase 7 (Polish)→ Depende de todas las fases anteriores
```

### User Story Dependencies

| Historia | Depende de | Puede correr en paralelo con |
|----------|-----------|------------------------------|
| US1 (modal) | Phase 1 | US2, US5, US4 |
| US2 (Volver) | Phase 1 | US1, US5, US4 |
| US3 (Crear partida) | Phase 3 (US2) | US1, US5, US4 |
| US5 (guardarraíl) | Phase 1 | US1, US2, US4 |
| US4 (selector) | Phase 1 | US1, US2, US5 |

### Within Each User Story

1. TypeScript/lógica antes de plantilla donde aplique
2. Plantilla antes de SCSS
3. Implementación antes de tests (los tests cubren comportamiento del componente terminado)
4. Specs de tests antes de marcar la historia como completa

---

## Parallel Opportunities

### Tras completar Phase 1 (T001 + T002), pueden correr en paralelo:

```
[Hilo A] US1: T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011
[Hilo B] US2: T012 → T013 (y luego US3: T014 → T015 → T016)
[Hilo C] US5: T017 [P] y T018 [P] en paralelo → T019
[Hilo D] US4: T020 [P] y T021 [P] en paralelo → T022 → T023
```

### Tareas marcadas [P] dentro de una historia:

- T006 (barrel export) puede correr junto a T007 (spec)
- T017, T018 (script + stylelintrc) pueden correr juntos
- T020, T021 (HTML + TS del selector) pueden correr juntos

---

## Implementation Strategy

### MVP (sólo US1 — modal tematizado)

1. Completar Phase 1 (T001, T002)
2. Completar Phase 2 / US1 (T003–T011)
3. **VALIDAR**: `pnpm test` + revisión visual quickstart.md §2.2 y §2.4
4. Si pasa, continuar con US2 → US3 → US5 → US4

### Entrega incremental recomendada

1. Phase 1 (tokens) → desbloqueador
2. US1 (modal) → valor inmediato visible, menor riesgo
3. US2 + US3 (bots-config-page) → pantalla vs-bot completa
4. US5 (guardarraíl) → bloquea regresiones futuras
5. US4 (selector) → mejora visual incremental (P2)
6. Polish final

### Con un solo desarrollador (secuencial recomendado)

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011
     → T012 → T013 → T014 → T015 → T016
     → T017 → T018 → T019
     → T020 → T021 → T022 → T023
     → T024 → T025 → T026
```

---

## Notes

- `[P]` = archivos distintos, sin dependencias incompletas → se puede lanzar en paralelo
- `[USn]` = traza la tarea a la historia de usuario para verificabilidad
- Cada historia de usuario es completable y testeable independientemente
- Correr `pnpm lint:styles` después de cualquier cambio en `.scss` de feature
- Correr `pnpm lint:themes` una vez creado el script en T017
- Hacer commit tras cada fase o grupo lógico de tareas
- No introducir `color=`, `rgba()`, `#hex` ni `color: named` en ningún `.scss` bajo `src/app/features/**` o `src/app/shared/components/**`
- Preservar API pública de `SeriesFormatSelectorComponent`: `format` input, `formatChange` output, valores `BEST_OF_1 | BEST_OF_3 | BEST_OF_5`
