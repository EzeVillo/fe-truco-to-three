# Especificación de Feature: Action bar bloqueada durante delay de eventos

**Feature Branch**: `012-delay-gated-action-bar`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "no mostrar ninguna opcion habilitada cuando entra en delay un evento, y que se vaya directamente al action bar principal"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El action bar se deshabilita mientras se procesan eventos con delay (Priority: P1)

Cuando llega un evento remoto del rival (carta jugada, canto de truco/envido, etc.) y la cola de eventos lo procesa con un delay temporal (600-800ms), actualmente la UI puede mostrar opciones habilitadas que corresponden al estado anterior al evento. Esto puede llevar al jugador a tomar decisiones basadas en información obsoleta. Queremos que durante el periodo de delay, el action bar se muestre con **todas las opciones deshabilitadas** y se vuelva directamente al estado principal (ActionBarComponent), cerrando cualquier submenú o panel de respuesta abierto.

**Why this priority**: Es el caso principal de la feature. Previene que el jugador ejecute acciones sobre información stale durante la animación de eventos remotos.

**Independent Test**: Forzar una secuencia donde el rival juega una carta (evento con delay de 600ms). Verificar que durante ese periodo de 600ms, el action bar muestra los botones de Truco/Envido/Mazo pero todos deshabilitados, y no muestra submenús ni paneles de respuesta.

**Acceptance Scenarios**:

1. **Given** una partida en curso y el jugador tiene opciones disponibles (ej. puede cantar truco), **When** el rival juega una carta (evento con delay > 0), **Then** durante el periodo de delay, el action bar se muestra directamente (sin submenús) con todos los botones deshabilitados.
2. **Given** el jugador estaba en el submenú de envido abierto, **When** llega un evento remoto con delay, **Then** el submenú se cierra y el action bar se muestra con todas las opciones deshabilitadas durante el delay.
3. **Given** el jugador estaba respondiendo a un truco (panel de respuesta visible), **When** llega un evento remoto con delay, **Then** el panel de respuesta se oculta y el action bar se muestra deshabilitado durante el delay.
4. **Given** un evento con delay está siendo procesado, **When** el delay termina y se aplica el evento, **Then** el action bar se rehabilita según las nuevas acciones disponibles del estado actualizado.

---

### User Story 2 - Las cartas también se bloquean durante el delay (Priority: P2)

Durante el periodo de delay de un evento remoto, el jugador no debería poder jugar cartas ya que el estado puede cambiar. Las cartas deben mostrarse visualmente bloqueadas (con estilo atenuado) durante el delay.

**Why this priority**: Complementa la deshabilitación del action bar para un bloqueo visual completo durante el procesamiento de eventos remotos.

**Independent Test**: Forzar un evento remoto con delay y verificar que durante ese periodo, los botones de cartas en la mano del jugador están deshabilitados con el estilo `player-hand__card-btn--blocked`.

**Acceptance Scenarios**:

1. **Given** una partida en curso con cartas en la mano, **When** llega un evento remoto con delay, **Then** las cartas del jugador se muestran bloqueadas (deshabilitadas) durante el periodo de delay.
2. **Given** el delay de un evento remoto termina, **When** se aplica el evento, **Then** las cartas se rehabilitan según el estado actualizado.

---

### User Story 3 - Los eventos locales no activan el bloqueo (Priority: P2)

Las acciones del jugador local (jugar una carta, cantar truco, etc.) siempre se aplican inmediatamente (delay = 0). Por lo tanto, no deben activar el bloqueo del action bar.

**Why this priority**: Asegura que la experiencia del jugador local no se vea afectada por un bloqueo innecesario.

**Independent Test**: Ejecutar una acción local (ej. jugar una carta) y verificar que el action bar nunca se deshabilita.

**Acceptance Scenarios**:

1. **Given** una partida en curso, **When** el jugador local juega una carta (evento local), **Then** el action bar mantiene su estado actual sin deshabilitarse.
2. **Given** una partida en curso, **When** el jugador local canta truco (evento local), **Then** el action bar se actualiza según el estado pero no se deshabilita por delay.

---

### Edge Cases

- **Evento remoto con delay = 0**: Si un evento remoto tiene delay configurado en 0ms (ej. TURN_CHANGED), no se activa el bloqueo del action bar — se aplica inmediatamente.
- **Evento bloqueante (ACK)**: Los eventos que abren modales bloqueantes (resultado de envido, fin de partida, etc.) también deshabilitan el action bar mientras el modal está abierto, ya que la cola está pausada por ACK.
- **Múltiples eventos remotos en ráfaga**: Si llegan varios eventos remotos consecutivos, el action bar permanece deshabilitado hasta que se procesen todos y se actualice el estado final.
- **Reconexión**: Si el cliente se reconecta y se aplican eventos de reconciliación de una sola vez (sin delay), el action bar se muestra directamente con el estado final sin pasar por el estado deshabilitado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer un signal `isProcessingDelay` (o equivalente) que indique si la cola de eventos tiene items pendientes con `delayMs > 0`.
- **FR-002**: Cuando `isProcessingDelay` es `true`, el `AvailableActionsPanelComponent` DEBE mostrar exclusivamente el `ActionBarComponent` (panel principal), ocultando cualquier submenú o panel de respuesta que estuviera abierto.
- **FR-003**: Cuando `isProcessingDelay` es `true`, el `ActionBarComponent` DEBE renderizar todos sus botones (Truco, Envido, Mazo) con el atributo `disabled` en `true`, independientemente de las acciones disponibles en el estado actual.
- **FR-004**: Cuando `isProcessingDelay` es `true`, el componente de cartas del jugador (`PlayerHandComponent`) DEBE deshabilitar todos los botones de carta con el atributo `disabled` en `true`.
- **FR-005**: Cuando `isProcessingDelay` cambia de `true` a `false`, el sistema DEBE re-evaluar las acciones disponibles según el estado actual y mostrar el panel correspondiente (action bar principal, submenú de envido, o panel de respuesta según corresponda).
- **FR-006**: El bloqueo del action bar DEBE aplicarse únicamente para eventos remotos con `delayMs > 0`. Eventos locales (delay = 0) y eventos remotos con delay configurado en 0 NO activan el bloqueo.
- **FR-007**: Los eventos bloqueantes (que abren modales con ACK) DEBEN mantener el action bar deshabilitado mientras el modal está abierto, ya que la cola está pausada y `isProcessingDelay` seguirá siendo `true` (o se usará el flag `pausedForAck` existente).
- **FR-008**: La señal de bloqueo DEBE estar centralizada en `MatchEventQueueService` para que cualquier componente consumidor pueda reaccionar al estado de procesamiento de la cola.

### Key Entities

- **Señal `isProcessingDelay`**: Signal booleano expuesto por `MatchEventQueueService` que indica si la cola tiene items pendientes con delay temporal > 0 en proceso. Se activa cuando un item con `delayMs > 0` comienza a procesarse y se desactiva cuando termina de procesarse y no hay más items con delay > 0 pendientes.
- **Estado "colapsado" del panel de acciones**: Estado visual del `AvailableActionsPanelComponent` donde se muestra exclusivamente el `ActionBarComponent` con todos los botones deshabilitados, sin submenús ni paneles de respuesta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de los eventos remotos con delay > 0, el action bar se muestra deshabilitado durante todo el periodo de delay.
- **SC-002**: En el 100% de los eventos locales (delay = 0), el action bar nunca se deshabilita por esta feature.
- **SC-003**: El tiempo entre la llegada de un evento remoto y la deshabilitación visual del action bar es imperceptible (< 16ms, un frame de renderizado).
- **SC-004**: Al finalizar el delay, el action bar se muestra con el estado correcto (habilitado/deshabilitado según las acciones disponibles del estado actualizado) sin flickering visual.
- **SC-005**: Cero errores de runtime relacionados con la señal `isProcessingDelay` en escenarios de ráfaga de eventos remotos.

## Assumptions

- La feature 010 (cola serial estricta de eventos WebSocket de match) y la feature 011 (ACK-gated event queue) están implementadas y operativas. Esta feature se integra con ambas.
- La cola de eventos ya distingue entre eventos locales (delay = 0) y remotos (delay configurable), y ya tiene la lógica de procesamiento secuencial con delays.
- El `ActionBarComponent` ya soporta el atributo `disabled` en sus botones y tiene estilos para el estado deshabilitado (opacity 0.5, cursor not-allowed).
- El `PlayerHandComponent` ya soporta el atributo `disabled` y la clase CSS `player-hand__card-btn--blocked` para el estado bloqueado.
- No se requieren cambios en el contrato del backend ni en `docs/CONTRATOS_API.md`: esta feature es puramente de comportamiento del cliente.
- El alcance es exclusivamente la pantalla de match.
