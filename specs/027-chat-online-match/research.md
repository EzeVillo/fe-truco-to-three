# Research — Chat en vivo para partidas online (027)

**Fecha**: 2026-06-07 · **Fuente autoritativa**: `docs/CONTRATOS_API.md §7` (REST), §9.5d + §9.6
(eventos WS), §11.1 (reconexión).

## Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Disponibilización del chat | **Por evento `CHAT_CREATED`** (en vivo), no por GET especulativo |
| Recuperación tras refresh | GET `by-parent/MATCH/{matchId}` (patrón §11.1); 404 = sin chat (silencioso) |
| Gating bot vs online | No se ofrece chat si nunca llega `CHAT_CREATED`; bot nunca lo emite |
| Echo del mensaje propio | **No optimista**: el mensaje aparece al volver por `MESSAGE_SENT` |
| Cooldown | Derivado de `sendState.nextMessageAllowedAt` (epoch millis); sobrevive refresh |
| Arquitectura FE | Feature `features/chat` (store + api service + panel), espejo de `features/social` |

---

## D1 — ¿Cómo se entera el front de que el chat está disponible?

**Decisión**: suscribirse a `/user/queue/chat` al entrar a la partida y disponibilizar el chat
cuando llega `CHAT_CREATED` cuyo `payload.parentId` coincide con el `matchId` en curso.

**Evidencia de contrato**:
- §9.6: `CHAT_CREATED` → envelope `{ chatId, eventType, timestamp, payload: { parentType, parentId } }`.
  `parentType ∈ {MATCH, LEAGUE, CUP}`. No se emite para `FRIENDSHIP`.
- §7 (intro): "Match: chat creado en `GameStartedEvent` (primer game)... **Las partidas contra bots
  no generan chat.**"

**Rationale**: el `chatId` viene en el envelope y el `parentId` permite correlacionarlo con el
match actual sin ningún GET previo. En partidas vs bot el evento **nunca** llega → el acceso al chat
no se ofrece. Cero requests especulativas, cero 404 en el flujo normal.

**Alternativa descartada**: GET `by-parent` especulativo al entrar a cualquier match para detectar
existencia por 200/404. Rechazada: genera un 404 sistemático en todas las partidas vs bot.

---

## D2 — Recuperación del historial tras refresh / reconexión

**Decisión**: aplicar el patrón canónico de reconexión §11.1 — re-suscribir a `/user/queue/chat`,
bufferar, hacer `GET /api/chats/by-parent/MATCH/{matchId}`, aplicar el estado del GET como base y
descartar eventos bufferados con `timestamp` anterior. Un `404` se trata como "no hay chat"
(silencioso, sólo log): es el caso de refresh estando en una partida vs bot.

**Evidencia de contrato**:
- §11.1 paso 4 lista explícitamente `Chat: GET /api/chats/by-parent/{parentType}/{parentId}`.
- §7.3: `404` si no existe chat para ese recurso; `200` devuelve `{ chatId, parentType, parentId,
  sendState, messages[] }`.
- La cola de chat **no** re-emite `CHAT_CREATED` como snapshot al re-suscribirse (a diferencia de
  social, que sí re-emite `FRIEND_AVAILABILITY_STATE`). Por eso el historial requiere el GET.

**Rationale**: tras un refresh el `CHAT_CREATED` ya ocurrió; sin GET se perdería el historial de
hasta 50 mensajes (incumpliría FR-004/FR-014). El GET da `200` en online y `404` benigno en bot.

**Decisión de producto (confirmada con el usuario)**: el `404` residual del caso "refresh en partida
vs bot" se acepta como silencioso (sin cambios de backend). No se pide flag `vsBot`/`chatId` en el
snapshot del match para esta iteración.

---

## D3 — Echo del mensaje propio (evitar duplicados)

**Decisión**: **no** insertar el mensaje propio de forma optimista. El `POST` sólo devuelve
`{ chatId, sendState }` (no el mensaje). El mensaje propio vuelve a todos los participantes —
incluido el emisor— como `MESSAGE_SENT`, y es ahí cuando se agrega a la conversación.

**Evidencia de contrato**:
- §7.1: response del POST = `{ chatId, sendState }` (sin el mensaje).
- §7.1 nota: "El mensaje enviado sigue llegando por `/user/queue/chat` como `MESSAGE_SENT`."

**Rationale**: como el emisor también recibe su propio `MESSAGE_SENT`, el echo optimista
duplicaría. No hacer echo elimina el duplicado sin lógica de dedup compleja (FR-006).

**Dedup entre GET y WS (reconexión)**: el `GET` trae `messageId` por mensaje; el WS `MESSAGE_SENT`
**no** trae `messageId` (payload `{ sender, content, sentAt }`). Para reconciliar se usa `sentAt`
(epoch millis) como referencia: se descartan eventos con `sentAt` ≤ último `sentAt` del GET.

**Alternativa descartada**: echo optimista + dedup por messageId. Rechazada: el WS no expone
messageId, y el POST no devuelve el mensaje → no hay clave estable para deduplicar el echo.

---

## D4 — Cooldown del botón de enviar

**Decisión**: el estado del botón se deriva de `sendState`:
- `canSendNow === true` (o `nextMessageAllowedAt === null`) → habilitado.
- `canSendNow === false` → deshabilitado hasta `nextMessageAllowedAt` (epoch millis). El restante se
  calcula como `nextMessageAllowedAt - Date.now()` y se refresca con un timer hasta llegar a 0.

`sendState` se actualiza desde: (a) el response del `POST` (tras envío aceptado), (b) el `GET` de
bootstrap/reconexión.

**Evidencia de contrato**:
- §7 reglas: rate limit 2s entre mensajes del mismo jugador; `sendState.canSendNow` +
  `nextMessageAllowedAt` (epoch millis) "para reconstruir cooldown después de un refresh".
- §7.1/§7.2/§7.3: tanto lecturas como confirmaciones de envío incluyen `sendState`.

**Rationale**: usar el instante absoluto del servidor (epoch millis) hace que el cooldown sea
correcto incluso tras un refresh (FR-011), sin depender de relojes relativos del cliente.

**Caso rate limit (FR-012)**: §7 advierte que el error `422 ChatRateLimitExceededException` **no**
incluye `sendState` ni `nextMessageAllowedAt`. Si un POST falla por rate limit, se reconcilia el
cooldown releyendo el chat (`GET by-parent`).

---

## D5 — Arquitectura en el front

**Decisión**: nueva feature `src/app/features/chat/`, espejando `features/social`:
- `chat-api.service.ts` — capa REST (`GET`/`POST by-parent`).
- `chat.store.ts` — `signalStore({ providedIn: 'root' })`: suscripción WS gateada, gating por
  `CHAT_CREATED`, bootstrap de reconexión, estado de mensajes, `sendState`/cooldown y `panelOpen`.
- `components/chat-panel/` — drawer lateral derecho (lista + composer).
- Tipos en `core/models/chat.models.ts` y `ChatWsEvent` agregado a `core/models/ws.models.ts`.
- Copy de error: nuevo scope `'CHAT'` en `shared/error-copy/error-copy.ts`.

**Evidencia de patrón** (código existente):
- `SocialStore` (`features/social/services/social.store.ts`): suscripción WS con re-bootstrap al
  reconectar (`ws.connected`), reconciliación idempotente, `getErrorCopy('SCOPE', err)`.
- `WebSocketService.subscribe<T>('/user/queue/...')` + `ws.connect()` + `ws.connected` observable.
- `GlobalHeaderComponent`: menú hamburguesa con ítems gateados (`showAbandonMatch()`,
  `isSpectating()`), `currentMatchId` derivado de la URL.

**Rationale**: reutiliza convenciones probadas (NgRx Signals, gating de suscripción, copy de error
controlado) y respeta la constitución (tokens CSS, validación de contrato, copy de errores).

**Integración UI**:
- El botón "Chat" se agrega al panel del menú hamburguesa en `global-header.component.html`, visible
  sólo cuando `chatStore.available()` (es decir, hay `chatId` para el match en curso).
- El click togglea `chatStore.panelOpen`. El `<app-chat-panel>` se renderiza condicionalmente
  (drawer derecho). Quién lo monta: `match-screen` (contexto de partida).
- `match-screen` informa al store el ciclo de vida del match: `chatStore.enterMatch(matchId)` al
  resolver el `matchId` y `chatStore.leave()` al destruir/cambiar de match.

---

## Constraints confirmados

- 50 mensajes máx (buffer circular); 500 caracteres máx por mensaje; rate limit 2s (§7 reglas).
- Sólo participantes leen/escriben; guests y espectadores fuera de alcance (no participan del chat).
- Enums case-sensitive: `parentType` exactamente `MATCH` (§7.3 da `400` si no coincide).
- Copy de errores: nunca exponer `ApiError.message` (constitución / [[error-messaging]]).
- Tokens CSS `var(--t3-…)` obligatorios en el SCSS del panel (constitución principio I).
