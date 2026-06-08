# Quickstart — Chat en vivo para partidas online (027)

Cómo verificar la feature de punta a punta, y los gates obligatorios antes de PR.

## Pre-requisitos

- Backend corriendo en `http://localhost:8080` con WS en `/ws-sockjs`.
- `pnpm install` y `pnpm start` (front en `http://localhost:4200`).
- Dos usuarios registrados (no guests) para probar el chat 1v1.

## Flujo feliz (US1 + US2 + US3)

1. **Crear partida online**: usuario A crea una partida (lobby online / quick match / invitación) y
   usuario B se une. La partida arranca `IN_PROGRESS` (llega el primer `GAME_STARTED`).
2. **Disponibilización**: al arrancar el game, ambos reciben `CHAT_CREATED` por `/user/queue/chat`.
   → En el menú hamburguesa aparece el ítem **"Chat"** (antes no estaba).
3. **Abrir panel** (US1): click en "Chat" → se despliega el panel lateral derecho. Sin mensajes aún
   → estado vacío.
4. **Enviar** (US3): A escribe y envía. El botón enviar entra en **cooldown** (~2s). El mensaje
   aparece en el panel de A cuando vuelve por `MESSAGE_SENT` (no antes — no hay echo optimista).
5. **Recibir en vivo** (US2): el mensaje de A aparece en el panel de B en segundos, sin recargar.
6. **Cooldown tras refresh** (US3): A envía y, durante el cooldown, recarga la página. Al reabrir el
   chat, el botón sigue bloqueado el tiempo restante (reconstruido desde `sendState`).

## Casos borde a verificar

- **Partida vs bot**: crear partida contra bot (`POST /api/matches/bot`). El ítem "Chat" **nunca**
  aparece. En Network no debe haber requests a `/api/chats/...` (salvo el caso de refresh, ver
  abajo).
- **Refresh en partida vs bot**: recargar dentro de una partida vs bot. El bootstrap de reconexión
  hace `GET by-parent/MATCH/{id}` → `404`. Debe ser **silencioso** (sólo `console`/log), sin
  snackbar ni error visible, y el ítem "Chat" no aparece.
- **Refresh en partida online**: recargar a mitad de partida. El historial (hasta 50) se recupera
  vía `GET by-parent` y el panel vuelve a mostrar la conversación.
- **Rate limit**: enviar dos mensajes muy seguidos. El segundo se bloquea por la UI (cooldown). Si
  llega un `422 ChatRateLimitExceededException`, el cooldown se reconcilia releyendo el chat.
- **Límite 500 caracteres**: pegar > 500 caracteres → no se puede enviar; aviso claro.
- **Fin de partida**: al `MATCH_FINISHED`/abandono, el chat se cierra/limpia (el recurso padre se
  elimina en el BE).

## Gates obligatorios (constitución §Gates de Calidad)

```bash
pnpm lint          # ESLint TS/HTML
pnpm lint:styles   # SCSS del panel sólo con var(--t3-…)
pnpm lint:hover    # :hover gateado tras @media (hover: hover)
pnpm lint:themes   # sin mat-flat-button / color="primary|accent|warn"
pnpm test          # unit + contract (incluye chat.contract.spec.ts)
pnpm build         # compila sin errores
```

## Checklist de aceptación

- [ ] El ítem "Chat" aparece sólo en partidas online con `CHAT_CREATED` recibido.
- [ ] El panel se despliega desde la derecha y se cierra sin perder la conversación.
- [ ] El historial (hasta 50) carga en < 2s (SC-001).
- [ ] Un mensaje del rival aparece en < 2s sin acción manual (SC-002).
- [ ] Imposible enviar durante el cooldown (SC-003).
- [ ] El cooldown sobrevive a un refresh con ≤ 1s de error vs servidor (SC-004).
- [ ] En partidas vs bot el chat nunca aparece (SC-005).
- [ ] Ningún error muestra texto crudo del backend (SC-006).
- [ ] Responsive: usable desde 360px y en desktop.
