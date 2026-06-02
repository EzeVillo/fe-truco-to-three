# Quickstart — Lobby público de matches (021)

Cómo verificar la feature de punta a punta, mapeado a las User Stories del spec.

## Requisitos

- Backend corriendo en `http://localhost:8080` con soporte de partidas públicas (`§1.5`, `§4.3`,
  `§9.4`).
- Front: `pnpm install && pnpm start` → `http://localhost:4200`.
- Dos usuarios autenticados (dos navegadores/perfiles) para ejercitar el flujo crear ↔ unirse.

## Flujo principal (US1 — listar y unirse, P1)

1. Usuario A crea una partida **Pública** (ver US2) y queda esperando rival.
2. Usuario B entra a **Lobby → Jugar online**. Verifica:
   - La partida de A aparece en la lista con host, formato (p. ej. "Mejor de 3") y "1/2".
   - El estado de carga se ve mientras llega la lista (SC-002: < 2 s).
3. Usuario B toca **Unirse** en esa partida → navega a `/match/:id` y la partida arranca sola
   (sin paso de "iniciar"). ✅ AC US1-1, US1-2.
4. **Estado vacío**: sin partidas públicas abiertas, B ve el mensaje vacío que invita a crear. ✅ US1-3.
5. **Error de carga**: cortar el backend y reabrir la pantalla → copy controlado + botón reintentar
   (nunca el mensaje crudo del BE). ✅ US1-4, SC-004.

## Race condition al unirse (Clarificación / FR-014)

1. Usuarios B y C ven la misma partida de A con un solo lugar.
2. B se une primero (la partida arranca). C toca **Unirse** un instante después.
3. Verifica en C:
   - Aparece un **toast no bloqueante** ("La partida se llenó justo antes de que entraras.").
   - C **permanece en el lobby** (no navega, no se abre diálogo).
   - La partida de A desaparece de la lista **cuando llega el delta** `PUBLIC_MATCH_LOBBY_REMOVED`,
     no por un refresco forzado en el error. ✅ AC US1-5.

## Crear partida pública (US2 — P2)

1. En **Jugar online**, sección "Crear partida": elegir **Pública** en el toggle de visibilidad y un
   formato de serie. Confirmar.
2. Verifica:
   - El usuario queda esperando rival (sala/estado de espera). ✅ AC US2-1.
   - En otro navegador, la partida aparece en el lobby público. ✅ AC US2-2.
3. Repetir eligiendo **Privada** → se genera código, **no** aparece en el lobby; el flujo actual
   (compartir código / unirse por código) se mantiene intacto. ✅ AC US2-3, FR-010.

## Tiempo real (US3 — P3)

1. Usuario B mantiene abierto el lobby.
2. Usuario A crea una partida pública → aparece en la lista de B **sin recargar** (SC-003: < 3 s).
   ✅ AC US3-1.
3. Esa partida se llena/cancela → desaparece de la lista de B sin recargar. ✅ AC US3-2.
4. Cambia `occupiedSlots` de una partida visible → la card se actualiza sin duplicarse. ✅ AC US3-3.
5. **Sin tiempo real**: con el WS caído, la lista sigue usable con carga inicial + reintento manual;
   al reconectar, se reconcilia (re-bootstrap). ✅ Edge cases.

## Responsive (SC-006)

- Verificar a **360 px** y en **desktop (≥ 1024 px)**: lista, cards, toggle y toast legibles y usables.
- `pnpm lint:styles` y `pnpm lint:hover` no deben fallar (tokens `--t3-…`, `:hover` gateado).

## Gates antes del PR

```bash
pnpm lint
pnpm lint:styles
pnpm lint:hover
pnpm test          # incluye el contract test nuevo de public-match-lobby
pnpm build
```
