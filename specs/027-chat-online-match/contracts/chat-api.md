# Contrato consumido — Chat (027)

Subconjunto del contrato del backend que esta feature consume. **Fuente autoritativa**:
`docs/CONTRATOS_API.md §7` (REST), §9.5d + §9.6 (WS), §11.1 (reconexión). Cualquier divergencia se
resuelve actualizando primero `docs/CONTRATOS_API.md` (constitución principio II).

El test de paridad vive en `src/tests/contract/chat.contract.spec.ts` (ver §4).

## 1. REST

### 1.1 Obtener chat por recurso padre — bootstrap / reconexión

```
GET /api/chats/by-parent/MATCH/{matchId}
Auth: Bearer
```

- `200` → `ChatView`:
  ```json
  {
    "chatId": "a1b2c3d4-...",
    "parentType": "MATCH",
    "parentId": "f47ac10b-...",
    "sendState": { "canSendNow": true, "nextMessageAllowedAt": null },
    "messages": [
      { "messageId": "d4e5...", "sender": "juancho", "content": "Buena mano!", "sentAt": 1772768158123 }
    ]
  }
  ```
- `400` si `parentType` no es exactamente `MATCH|LEAGUE|CUP|FRIENDSHIP`.
- `404` si no existe chat para ese recurso → **tratado como "sin chat"** (bot o aún no creado).
- `422` si el jugador no pertenece al chat.

### 1.2 Enviar mensaje por recurso padre

```
POST /api/chats/by-parent/MATCH/{matchId}/messages
Auth: Bearer
Body: { "content": "Buena mano!" }
```

- `201` → `SendMessageResponse`: `{ "chatId": "...", "sendState": { "canSendNow": false, "nextMessageAllowedAt": 1772768160123 } }`
- `404` si el chat no existe.
- `422` si: no participante, mensaje vacío, > 500 caracteres, **o rate limit (2s)**.
  - El error de rate limit usa `errorCode = ChatRateLimitExceededException` y **no** incluye
    `sendState`/`nextMessageAllowedAt`/`retryAfterMs`. Reconciliar con `GET` (§1.1).

> Alternativa por `chatId` (no usada por el MVP, documentada para paridad):
> `POST /api/chats/{chatId}/messages` → `200` mismo shape; `GET /api/chats/{chatId}/messages` →
> `200` mismo `ChatView`.

## 2. WebSocket — `/user/queue/chat`

Envelope: `{ chatId, eventType, timestamp, payload }`.

### 2.1 `CHAT_CREATED` (§9.6)

```json
{
  "chatId": "d4e5f6a7-...",
  "eventType": "CHAT_CREATED",
  "timestamp": 1772768158123,
  "payload": { "parentType": "MATCH", "parentId": "f47ac10b-..." }
}
```

- Se emite al crearse el chat (en `MATCH`, en el `GameStartedEvent` del primer game).
- **No** se emite para `FRIENDSHIP`, ni para partidas vs bot (no tienen chat).
- Disponibiliza el chat en el front cuando `payload.parentId === matchId` en curso.

### 2.2 `MESSAGE_SENT` (§9.6)

```json
{
  "chatId": "d4e5f6a7-...",
  "eventType": "MESSAGE_SENT",
  "timestamp": 1772768158123,
  "payload": { "sender": "juancho", "content": "Buena mano!", "sentAt": 1772768158123 }
}
```

- Llega a **todos** los participantes, incluido el emisor (por eso no se hace echo optimista).
- **No** incluye `messageId` (dedup en reconexión por `sentAt`).

## 3. Reconexión (§11.1)

1. Reconectar STOMP con JWT. 2. Re-suscribir `/user/queue/chat`. 3. Bufferar eventos.
4. `GET /api/chats/by-parent/MATCH/{matchId}`. 5. Aplicar el GET como base autoritativa.
6. Descartar `MESSAGE_SENT` con `sentAt ≤` último del GET; aplicar los posteriores.

## 4. Test de paridad (`src/tests/contract/chat.contract.spec.ts`)

Verifica con `satisfies` y `Object.keys(...)` que los tipos TS estén en paridad con el contrato:

- `ChatView` expone exactamente `{ chatId, parentType, parentId, sendState, messages }`.
- `ChatMessage` expone exactamente `{ messageId, sender, content, sentAt }`.
- `SendState` expone exactamente `{ canSendNow, nextMessageAllowedAt }`.
- `SendMessageResponse` expone exactamente `{ chatId, sendState }`.
- `ChatWsEvent` cubre `CHAT_CREATED` y `MESSAGE_SENT`; el payload de `CHAT_CREATED` es
  `{ parentType, parentId }` y el de `MESSAGE_SENT` es `{ sender, content, sentAt }` (sin
  `messageId`).
