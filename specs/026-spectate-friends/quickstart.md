# Quickstart: Espectar partidas de amigos

Guía de verificación manual y orden sugerido de implementación.

## Prerrequisitos

- Backend local en `http://localhost:8080` con soporte de spectate (§4.15/§4.16).
- Tres cuentas registradas: A (espectador), B y C (jugadores), con A amigo confirmado de B.
- B y C en una partida `IN_PROGRESS`.
- **Antes de tipar**: confirmar contra el BE si la vista de spectate incluye
  `playerOneUsername`/`playerTwoUsername`/`gamesToPlay` (research D1). Actualizar
  `docs/CONTRATOS_API.md` si corresponde.

## Orden sugerido de implementación

1. **Contrato + modelos** (Constitution II primero):
   - Verificar D1; actualizar `docs/CONTRATOS_API.md` si el BE diverge.
   - `core/models/spectate.models.ts` (SpectatableMatch, SpectateRoundState, SpectateMatchState).
   - `ws.models.ts`: `SpectateWsEvent` + `spectatableMatch` en items de disponibilidad.
   - `social.models.ts`: `FriendSummary.spectatableMatch`.
   - `src/tests/contract/spectate.contract.spec.ts` (paridad §4.15 + §7.4.5).
2. **Core WS**: `subscribe(destination, headers?)` en `websocket.service.ts` + su spec.
3. **Estado de spectate**: `spectate-api.service.ts` (GET /spectate), `spectate-state.service.ts`,
   `adapt-spectate-to-match-view.ts` + specs.
4. **Reuso del tablero**: input `spectator` en `GameBoardComponent` (oculta panel de acciones).
5. **Pantalla**: `SpectateScreenComponent` (reusa GameBoard, banner "Estás mirando", contador,
   botón "Dejar de mirar", manejo de error/fin) + ruta `spectate/:matchId`.
6. **Descubrimiento + entrada**: `social-api` mapea `spectatableMatch`; `social.store`
   merge/upsert lo conserva; `friend-row` botón "Mirar" + output; `friends-page` navega.
7. **Presencia / cross-device / busy**: agregar `spectating` a `presence.models.ts`
   (`PresenceSpectating`, `UserPresenceResponse`, rama `spectate` en `derivePresenceDestination`);
   `presence-coordinator.service.ts` → `targetUrl` case `spectate`; `FriendBusyReason 'SPECTATING'`
   + `busyReasonCopy`.
8. **Error copy**: scope `SPECTATE` + `spectateErrorCopy()`.

## Verificación manual (browser preview)

1. Con A logueado, abrir `/friends`. Con B en partida en curso, debe verse "Mirar" en la fila de B.
2. Click en "Mirar" → navega a `/spectate/:matchId`, muestra el tablero con el estado actual y el
   banner "Estás mirando" + contador de espectadores.
3. Que B o C jueguen una carta / canten → la mesa del espectador se actualiza en < 2 s.
4. Confirmar que A **no** ve cartas en mano de B ni de C, ni botones de acción.
5. El temporizador de turno se renderiza sobre el asiento que debe actuar.
6. Cortar la red de A y reconectar → la vista se restablece sola (re-`SPECTATE_STATE`).
7. "Dejar de mirar" → vuelve a `/friends`; A queda libre para mirar otra partida.
8. Intentar mirar la propia partida de A (no debe ofrecerse) o una no espectable → error copy del
   front, sin string crudo del BE.
9. Que termine la partida mientras A mira → resultado neutro inline ("Ganó X") + CTA para volver
   (sin modal de jugador). Verificar que el fin de game y la resolución de envido también se ven
   inline y neutros.
10. **Busy**: mientras A especta, sus acciones de crear/unirse/Quick Match/aceptar invitación no
    están disponibles; otro amigo ve a A como ocupado "Mirando una partida".
11. **Cross-device**: con A especteando en un dispositivo, abrir la app como A en otro dispositivo/
    pestaña → se lo lleva a `/spectate/:matchId` (vía presencia `spectating`). Al "Dejar de mirar"
    en uno, el otro sigue activo hasta cerrar la última sesión.

## Gates antes del PR

- `pnpm lint` · `pnpm lint:styles` · `pnpm test` (incluye el nuevo contract test) · `pnpm build`.
