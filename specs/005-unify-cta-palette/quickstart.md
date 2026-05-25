# Quickstart — Verificación local de la feature 005-unify-cta-palette

**Audiencia**: developer que toma la feature para implementarla, revisarla o verificarla.
**Pre-requisitos**: rama `005-unify-cta-palette` checkeada, `pnpm install` ejecutado.

---

## 1. Verificación de tooling y guardarraíles

```bash
# 1.1 Lint de estilos (cubre features + shared/components)
pnpm lint:styles

# 1.2 Lint de templates (mat-flat-button / mat-raised-button / color="primary|accent|warn")
pnpm lint:themes

# 1.3 Unit tests (incluye nuevos specs de ConfirmDialog + SeriesFormatSelector)
pnpm test

# 1.4 Build de producción
pnpm build
```

Los cuatro deben pasar sin errores. Si `lint:styles` o `lint:themes` reportan algo, el archivo y la línea ofensores se indican en stdout.

---

## 2. Verificación visual — pantallas alcanzadas

```bash
pnpm start   # http://localhost:4200
```

### 2.1 Lobby (`/lobby`)

- El CTA "Jugar contra bots" debe mantenerse igual (ya cumplía con tokens — sin regresiones).
- El botón "Salir" del header global abre el modal de confirmación con la paleta nueva.

### 2.2 Modal de cerrar sesión

Desde el header → "Salir":

- [ ] Backdrop: tono verde oscuro semi-transparente (no negro plano).
- [ ] Contenedor: fondo `--t3-card-bg`, esquinas `--t3-radius-lg`, sombra `--t3-shadow-card`.
- [ ] Botón "Cancelar": variante neutral (transparente, borde dorado tenue, texto dorado).
- [ ] Botón "Salir": variante destructive (rojo del sistema, no gris).
- [ ] ESC cierra y devuelve `false`.

### 2.3 Página vs-bot (`/lobby/bots`)

- [ ] Botón "Volver" (top-left): variante neutral, NO gris stock de Material.
- [ ] Selector "Mejor de N": tres opciones visibles. La activa con fondo dorado y texto oscuro; las inactivas con texto atenuado sobre fondo translúcido. No hay grises planos.
- [ ] CTA "Crear partida": dorado sólido cuando está habilitado; estado disabled con fondo dorado semitransparente y texto oscuro semitransparente — claramente distinguible.
- [ ] Spinner inline durante "Creando…": tinte oscuro sobre fondo dorado.

### 2.4 Modal de salida invocado desde vs-bot (si aplica)

- [ ] Misma paleta que el modal de logout. No hay diferencias visuales.

---

## 3. Verificación a 360 px (mobile floor)

DevTools → device toolbar → ancho 360 px:

- [ ] CTAs no se cortan ni desbordan.
- [ ] Modal cabe centrado con márgenes ≥ 16 px.
- [ ] Selector mantiene las tres opciones en una sola fila sin scroll horizontal.
- [ ] Altura del CTA primario ≤ 96 px.

---

## 4. Verificación a 1024 px (desktop)

DevTools → ancho 1024 px:

- [ ] El bottom-bar de `bots-config-page` pasa a fila (selector + CTA en la misma línea).
- [ ] El CTA primario tiene `min-width: 200px` (no full-width).

---

## 5. Verificación del guardarraíl (prueba de regresión dirigida)

```bash
# 5.1 Provocar fallo de stylelint
echo ".foo { color: #ff0000; }" >> src/app/features/lobby/pages/lobby-page/lobby-page.component.scss
pnpm lint:styles   # debe fallar
git checkout -- src/app/features/lobby/pages/lobby-page/lobby-page.component.scss

# 5.2 Provocar fallo del check de templates
echo '<button mat-flat-button color="primary">x</button>' >> src/app/features/lobby/pages/lobby-page/lobby-page.component.html
pnpm lint:themes   # debe fallar y reportar el archivo + línea
git checkout -- src/app/features/lobby/pages/lobby-page/lobby-page.component.html

# 5.3 Verificar pre-commit
# Reintroducir violación, hacer git add y git commit — el commit debe ser bloqueado.
```

---

## 6. Verificación de accesibilidad puntual

- En el modal: TAB se mueve sólo entre los dos botones; el primer foco recae en el botón seguro (Cancelar). Foco visible (outline dorado).
- En el selector: las flechas ←/→ navegan entre las tres opciones; ENTER/SPACE no son necesarios (el cambio de foco no cambia el value — se confirma con click/SPACE).
- `aria-modal=true`, `role` correcto según variant del dialog.

---

## 7. Criterios de aceptación (mapeo con la spec)

| Spec | Cómo verificar |
|------|----------------|
| FR-001, FR-002 | Sección 2.2 de este quickstart. |
| FR-003 | Sección 2.3 (Volver). |
| FR-004, FR-005 | Sección 2.3 (CTA Crear partida habilitado vs deshabilitado). |
| FR-006, FR-007, FR-008 | Sección 2.3 (selector) + revisar valores `BEST_OF_*`. |
| FR-009 | Secciones 3 y 4. |
| FR-010, FR-012, FR-013 | Sección 5. |
| FR-011 | Documentado en `contracts/themed-components.md` y `CLAUDE.md`. |
| FR-014 | Comparar copy actual con el previo: "Volver", "Crear partida", "Cancelar", "Salir", "Mejor de 1/3/5" sin cambios. |

Si todas las casillas marcan, la feature está lista para `/speckit-tasks`.
