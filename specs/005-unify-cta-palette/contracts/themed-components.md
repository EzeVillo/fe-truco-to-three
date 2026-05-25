# Contract — Themed Components & Lint Guardrails

**Feature**: 005-unify-cta-palette
**Fecha**: 2026-05-24

Este documento es el **contrato visual + de lint** que las pantallas del producto deben respetar. Es la fuente autoritativa para los componentes tematizados expuestos por esta feature y para las reglas que los hacen cumplir.

---

## 1. `ConfirmDialogComponent` (shared)

**Path**: `src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`
**Selector**: `app-confirm-dialog` (uso interno; se abre vía `MatDialog.open`).

### 1.1 Apertura

```ts
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog';

const dialog = inject(MatDialog);

const ref = dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
  ConfirmDialogComponent,
  {
    panelClass: 't3-confirm-dialog',
    backdropClass: 't3-confirm-backdrop',
    data: {
      title: '¿Salir de la partida?',
      message: 'Si salís ahora se cancela la configuración actual.',
      confirmLabel: 'Salir',
      cancelLabel: 'Seguir jugando',
      variant: 'destructive',
    },
  },
);

ref.afterClosed().subscribe((confirmed) => { /* boolean */ });
```

### 1.2 Garantías (qué se compromete el contrato)

| Garantía | Comprobación |
|----------|--------------|
| El backdrop usa `var(--t3-surface-overlay)`. | Spec del componente + visual review. |
| El contenedor del diálogo usa tokens `--t3-card-bg`, `--t3-radius-lg`, `--t3-shadow-card`. | Spec + auditoría de DOM con `getComputedStyle`. |
| Los botones de acción son `t3-btn--primary` o `t3-btn--destructive` (confirmar) y `t3-btn--neutral` (cancelar). | Spec snapshot. |
| `aria-modal=true`, `role="dialog"` o `role="alertdialog"` según `variant`. | Spec accesibilidad. |
| ESC cierra y emite `false`. | Spec interacción. |
| El click en backdrop cierra y emite `false` (a menos que se pase `disableClose: true`). | Spec interacción. |

### 1.3 Errores

| Caso | Comportamiento |
|------|----------------|
| `data.title` vacío o `undefined`. | Lanza `Error('ConfirmDialog requiere title')` en `ngOnInit`. |
| `data.variant` no en `{'destructive','primary'}`. | Cae al default `'primary'` (sin lanzar). |

---

## 2. `SeriesFormatSelectorComponent` (lobby)

**Path**: `src/app/features/lobby/components/series-format-selector/`.
**Selector**: `app-series-format-selector`.

### 2.1 API

```ts
@Component({ selector: 'app-series-format-selector', standalone: true })
export class SeriesFormatSelectorComponent {
  readonly format = input.required<SeriesFormat>();
  readonly formatChange = output<SeriesFormat>();
}
```

**Sin cambios respecto a la versión previa** — el reemplazo es interno (UI + estilos). Cualquier consumidor existente sigue funcionando.

### 2.2 Garantías visuales

| Garantía | Comprobación |
|----------|--------------|
| Tres opciones en orden: `BEST_OF_1`, `BEST_OF_3`, `BEST_OF_5`. | Spec + reglas de juego (constitution). |
| La opción seleccionada usa `--t3-segmented-active-bg` y `--t3-segmented-active-text`. | Spec snapshot. |
| Las opciones no seleccionadas usan `--t3-segmented-inactive-text` sobre `transparent`. | Spec snapshot. |
| `role="radiogroup"` + `role="radio"` + `aria-checked` en cada opción. | Spec accesibilidad. |
| Flechas izquierda/derecha mueven el foco entre opciones (patrón WAI-ARIA radio). | Spec interacción. |

### 2.3 Errores

| Caso | Comportamiento |
|------|----------------|
| `format` con un valor fuera de `SeriesFormat`. | Type system lo previene en compilación; en runtime se ignora y se renderiza ninguna opción seleccionada. |

---

## 3. Variantes de botón `t3-btn--*`

Cada componente que necesite estos botones declara las clases en su propio SCSS (no hay hoja global). Las tres variantes son obligatorias en pantallas del producto que reemplacen botones Material.

### 3.1 Reglas de uso

- `t3-btn--primary` → exactamente UN botón por pantalla actúa como CTA principal (el más prominente). En `bots-config-page` es "Crear partida".
- `t3-btn--neutral` → para "Volver", "Cancelar", "Seguir jugando" y similares.
- `t3-btn--destructive` → SÓLO en confirmación de acción destructiva ya tomada (botón final del modal "Salir").

### 3.2 Atributos requeridos

| Atributo | Valor | Notas |
|----------|-------|-------|
| `type` | `button` (o `submit` si el botón submitea un form). | Obligatorio; nunca confiar en el default `submit`. |
| `aria-label` | Presente sólo si el contenido visible no describe la acción (p. ej. ícono solo). | — |
| `aria-busy` | `true` cuando el botón está procesando (spinner activo). | El spinner inline se muestra en lugar del texto. |
| `disabled` | Reflejado por estilo `t3-btn:disabled`. | `pointer-events: none`. |

---

## 4. Lint rules contract

### 4.1 Stylelint (`pnpm lint:styles`)

| Regla | Comportamiento |
|-------|----------------|
| `color-no-hex: true` | Falla si encuentra `#fff`, `#1a1a1a`, etc. |
| `color-named: "never"` | Falla si encuentra `red`, `white`, `transparent`* — *excepción*: `transparent` está permitido como palabra clave especial vía el `ignoreProperties` ya configurado o se whitelistea explícitamente. |
| `declaration-property-value-disallowed-list` | Falla si encuentra `rgb(`, `rgba(`, `hsl(`, `hsla(` como valor de cualquier propiedad. |
| **Scope** | `src/app/{features,shared/components}/**/*.scss`. `src/styles.scss` exento. |

### 4.2 Templates (`pnpm lint:themes`)

Script `scripts/check-themed-templates.mjs`. Falla con exit code ≠ 0 si en `src/app/{features,shared/components}/**/*.html` aparece cualquiera de:

```text
color="primary"       color="accent"       color="warn"
mat-flat-button       mat-raised-button    mat-fab       mat-mini-fab
```

Salida esperada en error:

```text
src/app/features/lobby/pages/bots-config-page/bots-config-page.component.html:54:7
  mat-flat-button prohibido en superficies del producto: usar t3-btn.
```

Whitelist:
- `src/app/shared/components/confirm-dialog/confirm-dialog.component.html` puede usar `mat-dialog-*` (no botones Material).

### 4.3 Pre-commit

`lint-staged` corre ambas comprobaciones sobre los archivos staged. Un commit con violaciones es bloqueado por Husky.

### 4.4 Garantías

| ID | Garantía | Verificación |
|----|----------|--------------|
| L1 | Cualquier color literal nuevo en feature/shared SCSS es rechazado. | Test dirigido: `tests/lint/stylelint-colors.test.ts` (opcional para esta feature; se puede validar manualmente con un fixture). |
| L2 | Cualquier nuevo `mat-flat-button` / `mat-raised-button` / `color="primary|accent|warn"` en template de feature/shared es rechazado. | Test dirigido: archivo fixture en `scripts/__fixtures__/bad-template.html` ejecutado por `check-themed-templates.mjs` con `--self-test`. |
| L3 | Los lint rules corren en pre-commit. | Documentado en `package.json` `lint-staged`; verificable creando un commit con violación. |

---

## 5. Versionado

Cualquier cambio futuro a:
- El listado de prohibiciones del script `check-themed-templates.mjs`.
- Las variantes `t3-btn--*`.
- La API de `ConfirmDialogComponent`.

debe documentarse aquí (`contracts/themed-components.md`) y reflejarse en `CLAUDE.md` antes de ser implementado, conforme al principio de governance del constitution.
