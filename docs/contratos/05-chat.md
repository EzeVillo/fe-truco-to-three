# API REST - Chat

> [← Volver al índice de contratos](../CONTRATOS_API.md)

Ademas del chat de `MATCH`, `LEAGUE` y `CUP`, existe `FRIENDSHIP` como DM efimero entre amigos
aceptados. Ese chat vive solo en memoria: si la app reinicia, el historial se pierde y se recrea
vacio al volver a abrirlo.

Chat en tiempo real asociado a un match, liga o copa. Se crea automáticamente al iniciar el recurso
padre y se elimina al finalizar o cancelarse.

- **Match**: chat creado en `GameStartedEvent` (primer game), eliminado en `MatchFinishedEvent` o
  `MatchForfeitedEvent`. **Las partidas contra bots no generan chat.**
- **Liga**: chat creado en `LeagueStartedEvent`, eliminado en `LeagueFinishedEvent` o
  `LeagueCancelledEvent`
- **Copa**: chat creado en `CupStartedEvent`, eliminado en `CupFinishedEvent` o
  `CupCancelledEvent`

Reglas de negocio:

- Máximo **50 mensajes** por chat (buffer circular: al llegar al límite se descarta el más antiguo)
- Máximo **500 caracteres** por mensaje
- **Rate limit**: 2 segundos mínimo entre mensajes del mismo jugador
- Solo **participantes** del recurso padre pueden enviar y leer mensajes
- Las lecturas y confirmaciones de envio incluyen `sendState` para el jugador autenticado:
  `canSendNow` indica si puede enviar ahora y `nextMessageAllowedAt` es epoch millis del proximo
  envio permitido, o `null` cuando puede enviar.
- El error por rate limit conserva `errorCode = ChatRateLimitExceededException`, pero no incluye
  `sendState`, `nextMessageAllowedAt` ni `retryAfterMs`. Para reconciliar cooldown, leer el chat.

## Enviar mensaje

`POST /api/chats/{chatId}/messages`

Auth: Bearer requerido.

Request:

```json
{
  "content": "Buena mano!"
}
```

Response `200`:

```json
{
  "chatId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "sendState": {
    "canSendNow": false,
    "nextMessageAllowedAt": 1772768160123
  }
}
```

`sendState` representa el estado del remitente despues del envio aceptado. El mensaje enviado sigue
llegando por `/user/queue/chat` como `MESSAGE_SENT`.

Errores:

- `404` si el chat no existe
- `422` si el jugador no pertenece al chat, el mensaje está vacío, excede 500 caracteres, o
  viola el rate limit (2 segundos)

## Obtener mensajes por chatId

`GET /api/chats/{chatId}/messages`

Auth: Bearer requerido.

Response `200`:

```json
{
  "chatId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "parentType": "MATCH",
  "parentId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "sendState": {
    "canSendNow": true,
    "nextMessageAllowedAt": null
  },
  "messages": [
    {
      "messageId": "d4e5f6a7-b8c9-0123-4567-89abcdef0123",
      "sender": "juancho",
      "content": "Buena mano!",
      "sentAt": 1772768158123
    }
  ]
}
```

Errores:

- `404` si el chat no existe
- `422` si el jugador no pertenece al chat

## Buscar chat por recurso padre

`GET /api/chats/by-parent/{parentType}/{parentId}`

Auth: Bearer requerido.

Path params:

- `parentType`: `MATCH`, `LEAGUE`, `CUP` o `FRIENDSHIP`
- `parentId`: UUID del match, liga, copa o amistad

Response `200`: misma estructura que 7.2, incluyendo `sendState` para el jugador autenticado.

Errores:

- `400` si `parentType` no coincide exactamente con `MATCH`, `LEAGUE`, `CUP` o `FRIENDSHIP`
- `404` si no existe chat para ese recurso
- `422` si el jugador no pertenece al chat

Regla especial para `FRIENDSHIP`:

- si la amistad existe, esta `ACCEPTED` y el jugador autenticado participa, el backend crea el chat
  lazily la primera vez que se consulta (no persiste entre reinicios)

## Enviar mensaje por recurso padre

`POST /api/chats/by-parent/{parentType}/{parentId}/messages`

Auth: Bearer requerido.

Path params:

- `parentType`: `MATCH`, `LEAGUE`, `CUP` o `FRIENDSHIP`
- `parentId`: UUID del match, liga, copa o amistad

Request:

```json
{
  "content": "Buena mano!"
}
```

Response `201`:

```json
{
  "chatId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "sendState": {
    "canSendNow": false,
    "nextMessageAllowedAt": 1772768160123
  }
}
```

El `chatId` retornado permite al cliente navegar directamente al chat sin un GET extra. Para
`FRIENDSHIP`, el chat se crea lazily en el primer mensaje; para `MATCH`, `LEAGUE` y `CUP`, el chat
ya existe y se retorna su ID. `sendState` representa el estado del remitente despues del envio
aceptado.

Errores:

- `404` si el chat no existe (para `MATCH`/`LEAGUE`/`CUP`) o la amistad no aceptada (para
  `FRIENDSHIP`)
- `422` si el jugador no pertenece al chat, el mensaje esta vacio, excede 500 caracteres, o viola
  el rate limit (2 segundos)

## WebSocket

> Transporte (conexión, auth, envelope): ver [09-websocket.md](09-websocket.md).

Destino: `/user/queue/chat` — eventos de chat en tiempo real hacia los participantes del chat.

Envelope de chat (no lleva `stateVersion`):

```json
{
  "chatId": "d4e5f6a7-b8c9-0123-4567-89abcdef0123",
  "eventType": "MESSAGE_SENT",
  "timestamp": 1772768158123,
  "payload": {
    "sender": "juancho",
    "content": "Buena mano!",
    "sentAt": 1772768158123
  }
}
```

### eventType - Chat (`/user/queue/chat`, participantes del chat)

- `CHAT_CREATED` - chat creado automáticamente al iniciar match/liga/copa
- `MESSAGE_SENT` - un participante envió un mensaje

### Payloads por evento (chat)

- `CHAT_CREATED`: `{ parentType, parentId }` — `parentType`: `MATCH`, `LEAGUE` o `CUP`; `parentId`:
  UUID del recurso padre. No se emite para `FRIENDSHIP` (esos chats se crean lazily al consultar)
- `MESSAGE_SENT`: `{ sender, content, sentAt }` — `sender`: username/displayName del remitente;
  `content`: texto del mensaje; `sentAt`: `epochMillis`. No incluye `messageId` (solo disponible en
  REST vía `GET /api/chats/{chatId}/messages`) ni `sendState` (el cooldown solo va al remitente por
  REST, no por WebSocket)
