# Quickstart: Revancha al terminar una partida

**Feature**: 014-rematch-on-match-end

## Requisitos previos

- `pnpm install`
- Backend local en `http://localhost:8080` con la revancha implementada (abre la sesión al
  terminar un match casual, emite los eventos `REMATCH_*` y expone `GET …/rematch`).

## Correr la app

```bash
pnpm start          # http://localhost:4200
```

## Cómo verificar manualmente

> La revancha es event-driven: requiere **dos clientes humanos** para ver el flujo completo
> (aceptar / rechazar / confirmar). Contra bot, ver el punto 7.

1. Crear/entrar a una partida casual (lobby, dos jugadores) y jugarla hasta el final.
2. **Oferta secuencial**: al terminar aparece el modal de resultado; **al cerrarlo** se abre la
   oferta de revancha (diálogo aparte) con **"Revancha"** / **"Salir"** y el **tiempo restante
   real** de la ventana. La oferta nunca aparece simultánea al modal de resultado.
3. **Aceptar y esperar**: el jugador A toca "Revancha" → ve "Esperando al rival…".
4. **El rival quiere**: en la pantalla de A, cuando B acepta, aparece "El rival quiere revancha".
5. **Confirmación**: cuando ambos aceptan, ambos navegan automáticamente a la **nueva partida**
   (mismo rival, mismo formato de serie), ya en curso, sin pasos manuales.
6. **Rechazo/abandono del rival**: repetir hasta el paso 2; que B toque "Salir" → en A aparece
   "El rival no quiere revancha" y solo queda "Salir".
7. **Expiración**: dejar correr la ventana sin que ambos acepten → "La revancha venció" + "Salir".
8. **Contra bot**: jugar vs bot hasta el final → no aparecen estados de aceptación del rival; la UI
   no se queda "esperando" indefinidamente ni asume que el bot aceptó (no hay lógica de bot).
9. **Reconexión**: con la oferta visible, recargar (F5) → se restaura el estado correcto de la
   sesión (sigue abierta / ya decidiste / el rival decidió / expiró / confirmada) vía `GET …/rematch`.
10. **Responsive**: validar a 360 px y desktop (≥ 1024 px) que la oferta no rompe el layout.

## Verificación automatizada

```bash
pnpm test           # unit (rematch-state.service, rematch-view, rematch-offer) + contract
pnpm lint           # ESLint TS/HTML
pnpm lint:styles    # tokens CSS en SCSS de feature
pnpm lint:themes    # CTAs tematizados (no mat-*-button)
pnpm build          # compilación Angular
```

Tests clave a cubrir:
- `rematch.contract.spec.ts`: paridad de `eventType` `REMATCH_*`, forma de payloads (§9.6) y
  presencia de endpoints/DTO (§4.17); nota del dual-format de `expiresAt` (epochMillis WS vs ISO REST).
- `rematch-state.service.spec.ts`: reducción de cada evento sobre `session`; init por snapshot
  (incl. 404 = sin oferta); mapeo `playerOne/TwoChoice` → `self/opponentChoice` por `viewerSeat`;
  acciones optimistas; errores vía `getErrorCopy('REMATCH', …)`.
- `match-state.service.spec.ts`: los `REMATCH_*` se rutean por `rematch$` (no rompen `stateVersion`
  ni quedan atrapados en la cola ack-gated tras `MATCH_FINISHED`).
- `rematch-view.spec.ts`: derivados `canAccept`/`waitingForOpponent`/`opponentWants`/`opponentLeft`/
  `expired`/`confirmedMatchId`; normalización de `expiresAt`.
- `rematch-dialog.component.spec.ts`: estados de UI y botonera (`t3-btn`), navegación en `CONFIRMED`.
- `match-screen` (afterClosed): tras cerrar el resultado, abre la oferta si hay sesión o navega al
  lobby si no (incl. carrera: `getSession` puntual cuando el signal aún no llegó).
- `match-screen.component.spec.ts`: re-init por cambio de `matchId` (navegación a la revancha).

## Done / criterios de aceptación

Ver `spec.md` → Success Criteria (SC-001…SC-007). En particular: oferta al recibir
`REMATCH_AVAILABLE`, navegación automática a la nueva partida al confirmar, reflejo en tiempo real
de la decisión del rival, y 0 textos crudos de error del backend.
