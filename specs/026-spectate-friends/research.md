# Phase 0 Research: Espectar partidas de amigos

Fuente de contrato: `docs/CONTRATOS_API.md` §4.15, §4.16, §7.4.5, §9.3, §9.5g, §9.6, §11.2.

## D1 — Roster (seat → username) y serie en la vista de spectate ✅ RESUELTO por contrato

**Decisión**: Tipar `playerOneUsername`, `playerTwoUsername` y `gamesToPlay` directamente desde la
vista pública. **Resuelto** (clarificación 2026-06-06): el contrato `docs/CONTRATOS_API.md` §4.15
fue actualizado e incluye:
- `playerOneUsername: string`
- `playerTwoUsername: string | null` (`null` si todavía no hay rival sentado)
- `gamesToPlay: number` (best-of; coincide con la vista de jugador §4.14)

`SPECTATE_STATE` (§9.6) hereda la forma porque `payload.matchState` "respeta la forma de
`GET /api/matches/{matchId}/spectate`".

**Rationale**: Es información pública; el BE la expone. Sin fallback "Jugador 1/2": el adapter usa el
roster real. `playerTwoUsername` nullable se maneja como en la vista de jugador (§4.14).

**Alternativas consideradas (ya descartadas)**: derivar nombres de `currentTurn`/`mano`/`winner` o
pasar `friendUsername` desde la lista — innecesario ahora que el roster viaja en la vista.

## D2 — Suscripción STOMP con header nativo `matchId`

**Decisión**: Extender `WebSocketService.subscribe<T>(destination, headers?)` para aceptar headers
nativos opcionales en el frame `SUBSCRIBE`, pasándolos a `client.subscribe(destination, cb, headers)`.

**Rationale**: §9.3 exige el header `matchId` en el `SUBSCRIBE` a `/user/queue/match-spectate`. El
`subscribe` actual ([websocket.service.ts:74](../../src/app/core/services/websocket.service.ts))
no acepta headers. `@stomp/stompjs` soporta `client.subscribe(dest, cb, headers)` nativamente. La
firma con parámetro opcional es retrocompatible con todos los llamadores actuales (match, social,
presence, lobby).

**Alternativas consideradas**: método separado `subscribeWithHeaders` — rechazado por duplicar la
lógica de reconexión/parse ya encapsulada en `subscribe`.

## D3 — Modelo de la vista pública: tipo propio, no reusar `MatchState`

**Decisión**: Tipar `SpectateMatchState` y `SpectateRoundState` propios (en `core/models/spectate.models.ts`)
que reflejen exactamente §4.15: sin `myCards`, sin `availableActions`, sin `viewerSeat`; con
`currentRound` (no `roundGame`), `spectatorCount` y `stateVersion`. Para renderizar, un adapter puro
convierte `SpectateMatchState` → `MatchState`/`MatchView` (myCards `[]`, availableActions `[]`,
`viewerSeat` fijo a `PLAYER_ONE` como perspectiva neutra del espectador).

**Rationale**: Mantiene la fidelidad al contrato (el test de contrato valida la forma pública) y
evita que campos privados se "cuelen" en la vista de espectador. El adapter aísla el reuso del
tablero. `viewerSeat = PLAYER_ONE` es solo una convención de render: PLAYER_ONE abajo, PLAYER_TWO
arriba; ninguno muestra cartas en mano porque `myCards` es `[]` y el modo espectador oculta el panel.

**Alternativas consideradas**: reutilizar `MatchState` directamente con campos vacíos — rechazado:
borra la distinción contractual y arriesga asumir `myCards`/acciones que el espectador nunca recibe.

## D4 — Reconciliación de eventos: reusar reducer + re-fetch por stateVersion

**Decisión**: Reusar `applyMatchEvent` ([match-event.reducer.ts]) sobre el `MatchState` adaptado.
Los eventos re-difundidos al espectador (§9.5g: `CARD_PLAYED`, `TURN_CHANGED`, `TRUCO_*`, `ENVIDO_*`,
`SCORE_CHANGED`, `ROUND_*`, `GAME_*`, `MATCH_FINISHED/ABANDONED/FORFEITED`, `FOLDED`, más
`ACTION_DEADLINE_SET/CLEARED` y `SPECTATOR_COUNT_CHANGED`) son seat-based (no viewer-relativos), así
que el reducer aplica sin depender de `viewerSeat`. Ante hueco de `stateVersion` o evento fuera de
orden, re-fetch del snapshot vía `GET /api/matches/{id}/spectate` (mismo patrón que
`MatchStateService.triggerRefetch`).

**Rationale**: Evita duplicar la lógica de aplicación de eventos del juego. `PLAYER_HAND_UPDATED` y
`AVAILABLE_ACTIONS_UPDATED` **no** se re-difunden al espectador (§9.5g), por lo que `myCards`/acciones
permanecen vacíos sin esfuerzo extra. **Subordinado a D1**: el reducer toca scores/ronda, no el
roster, así que funciona aunque el roster se resuelva por separado.

**Alternativas consideradas**: reducer propio de spectate — rechazado por redundante; los payloads
son idénticos a los del canal `/user/queue/match`.

## D5 — Re-alta de espectador en reconexión

**Decisión**: Observar `WebSocketService.connected`; al reconectar, re-suscribir a
`/user/queue/match-spectate` con el header `matchId` y esperar el nuevo `SPECTATE_STATE` (que
re-registra y trae snapshot). Mientras tanto, marcar `loading` y limpiar buffers, igual que
`MatchStateService`.

**Rationale**: §11.2 — el backend limpia la sesión de spectate al desconectar/UNSUBSCRIBE; no
sobrevive. El re-alta automático cumple FR-010/SC-004. El patrón de watch de `connected` ya está
probado en `MatchStateService` y `SocialStore`.

**Alternativas consideradas**: refrescar solo por REST sin re-suscribir — rechazado: el REST
devuelve 422 si la sesión de spectate se perdió (§4.15), así que primero hay que re-registrarse por
WS.

## D6 — Manejo de `SPECTATE_ERROR` y errores REST

**Decisión**: `SPECTATE_ERROR` (payload `{ error }`, WS) y los errores de `GET /spectate`
(404/422) se mapean a copy del front. Agregar scope `SPECTATE` a `getErrorCopy()` para el path REST
y un helper `spectateErrorCopy(rawError?: string)` que ignora el `error` crudo y devuelve un mensaje
amigable genérico ("No pudiste entrar a mirar esta partida. Puede que ya haya terminado.").

**Rationale**: Regla de copy de errores (Constitution): nunca exponer el string crudo del backend.
`SPECTATE_ERROR` no es un `HttpErrorResponse`, por eso necesita un mapper aparte del switch por
status.

**Alternativas consideradas**: mostrar el `error` del WS directo — rechazado por la regla del
proyecto.

## D7 — Reuso del tablero: input `spectator` en `GameBoardComponent`

**Decisión**: Agregar un input booleano `spectator` (default `false`) a `GameBoardComponent`. En
modo espectador: no se renderiza `AvailableActionsPanelComponent` y ninguno de los dos asientos
muestra cartas en mano (ambos como "oponente"/dorso). El resto (cartas jugadas, marcador, cantos,
temporizador) se reusa tal cual.

**Rationale**: Es el reuso de menor fricción: el tablero ya consume `MatchView`; con `myCards: []`
las áreas de mano quedan vacías y el flag oculta el panel de acciones. Evita duplicar el árbol
(`opponent-area`, `played-cards-area`, `match-status-panel`).

**Alternativas consideradas**: pantalla/tablero de espectador totalmente separados — rechazado por
duplicación y divergencia futura del marcador y del temporizador.

**Hitos (clarificación 2026-06-06)**: el espectador **no** reusa `GameWonDialog` ni
`EnvidoResultDialog` (marco "ganaste/perdiste", propio del jugador). Fin de partida, fin de game y
resolución de envido se muestran **neutros e inline** en `SpectateScreenComponent` (FR-014): fin de
partida = "Ganó X" + CTA volver; game/envido = indicador inline sin bando. El `SpectateStateService`
expone los eventos de hito (`MATCH_FINISHED/ABANDONED/FORFEITED`, `GAME_SCORE_CHANGED`,
`ENVIDO_RESOLVED`) pero la pantalla los renderiza inline, no como modales.

## D8 — Descubrimiento: `spectatableMatch` en el modelo social

**Decisión**: Incorporar `spectatableMatch: SpectatableMatch | null` a `FriendSummary` y a los items
de disponibilidad WS (`FriendAvailabilitySnapshotItem`/`FriendAvailabilityDelta`). El `social.store`
lo conserva en `mergeAvailability`/`upsertFriend`; `social-api` lo mapea en `listFriends`. El
`friend-row` deriva `canSpectate = spectatableMatchId !== null` y emite `spectate`.

**Rationale**: §7.4.5 ya expone `spectatableMatch.id`; la feature 025 lo dejó fuera de alcento a
propósito (documentado en [social.models.ts:24](../../src/app/core/models/social.models.ts)). Esta
feature lo activa. Los deltas `FRIEND_AVAILABILITY_CHANGED` ya incluyen `spectatableMatch` (§9.6),
así que el botón "Mirar" aparece/desaparece en vivo.

**Alternativas consideradas**: un endpoint/llamada aparte para descubrir partidas espectables —
rechazado: el dato ya viaja en la lista de amigos y sus deltas.

## D9 — Ruta y navegación

**Decisión**: Nueva ruta `spectate/:matchId` (lazy, `authGuard`) → `SpectateScreenComponent`. El
`friend-row` → `friends-page` navega con `router.navigate(['/spectate', matchId])`. "Dejar de mirar"
navega de vuelta a `/friends`.

**Rationale**: Sigue el patrón de `match/:matchId`. Mantener spectate en su propia ruta evita
colisionar con la lógica de jugador de `MatchScreenComponent` y permite lazy-load.

**Alternativas consideradas**: reusar `match/:matchId` con un query param `?spectate` — rechazado:
`MatchScreenComponent` asume pertenencia al match (viewerSeat, acciones, revancha) y mezclar ambos
modos lo vuelve frágil.

## D10 — Retorno cross-device vía presencia ✅ soportado por contrato

**Decisión**: Consumir `presence.spectating.matchId` para devolver al usuario a la pantalla de
espectador en cualquier sesión/dispositivo. Extender `derivePresenceDestination`
([presence.models.ts](../../src/app/core/models/presence.models.ts)) con una rama
`{ kind: 'spectate'; matchId }` y `PresenceCoordinatorService.targetUrl`
([presence-coordinator.service.ts:129](../../src/app/core/services/presence-coordinator.service.ts))
con `case 'spectate' → /spectate/${matchId}`. Agregar `spectating: PresenceSpectating | null` a
`UserPresenceResponse`.

**Rationale**: §7.6.1/§7.6.2 — `GET /api/me/presence` y el push `PRESENCE_UPDATED` ya exponen
`spectating.matchId` (no-nulo mientras haya ≥1 suscripción de spectate). El presence-coordinator ya
auto-navega por destino; reusar ese mecanismo da el retorno cross-device sin trabajo nuevo de
navegación. Mutuamente excluyente con `match`/`rematch` (no se puede espectar y jugar a la vez), así
que la rama se ubica después de las de jugador sin riesgo. Al salir (UNSUBSCRIBE), presence emite
`spectating: null` → destino `none` → no fuerza navegación (el usuario se queda donde está).

**Alternativas consideradas**: persistir el matchId espectado en el cliente (localStorage) —
rechazado: la presencia es la fuente de verdad y ya viaja a todas las sesiones; el cliente local se
desincroniza al cerrar/cambiar de dispositivo.

## D11 — Estado `busy` y `busyReason = SPECTATING` ✅ soportado por contrato

**Decisión**: (1) `spectating` no-nulo implica `busy = true` (§4.16): el front no ofrece
crear/unirse/Quick Match/aceptar invitaciones mientras especta (el BE además lo impide). Reusar
`PresenceCoordinatorService.busy` (ya deriva de `presence.busy`). (2) Agregar `SPECTATING` a
`FriendBusyReason` ([social.models.ts](../../src/app/core/models/social.models.ts)) y a
`busyReasonCopy` ([error-copy.ts:29](../../src/app/shared/error-copy/error-copy.ts)) con copy
"Mirando una partida", para que los amigos vean el motivo y no se lo pueda invitar.

**Rationale**: §7.4.5 ya define `SPECTATING` como `busyReason`; falta solo el lado del front (el
enum y el copy no lo tienen). El gating de invitación en `friend-row` ya usa `availability`/`online`,
así que un amigo `BUSY` por SPECTATING no muestra "Invitar" automáticamente; solo hay que mapear el
copy del motivo.

**Alternativas consideradas**: inferir "espectando" desde `spectatableMatch` u otra señal —
rechazado: `busyReason = SPECTATING` es el dato canónico del contrato.
