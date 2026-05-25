# Quickstart: Lobby post-login y creación de partida vs bots

**Branch**: `003-lobby-bots`

Guía rápida para arrancar la app y verificar manualmente el flujo de esta feature una vez
implementada.

## Pre-requisitos

- Node ≥ 20 y `pnpm` 11 (ver `CLAUDE.md` § Comandos esenciales).
- Backend corriendo en `http://localhost:8080` con los endpoints `GET /api/bots` y
  `POST /api/matches/bot` operativos.
- Al menos 1 usuario registrado y, opcionalmente, ≥ 12 bots en el catálogo para validar
  la US3 (scroll cómodo, grilla responsiva).

## Pasos

1. Instalar dependencias:
   ```bash
   pnpm install
   ```
2. Levantar el front (puerto 4200):
   ```bash
   pnpm start
   ```
3. Abrir `http://localhost:4200`.

## Flujo a verificar

### US1 — Lobby post-login
1. Sin sesión: ir a `http://localhost:4200/lobby` → debe redirigir a `/login`.
2. Iniciar sesión con un usuario válido → redirige automático a `/lobby`.
3. En el lobby: el **header global sticky** muestra marca + username + acción "Salir";
   el cuerpo muestra una sola tarjeta/CTA "Jugar contra bots".
4. Hacer click en "Salir" → aparece el diálogo "¿Cerrar sesión?". "Cancelar" lo cierra;
   "Salir" limpia la sesión y redirige a `/login`.
5. Volver a iniciar sesión; abrir directamente `http://localhost:4200/lobby` → ya no
   pide login.

### US2 — Configurar y crear partida vs bots
1. Desde el lobby, click en "Jugar contra bots" → navega a `/lobby/vs-bots`.
2. La pantalla muestra el catálogo de bots y, anclada abajo, la **bottom action bar** con
   selector "Mejor de 1 / 3 / 5" (preseleccionado **Mejor de 3**) y botón "Crear partida"
   **deshabilitado**.
3. Click en una tarjeta de bot → queda seleccionada (feedback visual); CTA se habilita.
4. Click en otra tarjeta → la selección se mueve (radio).
5. Cambiar a "Mejor de 5".
6. Click en "Crear partida" → CTA se deshabilita y muestra estado de carga.
7. Al recibir `{ matchId }`, el browser navega a `/match/<uuid>` (si la feature de partida
   aún no existe, caerá al `'**'` redirect — comportamiento provisorio, ver D-009 en
   `research.md`). El POST a `/api/matches/bot` debe verse en DevTools → Network con
   payload `{ botId, gamesToPlay: 3 }`.

### US3 — Catálogo cómodo
1. Con ≥ 12 bots: scrollear hasta el final → la **última tarjeta** debe ser totalmente
   visible (no la tapa la bottom bar).
2. Resize del viewport a 360 px → grilla en columnas compactas; tap targets confortables.
3. Resize a 1440 px → grilla de varias columnas.

### Edge cases para validar manualmente
- **Catálogo vacío**: mockear `GET /api/bots` → `[]`. Debe mostrar estado vacío y CTA
  deshabilitado.
- **Error de catálogo**: matar el BE → debe mostrar copy de catálogo + botón "Reintentar".
- **404 al crear**: forzar `POST /api/matches/bot` → 404. UI muestra copy 404, recarga
  catálogo, resetea selección.
- **Doble tap CTA**: tap rápido x2 → solo se dispara 1 POST.

## Tests automatizados

```bash
pnpm test        # corre Vitest
pnpm lint        # ESLint (debe pasar limpio)
```

Suites esperadas tras `/speckit-tasks` + `/speckit-implement`:
- `error-copy.spec.ts` — mapeo HTTP → copy.
- `bots-api.service.spec.ts` — HTTP mocks.
- `bots-config-page.component.spec.ts` — selección radio, habilitado del CTA, manejo
  de éxito/error.
- `global-header.component.spec.ts` — visibilidad condicional y diálogo de logout.

## Notas

- Sin WebSockets en esta feature (FR-017).
- La feature consume `AuthStore` existente y reutiliza `jwtInterceptor` +
  `refreshInterceptor` para auth y manejo silencioso de 401.
