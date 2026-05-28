# Quickstart — Verificación manual y automatizada

## Prerrequisitos

- Backend de truco-to-three corriendo en `http://localhost:8080`.
- `pnpm install` ejecutado.

## Verificación manual (caso motivador: bot juega rápido)

1. Arrancar el front:
   ```bash
   pnpm start
   ```
2. Login y crear una **partida vs bot** (`POST /api/matches/bot`, `gamesToPlay: 1`).
3. Jugar una carta como local: la carta debe aparecer en la mesa **al instante** (< 100 ms).
4. Esperar a que el bot responda. Cuando juegue su carta:
   - Si el bot encadena `CARD_PLAYED` + `TURN_CHANGED` rápido → la carta debe verse antes del indicador de turno, con ≥ 500 ms entre ambos.
5. Forzar un escenario de canto: jugar de mano y cantar truco. Si el bot rechaza con `NO_QUIERO`, esperar el siguiente fin de mano:
   - Debe verse primero la carta jugada por el bot, luego el canto/aceptación, **nunca** el panel de respuesta antes que la carta.
6. Provocar fin de partida: terminar 3 puntos. El dialog de "game ganado" debe aparecer **después** de que la última carta haya quedado visible en mesa.

## Verificación de no-regresión en otros canales

- Abrir chat en lobby mientras hay partida activa: mensajes deben llegar sin delay perceptible.
- Cambios de lobby (entrar/salir de salas): respuesta inmediata.

## Verificación automatizada

```bash
pnpm test src/app/features/match/services/match-event-queue.service.spec.ts
pnpm test src/app/features/match/services/match-state.service.spec.ts
pnpm lint
pnpm build
```

Esperados:
- Nuevo spec verde con casos de delay, local sin delay, flush, clear, coalescing de `TURN_CHANGED`.
- Spec existente de `MatchStateService` actualizado y verde.
- Sin warnings ni errores nuevos.

## Tuning de delays

Editar `src/app/features/match/config/match-event-delays.config.ts`. No requiere cambios en componentes consumidores.

## Rollback

- Revertir el commit que introduce `MatchEventQueueService` y los cambios en `MatchStateService`.
- No hay migraciones de datos ni cambios de contrato; el rollback es seguro en cualquier momento.
