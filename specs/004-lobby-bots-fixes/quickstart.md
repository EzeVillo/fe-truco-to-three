# Quickstart — 004-lobby-bots-fixes

Pasos mínimos para validar la feature end-to-end en local.

## Prerrequisitos

- Node + pnpm 11 instalados.
- Backend `truco-to-three` corriendo en `http://localhost:8080`.
- Usuario con credenciales válidas en el backend.

## 1. Instalación y arranque

```bash
pnpm install
pnpm start  # http://localhost:4200
```

## 2. Verificación visual — CTA "Jugar contra bots"

1. Iniciar sesión y navegar a `/lobby`.
2. Abrir DevTools → modo responsive → 360 × 780 (mobile).
3. Verificar:
   - El CTA "Jugar contra bots" ocupa **≤ 96 px** de alto.
   - Título ("Jugar contra bots") y descripción ("Elegí tu oponente y configurá la serie") aparecen en **dos líneas distintas** con separación vertical visible.
   - Los colores del CTA son verdes/dorados de la paleta (no púrpura ni colores fuera de marca).
   - No hay scroll vertical dentro del lobby cuando ese es el único contenido.
4. Cambiar a 1440 × 900 (desktop):
   - El CTA mantiene `max-width: 640px` y proporciones de botón primario.
5. Inspeccionar SCSS computado: ningún valor de color es hex/rgb literal en archivos bajo `src/app/features/lobby/**`.

## 3. Verificación funcional — crear partida vs bot

1. Click en "Jugar contra bots" → llega a `/lobby/bots`.
2. Esperar que cargue el catálogo de bots.
3. Seleccionar un bot.
4. Mantener formato por defecto **"Mejor de 3"**.
5. Click en "Jugar".
6. En DevTools → Network, inspeccionar la request a `POST /api/matches/bot`:
   - Payload exacto: `{ "botId": "<uuid>", "gamesToPlay": 3 }`.
   - Sin campos extra.
   - Respuesta `200` con `{ "matchId": "<uuid>" }`.
7. La UI navega a `/match/<uuid>`.
8. Repetir con "Mejor de 1" (`gamesToPlay: 1`) y "Mejor de 5" (`gamesToPlay: 5`).

## 4. Verificación de errores

1. En DevTools, mockear respuesta 422 `InvalidGamesToPlayException` y verificar que la UI muestra el copy del catálogo (no el `message` del payload).
2. Mockear 404 `BotNotFoundException` → el catálogo se recarga y la selección se limpia.
3. Doble click sobre "Jugar" → solo una request sale al backend.

## 5. Verificación de guardarraíles

### Stylelint (colores hardcodeados)

```bash
# Introducir manualmente un hex code en un .scss de feature:
echo '.foo { color: #ffffff; }' >> src/app/features/lobby/pages/lobby-page/lobby-page.component.scss
pnpm lint:styles
# Debe fallar señalando la línea y sugiriendo usar var(--t3-…)
# Revertir el cambio.
```

### Contract test (DTO vs CONTRATOS_API.md)

```bash
pnpm test -- tests/contract/create-bot-match.contract.spec.ts
# Pasa con el contrato vigente.

# Romper a propósito:
# - Agregar un campo a CreateBotMatchRequest (p. ej. `visibility?: string`).
# - Volver a correr el test → falla con mensaje claro.
# Revertir el cambio.
```

## 6. Suite completa

```bash
pnpm lint
pnpm lint:styles
pnpm test
pnpm build
```

Todo debe pasar en verde antes de mergear.
