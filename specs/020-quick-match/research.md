# Research: Quick Match

## Decisión 1: Ubicar quick match dentro de `features/lobby`

**Decision**: La feature se implementará como una nueva página de lobby (`/lobby/quick-match`) y un
CTA adicional en `LobbyPageComponent`.

**Rationale**: Quick match es un modo de entrada a partida, no una variante del tablero. El lobby ya
contiene "Jugar contra bots", "Jugar online" y "Reglas"; sumar "Partida rápida" mantiene el modelo
mental de hub de modos y permite seguir la misma UI pedida por el usuario.

**Alternatives considered**:
- Integrarlo dentro de `online-match-page`: descartado porque mezclaría tres flujos distintos
  (crear privada, unirse por código y buscar rival) en una pantalla ya cargada.
- Crear feature `matchmaking`: descartado por exceso de estructura para una pantalla y dos endpoints.

## Decisión 2: Estado local en componente, no store global

**Decision**: La búsqueda se modelará con señales locales del componente: formato elegido, estado
`idle/searching/matched/error`, `enqueuedAt`, `matchId`, flags de carga y error visible.

**Rationale**: El backend conserva la cola y el contrato permite reintentar la entrada de forma
idempotente. No hay necesidad de persistir estado complejo en frontend. Un store global aumentaría
acoplamiento y requeriría políticas adicionales de limpieza.

**Alternatives considered**:
- NgRx Store global: descartado porque no hay múltiples pantallas consumidoras ni estado duradero.
- SessionStorage: descartado porque podría mostrar una búsqueda vieja como activa sin confirmación
  del backend.

## Decisión 3: REST para entrar/cancelar y WebSocket para completar emparejamiento diferido

**Decision**: `POST /api/matches/quick` inicia o recupera la búsqueda. Si responde `MATCHED`, se
navega a `/match/:matchId`. Si responde `SEARCHING`, la pantalla queda esperando y se suscribe a
`/user/queue/match` para detectar `GAME_STARTED` con `matchId`.

**Rationale**: Es el flujo documentado en `docs/CONTRATOS_API.md §9.3`: el POST puede emparejar
inmediatamente o dejar al jugador buscando; el inicio posterior llega por WebSocket. Reutilizar
`WebSocketService` mantiene coherencia con match/rematch.

**Alternatives considered**:
- Polling REST: descartado porque el contrato documenta notificación por WebSocket y evitaría
  latencia/carga innecesaria.
- Navegar a match solo con el evento WS aunque el POST responda `MATCHED`: descartado porque agrega
  espera innecesaria y el `matchId` ya está disponible.

## Decisión 4: `gamesToPlay` como partidas totales de la serie `{1,3,5}`

**Decision**: `QuickMatchRequest.gamesToPlay` será `1 | 3 | 5` y se obtendrá con
`seriesFormatToGamesToPlay()`.

**Rationale**: Aunque `docs/CONTRATOS_API.md §9.3` describe el campo como "partidas a ganar", la
memoria del proyecto y el contrato efectivo establecen que `gamesToPlay` representa partidas totales
de la serie. Es el mismo matiz ya documentado para bots: `BEST_OF_3` debe enviar `3`, nunca `2`.

**Alternatives considered**:
- Enviar partidas a ganar (`BEST_OF_3 -> 2`): descartado porque contradice la validación real del BE.
- Definir un mapeo propio de quick match: descartado para evitar divergencias con bots/online.

## Decisión 5: Manejo de abandono de pantalla mientras busca

**Decision**: La primera implementación cancelará la búsqueda al ejecutar la acción explícita
"Volver al lobby" desde la pantalla de espera. No se interceptará cierre de pestaña ni navegación
externa del navegador en esta feature.

**Rationale**: Mantiene comportamiento predecible sin introducir guards globales ni prompts
intrusivos. El contrato de `DELETE /api/matches/quick` es idempotente, así que se puede usar como
limpieza antes de navegar.

**Alternatives considered**:
- Confirmar salida con diálogo: descartado por fricción extra para una búsqueda cancelable.
- Mantener búsqueda en background: descartado porque la spec pide evitar que quede buscando sin
  indicación clara.

## Decisión 6: Error copy con nuevo scope `QUICK_MATCH`

**Decision**: Se agregará `QUICK_MATCH` a `ErrorCopyScope` con copys controlados para 401, 422,
errores de red/5xx y fallback.

**Rationale**: La regla global prohíbe exponer `ApiError.message`. Quick match tiene impedimentos
específicos de disponibilidad (partida activa, revancha, ya en cola) que necesitan copy propio.

**Alternatives considered**:
- Reutilizar `CREATE_MATCH`: parcialmente válido, pero su copy habla de crear partida y no de buscar
  rival.
- Mostrar error genérico para todo 422: descartado porque reduce claridad en un flujo sensible.
