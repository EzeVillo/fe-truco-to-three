# Phase 1 — Data Model

**Feature**: 005-unify-cta-palette
**Fecha**: 2026-05-24

Esta feature no manipula entidades de dominio (no toca scoring, contratos REST/WebSocket, ni estado persistente). El "modelo de datos" relevante es el **modelo visual del sistema** (tokens + variantes de componentes) y el **input model** del nuevo `ConfirmDialogComponent`.

---

## 1. Tokens visuales nuevos (capa semántica)

Definidos en `src/styles.scss` dentro de `:root`. Apuntan a primitivos ya existentes para no introducir colores literales en SCSS de feature.

| Token | Tipo | Valor (alias) | Uso |
|-------|------|---------------|-----|
| `--t3-cta-bg` | color | `var(--t3-gold-500)` | Fondo del CTA primario habilitado. |
| `--t3-cta-bg-hover` | color | `var(--t3-gold-400)` | Fondo del CTA primario en hover/active. |
| `--t3-cta-text-on` | color | `var(--t3-text-on-gold)` | Texto sobre el CTA primario. |
| `--t3-cta-disabled-bg` | color | `rgba(232, 183, 58, 0.25)` | Fondo del CTA primario deshabilitado. |
| `--t3-cta-disabled-text` | color | `rgba(26, 26, 26, 0.55)` | Texto del CTA primario deshabilitado. |
| `--t3-btn-neutral-border` | color | `var(--t3-card-border)` | Borde de botones secundarios ("Volver", "Cancelar"). |
| `--t3-btn-neutral-text` | color | `var(--t3-gold-500)` | Texto de botones secundarios. |
| `--t3-btn-neutral-bg-hover` | color | `var(--t3-gold-bg-subtle)` | Fondo de botones secundarios en hover. |
| `--t3-segmented-bg` | color | `var(--t3-tabs-bg)` | Fondo del contenedor segmented. |
| `--t3-segmented-active-bg` | color | `var(--t3-gold-500)` | Fondo de la opción seleccionada. |
| `--t3-segmented-active-text` | color | `var(--t3-text-on-gold)` | Texto de la opción seleccionada. |
| `--t3-segmented-inactive-text` | color | `var(--t3-text-muted)` | Texto de opciones no seleccionadas. |
| `--t3-surface-overlay` | color | `rgba(6, 38, 24, 0.72)` | Backdrop del modal de confirmación. |

**Reglas de validación**:
- Estos tokens sólo se definen en `src/styles.scss` (ignorado por `pnpm lint:styles`).
- Cualquier consumo dentro de `src/app/**` debe ser exclusivamente `var(--t3-...)`.
- Los tokens primitivos (`--t3-gold-*`, `--t3-green-*`, etc.) no se renombran ni eliminan.

---

## 2. Variantes de botón tematizado

Las clases CSS conviven con el `<button>` nativo dentro del SCSS de cada componente que las usa (no se crea hoja global ni componente `T3ButtonComponent`).

| Clase | Variante | Estados | Tokens consumidos |
|-------|----------|---------|-------------------|
| `t3-btn t3-btn--primary` | CTA principal | default, hover, active, focus-visible, disabled, busy | `--t3-cta-bg`, `--t3-cta-bg-hover`, `--t3-cta-text-on`, `--t3-cta-disabled-bg`, `--t3-cta-disabled-text`, `--t3-shadow-gold`, `--t3-gold-400` (focus) |
| `t3-btn t3-btn--neutral` | Botón secundario / cancelar / volver | default, hover, active, focus-visible, disabled | `--t3-btn-neutral-border`, `--t3-btn-neutral-text`, `--t3-btn-neutral-bg-hover`, `--t3-gold-400` (focus) |
| `t3-btn t3-btn--destructive` | Acción destructiva confirmada | default, hover, active, focus-visible, disabled | `--t3-danger`, `--t3-danger-bg`, `--t3-danger-border`, `--t3-gold-400` (focus) |

Todas las variantes:
- `min-height: 44px` mobile, `48px` desktop sólo para `--primary`.
- Sin `text-transform: uppercase`.
- `border-radius: var(--t3-radius-md)`.
- `font-family: inherit; font-weight: 600`.

---

## 3. Modelo de entrada del `ConfirmDialogComponent`

Datos inyectados con `MAT_DIALOG_DATA`:

```ts
export interface ConfirmDialogData {
  /** Título visible (h2). Obligatorio. */
  title: string;

  /** Mensaje descriptivo opcional (p). */
  message?: string;

  /** Texto del botón de confirmación. Default: 'Confirmar'. */
  confirmLabel?: string;

  /** Texto del botón de cancelación. Default: 'Cancelar'. */
  cancelLabel?: string;

  /**
   * Variante visual de la acción de confirmación.
   * - 'destructive': estilo rojo (t3-btn--destructive).
   * - 'primary': estilo dorado (t3-btn--primary). Default.
   */
  variant?: 'destructive' | 'primary';
}
```

**Resultado del diálogo**: `boolean` — `true` si el usuario confirmó, `false` si canceló o presionó ESC (consistente con `ConfirmLogoutDialogComponent` actual).

**Validaciones**:
- `title` no vacío (validar en runtime con `throwError` si está vacío, evita silenciar typos).
- `variant` por default `'primary'`.

**Atributos ARIA**:
- `role="alertdialog"` cuando `variant === 'destructive'`; `role="dialog"` en otro caso.
- `aria-labelledby` apunta al `id` del título.
- `aria-describedby` apunta al `id` del mensaje cuando existe.

---

## 4. Modelo del segmented `SeriesFormatSelectorComponent` (sin cambios públicos)

API pública preservada:

```ts
@Component({...})
export class SeriesFormatSelectorComponent {
  readonly format = input.required<SeriesFormat>();
  readonly formatChange = output<SeriesFormat>();
}

// SeriesFormat ya existente en core/models/match.models.ts:
//   'BEST_OF_1' | 'BEST_OF_3' | 'BEST_OF_5'
```

Opciones renderizadas (orden fijo):

| `value` | `label` | `aria-label` |
|---------|---------|--------------|
| `BEST_OF_1` | "Mejor de 1" | "Mejor de 1 partida" |
| `BEST_OF_3` | "Mejor de 3" | "Mejor de 3 partidas" |
| `BEST_OF_5` | "Mejor de 5" | "Mejor de 5 partidas" |

**Reglas de juego respetadas**: sólo {1, 3, 5}. No se introduce un valor `2`/`4`/`7`. Si en el futuro se agregaran formatos, debe actualizarse `docs/CONTRATOS_API.md` y la constitution antes que la UI.

---

## 5. Modelo del guardarraíl

### 5.1 Regla stylelint (`.stylelintrc.json`)

```jsonc
{
  "extends": ["stylelint-config-standard-scss"],
  "rules": {
    "color-no-hex": true,
    "color-named": "never",
    "declaration-property-value-disallowed-list": {
      "/.*/": ["/^rgb\\(/", "/^rgba\\(/", "/^hsl\\(/", "/^hsla\\(/"]
    },
    ...
  }
}
```

Glob ampliado en `package.json`:

```jsonc
"scripts": {
  "lint:styles": "stylelint \"src/app/{features,shared/components}/**/*.scss\"",
  "lint:themes": "node scripts/check-themed-templates.mjs"
}
```

### 5.2 Script `scripts/check-themed-templates.mjs`

Recorre los archivos `*.html` bajo `src/app/{features,shared/components}/**` y reporta como error cualquier coincidencia con las siguientes expresiones (case-insensitive, fuera de comentarios HTML):

| Patrón | Mensaje |
|--------|---------|
| `color="primary"` / `color='primary'` | "Material primary palette en templates de feature/shared: usar variantes tematizadas (t3-btn--primary)." |
| `color="accent"` / `color="warn"` | Idem para accent/warn. |
| `\bmat-flat-button\b` | "mat-flat-button prohibido en superficies del producto: usar t3-btn." |
| `\bmat-raised-button\b` | Idem. |
| `\bmat-fab\b` / `\bmat-mini-fab\b` | Idem. |

El script exita con código 1 si encuentra al menos un match, y `0` en caso contrario. Imprime `file:line:col` por hallazgo.

Excepciones admitidas (lista blanca, configurable al inicio del script):
- `src/app/shared/components/confirm-dialog/**` — define la `panelClass` themed; no usa botones Material crudos pero usa `mat-dialog-*` legítimamente.

### 5.3 Integración pre-commit (`package.json` → `lint-staged`)

```jsonc
"lint-staged": {
  "*.ts": ["eslint --fix", "prettier --write"],
  "*.{html,scss,json}": ["prettier --write"],
  "src/app/{features,shared/components}/**/*.scss": ["stylelint --fix"],
  "src/app/{features,shared/components}/**/*.html": ["node scripts/check-themed-templates.mjs"]
}
```

---

## 6. Relación con el constitution

- Refuerza el principio I (tokens obligatorios) ampliando el glob de cobertura.
- Refuerza el principio III (CTAs) prohibiendo en lint los componentes Material que aplanan jerarquía.
- No introduce relaciones nuevas con el principio II (contratos API) — la feature no modifica DTOs.
