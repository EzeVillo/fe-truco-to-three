# Flujos y notas para el frontend

> [← Volver al índice de contratos](../CONTRATOS_API.md)

## Flujo de autenticacion recomendado

### Usuarios persistidos

1. El FE llama a `/api/auth/register` o `/api/auth/login`.
2. Guarda `accessToken`, `refreshToken`, `playerId` y `username`.
3. Usa el `accessToken` como `Bearer` en todos los endpoints protegidos.
4. Antes de que expire, o al recibir `401`, llama a `/api/auth/refresh` con el `refreshToken`.
5. Reemplaza ambos tokens por los nuevos valores devueltos y actualiza `username` con la respuesta.
6. Si habia una conexion WebSocket activa, reconecta con el nuevo `accessToken`.
7. Si el FE recarga y conserva un `accessToken` valido pero no tiene `username`, llama a
   `GET /api/auth/me` para rehidratar la identidad de sesion.

### Guest

1. El FE llama a `/api/auth/guest`.
2. Guarda solo `accessToken`.
3. Usa ese `accessToken` como `Bearer` y para el frame STOMP `CONNECT`.
4. Guest no soporta refresh. Si expira, debe pedir una nueva sesion guest.

## Notas para FE

- Tratar enums como case-sensitive.
- `username` en auth es autoritativo en `register`, `login`, `refresh` y `GET /api/auth/me`.
- No decodificar `username` del access token: el JWT tiene `sub = playerId`, no username.
- Para rutas de join que requieren auth, conservar `returnTo`/`joinCode` antes de enviar al usuario
  a login/register. Despues de register no hace falta login adicional porque register ya devuelve la
  sesion completa.
- Manejar `204 No Content` en acciones de juego (sin body).
- Los eventos de liga (`LEAGUE_*`) llegan a **todos los participantes** de la liga, no solo a los
  dos jugadores de cada partido.
- Los eventos de copa (`CUP_*`) llegan a **todos los participantes** de la copa.
- El lobby publico es broadcast por `/topic/public-match-lobby`, `/topic/public-cup-lobby` y
  `/topic/public-league-lobby`.
- El snapshot inicial del lobby se obtiene por REST (`GET /api/*/public`); los topics publicos
  solo emiten deltas `PUBLIC_*_LOBBY_UPSERT` y `PUBLIC_*_LOBBY_REMOVED`.
- Las novedades sociales llegan por `/user/queue/social`; no reemplazan el flujo existente de
  `joinCode`, solo agregan targeting y UX mas rapida entre amigos.
- Al suscribirse a `/user/queue/social`, el backend envia `FRIEND_AVAILABILITY_STATE` para
  reconciliar
  la lista de amigos despues del bootstrap REST o una reconexion. Luego envia
  `FRIEND_AVAILABILITY_CHANGED` cuando cambia `availability`, `busyReason`, `online` o
  `spectatableMatch`.
- La disponibilidad social de amigos solo incluye `friendUsername`, `online`, `availability`,
  `busyReason` y `spectatableMatch` nullable. No incluye cartas, acciones disponibles ni estado
  privado de ronda.
- Los logros llegan por `/user/queue/profile` con evento `ACHIEVEMENT_UNLOCKED` y payload
  `{ achievementCode, unlockedAt, matchId, gameNumber }`.
- El FE debe suscribirse al lobby solo mientras esa pantalla este activa y desuscribirse al
  crear/unirse/navegar a un match, liga o copa.
- El backend no suprime eventos del lobby segun `playerId`; si el creador o participante no debe
  ver un item, esa exclusion es responsabilidad del lifecycle del cliente.
- Spectate se activa por WebSocket, no por REST: para empezar a mirar un match hay que suscribirse
  a `/user/queue/match-spectate` con header `matchId`.
- Para amigos, el `matchId` puede obtenerse de `GET /api/social/friendships` en
  `spectatableMatch.id`; la amistad confirmada habilita el alta igual que la pertenencia a
  liga/copa.
- Si la conexion WebSocket del espectador se corta o hace `UNSUBSCRIBE`, el backend deja de
  registrarlo como espectador de ese match (solo si no quedan otras sesiones activas del mismo
  usuario con esa suscripcion — ver comportamiento multi-dispositivo en _Flujo de
  spectate_ ([02-matches.md](02-matches.md))).
- `GET /api/matches/{matchId}/spectate` sirve para refrescar el snapshot de un espectador ya
  registrado. Si se consulta despues de perder la sesion de spectate, responde `422`.
- Mientras el usuario esta especteando, `busy = true` en `GET /api/me/presence` y el campo
  `spectating.matchId` indica el match que esta mirando. Esto permite al FE detectar la sesion
  activa y redirigir al usuario al match correcto al abrir una nueva pestaña o dispositivo.
- Estar especteando bloquea crear partidas, ligas, copas, buscar Quick Match y aceptar
  invitaciones sociales: el backend responde `422` con `PlayerIsSpectatingException`.
- En ligas, los partidos se crean **on-demand**: al iniciar la liga solo se crea el partido de la
  fecha 1. Cuando ese partido termina (o es forfeiteado), la liga activa automáticamente el
  siguiente partido elegible y envía un evento `LEAGUE_MATCH_ACTIVATED` a todos los participantes.
  Los fixtures con estado `SCHEDULED` son partidos futuros aún no creados.
- En copas, el bracket avanza automáticamente: cuando un partido termina se emite
  `CUP_MATCH_ACTIVATED` a todos los participantes con el siguiente partido a jugar.
  El FE puede consultar `GET /api/cups/{cupId}` para ver el estado completo del bracket.
- El **chat** se crea automáticamente al iniciar un match, liga o copa. Se elimina al finalizar
  o cancelarse el recurso padre. Para obtener el chat, usar
  `GET /api/chats/by-parent/{MATCH|LEAGUE|CUP|FRIENDSHIP}/{parentId}`. Los eventos de chat llegan
  por `/user/queue/chat`. El chat tiene un buffer circular de 50 mensajes y rate limit de 2
  segundos entre mensajes del mismo jugador.
- El DM de `FRIENDSHIP` es efimero: no persiste mensajes ni metadata. Se crea lazily la primera vez
  que se consulta y se pierde al reiniciar la aplicacion.
- El perfil de jugador se consulta por REST: `GET /api/profile/{username}` devuelve logros y stats
  agregados, sin repetir `username` ni exponer `playerId` en la respuesta. Las stats son
  eventual-consistent
  (se actualizan al recibir `MATCH_FINISHED`/`MATCH_ABANDONED`/`MATCH_FORFEITED`). Los logros
  en tiempo real siguen llegando por WebSocket (`/user/queue/profile`). Los guests no tienen
  perfil (404). La busqueda actual es case-insensitive.

### Reconexión WebSocket

Flujo recomendado para reconectar tras una desconexión:

1. Reconectar al WebSocket (`/ws` o `/ws-sockjs`) con el JWT en el frame STOMP `CONNECT`
2. Re-suscribirse a los canales relevantes (`/user/queue/match`, `/user/queue/league`, etc.)
3. **Bufferar** los eventos entrantes sin procesarlos todavía
4. Hacer `GET` del estado actual:

- Match: `GET /api/matches/{matchId}`
- Liga: `GET /api/leagues/{leagueId}`
- Copa: `GET /api/cups/{cupId}`
- Chat: `GET /api/chats/by-parent/{parentType}/{parentId}`

5. Aplicar el estado del GET como base autoritativa
6. Descartar eventos bufferados con `timestamp` anterior al GET; aplicar los posteriores

### Nota especifica para spectate

Si el cliente estaba en modo espectador y la conexion se cae:

1. Reconectar STOMP con el JWT vigente.
2. Re-suscribirse a `/user/queue/match-spectate` enviando otra vez `matchId` en la `SUBSCRIBE`.
3. Esperar el evento `SPECTATE_STATE`, que vuelve a registrar al espectador y trae el snapshot
   inicial.

No asumir que la sesion de spectate sigue viva tras una desconexion: el backend la limpia al
procesar `UNSUBSCRIBE` o `DISCONNECT` de la ultima sesion activa del usuario para ese match.

**Apertura desde nuevo dispositivo / pestaña:**

1. Al cargar, llamar `GET /api/me/presence`.
2. Si `spectating` es no-nulo, usar `spectating.matchId` para suscribirse a
   `/user/queue/match-spectate` con ese `matchId`.
3. El backend registra la segunda sesion sin incrementar el contador de espectadores (ya estaba
   registrado). Llega `SPECTATE_STATE` con el snapshot actual.
4. Si el primer dispositivo se desconecta despues, el backend **no** termina la sesion de spectate
   porque la segunda sigue activa. Solo se termina cuando se desconectan **todas** las sesiones del
   usuario que tenian abierta esa suscripcion.

### Revancha (Rematch)

- La revancha se abre automaticamente solo en matches **casuales** (no de liga ni copa). Despues de
  un `MATCH_FINISHED` en esos contextos no llega `REMATCH_AVAILABLE`.
- El evento `REMATCH_AVAILABLE` llega por `/user/queue/match` con el `matchId` de la partida que
  **termino** (no de la nueva). No hay canal WS separado para revancha.
- `expiresAt` en los payloads WS de revancha llega en `epochMillis`. En la respuesta REST
  (`GET /api/matches/{matchId}/rematch`) llega en `ISO-8601`. Prestar atencion al canal para
  parsear correctamente.
- Cuando el FE recibe `REMATCH_CONFIRMED`, el `newMatchId` viene directamente en el payload. El
  nuevo match ya está `IN_PROGRESS`; inmediatamente después llegan los eventos del nuevo match
  (`GAME_STARTED`, `ROUND_STARTED`, `TURN_CHANGED`, etc.) para ese `newMatchId`. No es necesario
  llamar a `POST /start` ni a `GET /api/matches/{matchId}/rematch` para obtener el id.
- Mientras la sesion este `OPEN`, el jugador tiene disponibilidad bloqueada: cualquier intento de
  crear o unirse a otra partida, liga, copa o aceptar una invitacion social devolvera `422` con
  `PlayerHasOpenRematchSessionException`. Mostrar mensaje orientativo.
- Si el bot es oponente, acepta automaticamente al abrirse la sesion: junto con
  `REMATCH_SESSION_OPENED` se emite un `REMATCH_OPPONENT_WANTS` con el bot como `actor`, de modo
  que el FE recibe por push que el oponente ya quiere revancha (mismo evento que para un humano).
  El bot no puede abandonar.
- La sesion expira por TTL configurable (por defecto `PT2M`). Tras `REMATCH_EXPIRED` la
  disponibilidad del jugador se libera automaticamente.
