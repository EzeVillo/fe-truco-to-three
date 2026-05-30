# Research: Temporizador de turno en partida

**Feature**: 013-turn-timer | **Fecha**: 2026-05-29

Decisiones técnicas para resolver los puntos abiertos del plan. No quedaron marcadores
`NEEDS CLARIFICATION` (la spec se clarificó previamente).

## D1 — Ruteo de los eventos del temporizador (canal WS vs reconciliación)

**Decisión**: `ACTION_DEADLINE_SET` y `ACTION_DEADLINE_CLEARED` llegan por `/user/queue/match`
(misma suscripción que los transaccionales) pero con `stateVersion: null`. Se rutean por el camino
de **eventos derivados** (`enqueueDerived` → `applyMatchDerivedEvent`), NO por `processLiveEvent`.

**Rationale**: `processLiveEvent` compara `event.stateVersion` contra `lastSeenVersion`. Con
`stateVersion` nulo/ausente, la comparación (`null <= n` → `0 <= n`) descartaría el evento como
"viejo/duplicado", o peor, dispararía el detector de huecos. Tratarlos como derivados (no avanzan
`stateVersion`, sin gap-detection) es exactamente la semántica que el contrato describe en §9.5
("no llevan `stateVersion`; el cliente no debe usarlos para detectar huecos").

**Implementación**: en la suscripción a `/user/queue/match` de `MatchStateService`, detectar estos
dos `eventType` (o `stateVersion == null`) y derivarlos a `processLiveDerivedEvent` en vez de
`processLiveEvent`. Durante `loading`, bufferearlos en `derivedBuffer` (no en `buffer`), para que se
drenen sin pasar por la lógica de `stateVersion`.

**Alternativas consideradas**:
- *Tratarlos como transaccionales*: rechazada — rompe la reconciliación por `stateVersion` (el BE
  los emite sin versión).
- *Suscripción separada*: rechazada — el BE los publica por `/user/queue/match`, no hay otro destino.

## D2 — Cálculo del deadline efectivo robusto al desfase de reloj

**Decisión**: Para eventos WS en vivo, calcular el restante como
`remainingMs = actionDeadline - event.timestamp` (ambos epochMillis del **servidor**) y arrancar un
countdown local de esa duración midiendo el transcurso con el reloj local **monotónico de deltas**
(no comparando contra `Date.now()` absoluto). Así el valor inicial no depende del reloj del
dispositivo. Para el snapshot REST (carga inicial / reconexión), que no trae `timestamp` de servidor,
usar un **offset** `serverClockOffsetMs = lastEventTimestamp - Date.now()` acumulado del último
evento WS visto; si aún no hubo evento, usar offset 0 (`remaining = actionDeadline - Date.now()`).

**Rationale**: cumple FR-010 y SC-002 (≤ 1 s de diferencia). El evento `ACTION_DEADLINE_SET` ya trae
`timestamp` (now del servidor) y `actionDeadline` en el mismo payload, lo que permite computar el
restante exacto sin depender del reloj del cliente. El offset cubre el caso de snapshot.

**Alternativas consideradas**:
- *Usar sólo `actionDeadline - Date.now()`*: rechazada como única estrategia — un reloj de cliente
  desfasado mostraría tiempos incorrectos.
- *Pedir `serverNow` extra en cada payload*: innecesario; el `timestamp` del evento ya cumple ese rol.

## D3 — Representación visual (sin número)

**Decisión**: Indicador de progreso **sin valor numérico** sobre el asiento que debe actuar,
reutilizando el `status-panel__turn-dot` existente de cada jugador en `MatchStatusPanelComponent`:
el dot se convierte/contiene un anillo (conic-gradient o SVG) que se vacía a medida que avanza el
tiempo. Énfasis de urgencia (cambio de color/token) cuando `remaining ≤ 5 s` (FR-006).

**Rationale**: la clarificación fijó "sólo indicador visual sin número". El `turn-dot` ya marca el
asiento activo, por lo que es el ancla natural ("sobre el asiento que debe actuar") y minimiza
cambios de layout en 360 px. Implementable con CSS + tokens, sin número que internacionalizar.

**Alternativas consideradas**:
- *Barra lineal*: válida, pero ocupa más ancho horizontal (riesgo en 360 px) y duplica el rol del
  dot. El anillo sobre el dot es más compacto.
- *Mostrar segundos*: descartada por la clarificación.

**Animación**: preferir transición CSS sobre el ángulo/escala del anillo en lugar de re-render por
`setInterval` de alta frecuencia. Un `setInterval` de baja frecuencia (p. ej. cada 200–250 ms) o un
único `requestAnimationFrame` loop activo sólo mientras corre el reloj alcanza para urgencia/llegada
a 0; se detiene al limpiar el plazo.

## D4 — Comportamiento al llegar a 0 (deshabilitar controles del viewer)

**Decisión**: Cuando el plazo del **viewer** llega a 0 antes de la resolución del backend, exponer
una señal `viewerActionTimedOut` que `match-screen` pasa a `AvailableActionsPanelComponent` para
deshabilitar los controles y mostrar el estado "tiempo agotado". No se vacía `availableActions` en el
estado (eso lo hará el backend con sus eventos); sólo se bloquea la interacción.

**Rationale**: FR-008 y la clarificación. Mantener `availableActions` intacto evita corromper el
estado autoritativo; el bloqueo es puramente de presentación hasta que llegue `MATCH_FORFEITED` u
otro evento del backend que cierre la mano/partida.

**Alternativas consideradas**:
- *Vaciar `availableActions` localmente al expirar*: rechazada — mezcla estado autoritativo con
  presentación y podría desincronizar si el backend aún acepta una acción tardía por gracia.

## D5 — Reinicio, limpieza y fin de partida

**Decisión**: El plazo vive en `roundGame` (se limpia naturalmente cuando `roundGame` es `null`:
`GAME_STARTED`, transición entre partidas). `ACTION_DEADLINE_CLEARED` lo pone en `null`.
`ACTION_DEADLINE_SET` lo reemplaza (reinicio en cambio de asiento). Al finalizar/cancelarse la
partida (`MATCH_FINISHED/ABANDONED/FORFEITED/CANCELLED`), el indicador se oculta porque el render se
condiciona a `status === 'IN_PROGRESS'` y a la existencia de un plazo activo (FR-005, FR-012).

**Rationale**: alinea el ciclo de vida del plazo con el de la ronda/partida ya modelado, sin estado
paralelo que limpiar manualmente.

## Resumen de impacto en archivos

| Archivo | Cambio |
|---|---|
| `core/models/match.models.ts` | + `actionDeadline`, `turnDurationMillis`, `actionDeadlineSeat` en `RoundState` (y opcionalmente normalizados a nivel vista) |
| `features/match/models/match-ws-events.ts` | + `ActionDeadlineSetPayload`; + tipos de evento del temporizador |
| `features/match/reducers/match-event.reducer.ts` | + aplicar set/clear del plazo (vía camino derivado) |
| `features/match/services/match-state.service.ts` | + ruteo de los 2 eventos a derivado; + offset de reloj |
| `features/match/utils/turn-timer.ts` | NUEVA — cálculo de restante/urgencia |
| `features/match/utils/derive-match-view.ts` | + exponer plazo por asiento en `MatchView` |
| `features/match/components/match-status-panel/*` | + render del anillo en el `turn-dot` |
| `features/match/components/available-actions-panel/*` | + deshabilitar al `viewerActionTimedOut` |
| `tests/contract/action-deadline.contract.spec.ts` | NUEVO — paridad con §9.6 |
