# Quickstart: Temporizador de turno en partida

**Feature**: 013-turn-timer

## Requisitos previos

- `pnpm install`
- Backend local en `http://localhost:8080` con la feature de temporizador implementada (emite
  `ACTION_DEADLINE_SET` / `ACTION_DEADLINE_CLEARED` y expone `actionDeadline` en el snapshot).

## Correr la app

```bash
pnpm start          # http://localhost:4200
```

## Cómo verificar manualmente

1. Iniciar una partida (vs bot o lobby) y entrar a la pantalla de partida.
2. **US1 — mi turno**: cuando sea tu turno, observar el indicador de progreso (anillo, sin número)
   sobre tu asiento, vaciándose en tiempo real. Verificar el énfasis de urgencia en los últimos 5 s.
3. **US1 — responder canto**: cantar/recibir truco o envido y verificar que el reloj corre sobre
   quien debe responder.
4. **US2 — turno del rival**: en el turno del rival, el indicador aparece sobre su asiento.
5. **Reinicio**: tras jugar/responder, el indicador se reinicia para el nuevo asiento obligado.
6. **A 0**: dejar correr el plazo propio hasta 0 → los controles de acción quedan deshabilitados y se
   muestra "tiempo agotado"; la derrota la confirma el backend (`MATCH_FORFEITED`), no la UI.
7. **Reconexión**: recargar (F5) a mitad de un turno → el indicador arranca en el tiempo restante
   correcto, no desde el total.
8. **Fin de partida**: al terminar/cancelarse la partida, el indicador desaparece.
9. **Responsive**: validar a 360 px y en desktop (≥ 1024 px) que el indicador no rompe el layout.

## Verificación automatizada

```bash
pnpm test           # unit (turn-timer.ts, reducer, derive-match-view) + contract
pnpm lint           # ESLint TS/HTML
pnpm lint:styles    # tokens CSS en SCSS de feature
pnpm build          # compilación Angular
```

Tests clave a cubrir:
- `turn-timer.spec.ts`: cálculo de `remainingMs` (vía `timestamp` y vía offset), umbral de urgencia,
  llegada a 0.
- `match-event.reducer.spec.ts`: `ACTION_DEADLINE_SET` setea los 3 campos; `ACTION_DEADLINE_CLEARED`
  los limpia; consistencia de invariante.
- `match-state.service.spec.ts`: los eventos del temporizador se rutean como derivados (no rompen
  `stateVersion`); cálculo del offset de reloj.
- `action-deadline.contract.spec.ts`: paridad de `eventType`/payloads con `docs/CONTRATOS_API.md` §9.6.
- `match-status-panel.component.spec.ts`: render del indicador sobre el asiento correcto y estado de
  urgencia.

## Done / criterios de aceptación

Ver `spec.md` → Success Criteria (SC-001…SC-006). En particular: indicador en el 100% de los turnos
activos, ≤ 1 s de diferencia con el backend, 0 falsos positivos de derrota originados en el cliente.
