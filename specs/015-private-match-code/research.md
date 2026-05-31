# Research — MVP de partida privada por código

Fase 0 del plan. Resuelve incógnitas técnicas y divergencias con `docs/CONTRATOS_API.md`. Cada
decisión sigue el formato Decisión / Razón / Alternativas consideradas.

---

## D1 — Estado `READY`: divergencia entre §8.2 y §4.2/§4.13

**Contexto**: El enum `MatchStatus` en `src/app/core/models/enums.ts` solo declara
`WAITING_FOR_PLAYERS | IN_PROGRESS | FINISHED`, alineado a §8.2 (`MatchStateResponse.status`). Pero
§4.2 dice "en PRIVATE, el segundo jugador entra y el match queda en `READY`" y §4.13 valida `leave`
sobre estados `WAITING_FOR_PLAYERS` o `READY`. La sala de espera privada necesita distinguir
"esperando rival" (`WAITING_FOR_PLAYERS`) de "listo para iniciar" (`READY`).

**Decisión**: Tratar `READY` como un estado de primera clase del modelo. Antes de codificar,
**verificar en runtime** qué `status` devuelve `GET /api/matches/{id}` para una privada con dos
jugadores. Según el resultado:
- Si el backend devuelve `READY` → agregar `READY` a `MATCH_STATUS` y **actualizar
  `docs/CONTRATOS_API.md §8.2`** para listarlo (Principio II: alinear el contrato primero).
- Si el backend nunca expone `READY` por REST (solo internamente) → la "prontitud" se deriva de
  `playerTwoUsername != null` con `status === 'WAITING_FOR_PLAYERS'`, y se documenta esa semántica en
  el contrato.

**Razón**: El Principio II exige paridad tipo↔contrato; la divergencia debe resolverse en la fuente
autoritativa, no parcheada en el cliente. La sala de espera necesita una señal inequívoca de
"rival presente" para habilitar Iniciar (FR-006).

**Alternativas consideradas**: Asumir `READY` sin verificar (riesgo de enum inválido y de romper el
contract test); ignorar `READY` y derivar todo de la presencia del rival (frágil si el BE además usa
`READY` para gatear `/start`).

---

## D2 — `playerTwoUsername` nullable en estados previos

**Contexto**: §4.14 dice que `playerTwoUsername` "puede ser `null` mientras la partida esté en
`WAITING_FOR_PLAYERS`". El tipo `MatchState.playerTwoUsername` hoy es `string` (no nullable), porque
hasta ahora solo se cargaban partidas `IN_PROGRESS` (bots).

**Decisión**: Cambiar `playerTwoUsername: string | null` en `MatchState`. Ajustar consumidores:
`derive-match-view` (mostrar placeholder "Esperando rival…" cuando es `null`), `reducer`
(`usernameFromSeat` solo se invoca con round activo, donde ya hay rival, pero se blinda devolviendo
`''` si fuese null) y `match-screen` (no abrir diálogos de juego en estado pre-juego).

**Razón**: Reflejar el contrato real evita crashes al renderizar la sala de espera del anfitrión
mientras está solo.

**Alternativas consideradas**: Mantener `string` y usar `''` como centinela (oculta el caso real y
contradice §4.14; rompería el contract test de paridad).

---

## D3 — Punto de entrada de UI: una página `online` con crear + unirse

**Contexto**: El lobby actual (`lobby-page`) solo tiene "vs bots" → `/lobby/vs-bots`. Hace falta
exponer crear partida online y unirse por código.

**Decisión**: Una sola ruta `/lobby/online` con `OnlineMatchPageComponent` que contiene dos
secciones: (a) **Crear** (reusa `SeriesFormatSelectorComponent` + botón crear) y (b) **Unirse**
(input de código + botón unirse). El `lobby-page` suma dos CTAs que navegan a esa página (o el CTA
"Unirme" puede anclar a la sección de unión). Tras crear o unirse con éxito, se navega a
`/match/:id`.

**Razón**: Minimiza superficie de rutas y componentes, es mobile-first (una pantalla, dos acciones) y
espeja el patrón ya conocido de `bots-config-page`. Crear y unirse comparten contexto ("jugar con un
amigo") y conviene tenerlos juntos.

**Alternativas consideradas**: Dos páginas separadas (`/online/create`, `/online/join`) — más
navegación sin beneficio; un `MatDialog` para unirse — peor testabilidad y consistencia con el resto
de flujos basados en página.

---

## D4 — Reutilización total de `MatchStateService` para estados pre-juego

**Contexto**: `MatchStateService.init(matchId)` ya hace: suscribir WS, `GET` snapshot, reconciliar
por `stateVersion`, manejar fin de partida y revancha. No está atado a bots.

**Decisión**: Reutilizarlo sin cambios estructurales. Al cargar una privada en `WAITING_FOR_PLAYERS`/
`READY`, el snapshot llega con `roundGame: null` y el servicio simplemente expone ese estado. No se
emite `matchEnded$` (solo se emite si `status === 'FINISHED'`). La sala de espera lee `state()`.

**Razón**: El servicio ya es agnóstico; reescribir sería duplicar lógica de reconciliación frágil.

**Alternativas consideradas**: Un servicio separado para la sala de espera (duplicación innecesaria
de suscripción WS y snapshot).

---

## D5 — Recuperación del `joinCode` para el anfitrión (FR-014)

**Contexto**: `POST /matches` devuelve `joinCode` (§4.1), pero `GET /api/matches/{id}` (§4.14) **no**
incluye `joinCode`. Tras navegar a `/match/:id` o tras recargar, el host no puede recuperar el código
desde el snapshot.

**Decisión**: (1) Pasar el `joinCode` del response de creación al `match-screen` vía **navigation
state** (`router.navigate(['/match', id], { state: { joinCode } })`). (2) Como mitigación ante
recarga, **persistir `joinCode` en `sessionStorage`** con clave `t3.joinCode.<matchId>` mientras el
host esté en la sala; limpiarlo al pasar a `IN_PROGRESS`, al cancelar o al salir. (3) Registrar como
**follow-up de contrato** la conveniencia de exponer `joinCode` en `GET /api/matches/{id}` para
partidas privadas no iniciadas; documentarlo en el contrato como gap conocido.

**Razón**: Cumple FR-014 (ver/copiar el código mientras se espera) y SC-002 sin depender de un campo
que el contrato no provee, manteniendo el front reactivo. `sessionStorage` (no `localStorage`) acota
el dato a la pestaña/sesión.

**Alternativas consideradas**: Solo navigation state (se pierde en recarga, incumple FR-014 robusto);
`localStorage` (persistencia excesiva de un código efímero); bloquear la feature hasta que el BE
exponga `joinCode` por GET (innecesario para el MVP).

---

## D6 — Transición reactiva `WAITING/READY → IN_PROGRESS`

**Contexto**: Ningún evento del reducer setea `status` a `IN_PROGRESS`. Hoy funciona porque los bots
cargan el snapshot ya `IN_PROGRESS`. En privado, el host inicia (`/start`) y el backend emite
`GAME_STARTED`, `ROUND_STARTED`, etc., pero **no hay** un evento `MATCH_STARTED` que cambie `status`.
Sin tratarlo, la sala de espera quedaría visible aunque el juego haya arrancado.

**Decisión**: En el reducer, el handler de `GAME_STARTED` además de resetear scores/round setea
`status: 'IN_PROGRESS'`. Es idempotente y correcto: si llega un game vivo, la partida está en curso;
para games 2+ de la serie el status ya era `IN_PROGRESS` (no-op).

**Razón**: Transición puramente reactiva, sin refetch ni lógica especial en el componente. Consistente
con el contrato (`GAME_STARTED` = primer game del match, §7 "chat creado en GameStartedEvent").

**Alternativas consideradas**: Refetch del snapshot al recibir `GAME_STARTED` (latencia extra y
posible carrera con el stream); que la sala "adivine" el inicio por la llegada de `ROUND_STARTED`
(menos explícito).

---

## D7 — Refresh de roster pre-juego y eventos de cancelación/salida

**Contexto**: Los eventos pre-juego son transaccionales (consumen `stateVersion`) pero hoy son no-op
en el reducer: `PLAYER_JOINED` (payload `{}`), `PLAYER_READY` (`{ seat }`), `MATCH_CANCELLED`
(`{}`), `MATCH_PLAYER_LEFT` (`{ leaverSeat }` = siempre `PLAYER_TWO`). Ninguno trae
`playerTwoUsername`, así que el host no puede mostrar el nombre del rival ni habilitar Iniciar solo
con el evento.

**Decisión**:
- **`PLAYER_JOINED` / `PLAYER_READY`**: `MatchStateService` dispara un **refresh de snapshot**
  (`GET /api/matches/{id}`) para traer `playerTwoUsername` y el `status` actualizado. Se expone un
  método `refresh()` que re-ejecuta el fetch sin reiniciar la reconciliación (mantiene
  `lastApplied`/`lastSeenVersion`). El reducer sigue avanzando `stateVersion` con el no-op, de modo
  que la secuencia no se rompe.
- **`MATCH_PLAYER_LEFT`**: el reducer setea `status: 'WAITING_FOR_PLAYERS'` y `playerTwoUsername:
  null` (el segundo jugador se fue antes de empezar, §4.13/§9.6). La sala vuelve a "esperando rival".
- **`MATCH_CANCELLED`**: el reducer setea `status: 'FINISHED'`-pre-juego no aplica; en su lugar
  `MatchStateService` emite por un nuevo `preGameClosed$` con motivo `CANCELLED`. `match-screen` se
  suscribe, muestra un aviso ("La partida fue cancelada") y navega al lobby.

**Razón**: El refresh es seguro porque en estado pre-juego los eventos son escasos. Mantener la
cancelación como un canal de notificación (no como un estado de tablero) simplifica el manejo en el
componente y evita confundirla con el fin de una partida jugada (que abre `GameWonDialog`).

**Alternativas consideradas**: Extender el reducer para llenar `playerTwoUsername` desde el evento
(imposible: `PLAYER_JOINED` no trae el username); refetch global con reinicio (rompería la
reconciliación de `stateVersion`).

---

## D8 — Inicio y salida: dónde viven las acciones REST

**Contexto**: `/start` y `/leave` (§4.5/§4.13) se disparan desde la sala de espera, que vive dentro de
`match-screen` (feature `match`). Crear/unirse viven en el lobby.

**Decisión**: `MatchesApiService` (en `features/lobby/services`, junto a `BotsApiService`) expone las
cuatro operaciones REST: `createPrivateMatch`, `joinByCode`, `startMatch`, `leaveMatch`. La sala de
espera (en `match`) inyecta este servicio para `start`/`leave`. Es un servicio `providedIn: 'root'`,
así que puede inyectarse desde cualquier feature sin acoplar módulos.

**Razón**: Centraliza el contrato de matches en un único servicio fino, evita duplicar URLs y facilita
el contract test. La ubicación en `lobby` es por origen del flujo, pero al ser root es transversal.

**Alternativas consideradas**: Dividir en dos servicios (matchmaking en lobby, acciones de sala en
match) — fragmenta el contrato de `/matches` sin beneficio; meter `/start`/`/leave` en
`MatchActionsService` (ese servicio es para acciones de juego in-game; mezclar responsabilidades).

---

## Resumen de cambios al contrato (`docs/CONTRATOS_API.md`)

Por Principio II, antes de tipar se actualiza el contrato donde diverge del runtime:
- §8.2: agregar `READY` a `MatchStateResponse.status` **si** runtime lo confirma (D1).
- §4.14: dejar explícito que `playerTwoUsername` es nullable en estados previos (ya lo dice en prosa;
  reflejarlo en el tipo) (D2).
- Gap conocido (follow-up, no bloqueante): `GET /api/matches/{id}` no expone `joinCode` (D5).
