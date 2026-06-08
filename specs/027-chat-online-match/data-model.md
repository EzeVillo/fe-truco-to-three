# Data Model — Chat en vivo para partidas online (027)

**Fuente**: `docs/CONTRATOS_API.md §7` (REST), §9.6 (eventos WS). Validar campo a campo
(constitución principio II). Todos los tipos nuevos viven en `src/app/core/models/chat.models.ts`,
salvo `ChatWsEvent` que se agrega a `src/app/core/models/ws.models.ts`.

## 1. Enums

```ts
// Reutilizar / alinear con el contrato. parentType es case-sensitive.
export type ChatParentType = 'MATCH' | 'LEAGUE' | 'CUP' | 'FRIENDSHIP';
```

> Para el MVP el front sólo usa `'MATCH'`. El tipo completo se modela para paridad de contrato
> (§8 `ChatParentType`), pero el código de la feature opera únicamente sobre `MATCH`.

## 2. DTOs REST

### 2.1 `SendState` (§7.1/§7.2/§7.3)

```ts
export interface SendState {
  /** true si el jugador puede enviar ahora. */
  canSendNow: boolean;
  /** epoch millis del próximo envío permitido; null cuando puede enviar. */
  nextMessageAllowedAt: number | null;
}
```

### 2.2 `ChatMessage` (item de `messages[]`, §7.2)

```ts
export interface ChatMessage {
  messageId: string;          // UUID — sólo presente en el GET (no en el WS)
  sender: string;             // username o displayName
  content: string;            // máx. 500 caracteres
  sentAt: number;             // epoch millis
}
```

### 2.3 `ChatView` (response de `GET by-parent` y `GET by chatId`, §7.2/§7.3)

```ts
export interface ChatView {
  chatId: string;
  parentType: ChatParentType;
  parentId: string;
  sendState: SendState;
  messages: ChatMessage[];    // hasta 50, orden cronológico
}
```

### 2.4 Envío de mensaje (§7.1/§7.4)

```ts
export interface SendMessageRequest {
  content: string;            // no vacío, máx. 500 caracteres
}

// Response del POST: NO incluye el mensaje (llega luego por WS MESSAGE_SENT).
export interface SendMessageResponse {
  chatId: string;
  sendState: SendState;
}
```

> `POST /api/chats/by-parent/MATCH/{matchId}/messages` responde `201`;
> `POST /api/chats/{chatId}/messages` responde `200`. Ambos con el mismo shape.

## 3. Eventos WebSocket — `ChatWsEvent` (`/user/queue/chat`, §9.6)

```ts
// Envelope de la cola chat: chatId top-level + eventType + timestamp + payload.
export type ChatWsEvent =
  | {
      chatId: string;
      eventType: 'CHAT_CREATED';
      timestamp: number;
      payload: { parentType: Exclude<ChatParentType, 'FRIENDSHIP'>; parentId: string };
    }
  | {
      chatId: string;
      eventType: 'MESSAGE_SENT';
      timestamp: number;
      payload: { sender: string; content: string; sentAt: number };
    };
```

Notas de contrato:
- `CHAT_CREATED` no se emite para `FRIENDSHIP` (§9.6).
- `MESSAGE_SENT` **no** trae `messageId` (a diferencia del GET). La dedup en reconexión se hace por
  `sentAt` (ver data-model §6).

## 4. Estado del store (`ChatStore`)

```ts
interface ChatState {
  /** matchId de la partida en curso para la que el store opera; null fuera de partida. */
  matchId: string | null;
  /** chatId conocido (de CHAT_CREATED o del GET); null = chat aún no disponible. */
  chatId: string | null;
  /** Mensajes en orden cronológico (máx. 50). */
  messages: ChatMessage[];
  /** Estado de envío del jugador (cooldown). */
  sendState: SendState;
  /** Panel lateral abierto/cerrado. */
  panelOpen: boolean;
  /** Bootstrap de reconexión en curso. */
  loading: boolean;
  /** Error de carga del historial (copy del front), si aplica. */
  error: string | null;
  /** Error de la última acción de envío (copy del front). */
  sendError: string | null;
}
```

Señales derivadas (computed):
- `available = computed(() => store.chatId() !== null)` — gating del botón del hamburguesa.
- `canSend = computed(() => store.sendState().canSendNow)` — habilitación del botón enviar
  (complementado por un timer que reevalúa al vencer `nextMessageAllowedAt`).

Estado inicial:

```ts
const INITIAL: ChatState = {
  matchId: null,
  chatId: null,
  messages: [],
  sendState: { canSendNow: true, nextMessageAllowedAt: null },
  panelOpen: false,
  loading: false,
  error: null,
  sendError: null,
};
```

## 5. Transiciones de estado

| Trigger | Efecto |
|---------|--------|
| `enterMatch(matchId)` | set `matchId`; suscribe `/user/queue/chat`; intenta bootstrap (GET) |
| `CHAT_CREATED` (parentId == matchId) | set `chatId` (si no estaba); chat queda disponible |
| `MESSAGE_SENT` (chatId actual) | append a `messages` si `sentAt` > último conocido (dedup §6) |
| `POST` aceptado | set `sendState` del response (arranca cooldown). NO append optimista |
| `POST` 422 rate limit | reconciliar: `GET by-parent` y aplicar su `sendState` |
| GET 200 (bootstrap/reconexión) | set `chatId`, `messages`, `sendState`; `loading=false` |
| GET 404 | sin chat (bot o aún no creado): `chatId` queda null; log, no error visible |
| `ws.connected` → true (re-conexión) | re-bootstrap (GET) para cerrar la brecha |
| `togglePanel()` | invierte `panelOpen` |
| `leave()` / cambio de match / MATCH_FINISHED | reset a `INITIAL`; desuscribe WS |

## 6. Reglas de reconciliación (idempotencia)

- **Mensaje propio**: no se inserta optimista; aparece al llegar `MESSAGE_SENT` (evita duplicado,
  FR-006).
- **Dedup GET ↔ WS**: tras un GET, descartar eventos `MESSAGE_SENT` bufferados/entrantes con
  `sentAt ≤ maxSentAt(messages del GET)` (§11.1: descartar eventos con timestamp anterior al GET).
- **Buffer de 50**: al hacer append, si se supera 50, descartar el más antiguo (espejo del buffer
  circular del BE; evita crecer sin límite en sesiones largas).
- **Orden**: `messages` se mantiene ordenado por `sentAt` ascendente.

## 7. Validaciones de cliente (pre-envío)

- `content.trim().length > 0` (no vacío) — FR-008.
- `content.length <= 500` — FR-008. Mostrar contador/aviso cerca del límite.
- Botón enviar deshabilitado mientras `!canSendNow` (cooldown) — FR-009/FR-010.

## 8. Mapeo de errores (copy del front, scope `'CHAT'`)

| Status | Caso | Copy (orientativo) |
|--------|------|--------------------|
| 401 | no autenticado | `''` (lo maneja el interceptor) |
| 404 | chat inexistente (bot / terminado) | bootstrap: silencioso; envío: "El chat ya no está disponible." |
| 422 | rate limit / no participante / contenido inválido | "Esperá un momento antes de enviar otro mensaje." (rate limit) · "No se pudo enviar el mensaje." (otros) |
| 0 / 5xx | red / servidor | "No pudimos enviar el mensaje. Reintentá." |
| default | — | `FALLBACK` |

> Nunca exponer `ApiError.message` (constitución / [[error-messaging]]).
