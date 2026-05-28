# Especificación de Feature: Cola serial de eventos WebSocket de match

**Feature Branch**: `010-ws-event-queue`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "vamos con la opción A (cola serial estricta), esto solo aplica a match"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El rival/bot juega dos cartas seguidas y se ven separadas (Priority: P1)

Cuando el oponente (especialmente un bot) tira más de una carta en sucesión inmediata —porque el backend resuelve y emite los eventos en ráfaga— el jugador necesita percibir cada jugada como un acto distinto. Hoy las cartas aparecen en el mismo tick visual y el jugador no logra reconstruir qué pasó.

**Why this priority**: Es el caso que motiva la feature. Sin esto la partida contra bots se siente "rota" y el jugador pierde el hilo narrativo del juego, lo que rompe la inmersión y dificulta la toma de decisiones.

**Independent Test**: Iniciar una partida contra bot, forzar (o esperar) un escenario donde el bot juega dos cartas en menos de 200 ms entre eventos. Verificar que las cartas aparecen en la mesa con una separación temporal perceptible (≥ 500 ms entre una y la siguiente) en lugar de simultáneamente.

**Acceptance Scenarios**:

1. **Given** una partida en curso contra un bot, **When** el backend emite dos eventos `CARD_PLAYED` del rival con menos de 100 ms de diferencia, **Then** la primera carta se muestra en la mesa, transcurre el delay configurado, y recién entonces se muestra la segunda.
2. **Given** una partida en curso, **When** llegan en ráfaga `CARD_PLAYED` (rival) + `TURN_CHANGED` + canto del rival, **Then** el orden visible es: aparece la carta, se respeta el delay, cambia el turno, se respeta el delay, aparece la indicación del canto y el panel de respuesta — nunca el panel antes que la carta.

---

### User Story 2 - Los cantos del rival no aparecen antes que la jugada que los motiva (Priority: P1)

Cuando el rival juega una carta y a continuación canta (envido, truco, etc.), el jugador debe ver primero la carta y después el canto, para entender el contexto. Si el panel de respuesta al canto aparece mientras la carta del rival todavía no se renderizó, el jugador queda descolocado.

**Why this priority**: Sin orden causal, la UI miente sobre lo que pasó. Es tan crítico como el caso 1 porque rompe la confianza del jugador en lo que ve en pantalla.

**Independent Test**: Forzar (con mocks o backend) una secuencia `CARD_PLAYED` (rival) inmediatamente seguida de `ENVIDO_CANTADO`. Verificar que la carta aparece primero, y el panel/indicación del canto aparece después del delay correspondiente.

**Acceptance Scenarios**:

1. **Given** es el turno del rival, **When** el rival juega una carta y canta envido en el mismo "tick" del backend, **Then** la UI muestra la carta, espera el delay, y recién entonces muestra el canto y el panel de respuesta.
2. **Given** llegan dos cantos encadenados del rival (p. ej. envido + real envido), **When** se procesan, **Then** se muestran de a uno, con delay entre ambos, para que el jugador pueda leerlos.

---

### User Story 3 - Mis propias acciones siguen siendo instantáneas (Priority: P2)

Cuando el jugador local realiza una acción (juega una carta, canta), el feedback en la UI debe ser inmediato. El eco WebSocket de su propia acción no debe meterse en la cola con delay, porque ya hubo feedback óptico al tocar.

**Why this priority**: Si las acciones propias también se retrasan, la app se siente lenta y poco responsiva. Es importante pero separable del problema principal.

**Independent Test**: Jugar una carta como usuario local; verificar que la carta aparece en la mesa al instante (sin esperar el delay de la cola), independientemente de que la confirmación del backend llegue luego.

**Acceptance Scenarios**:

1. **Given** el usuario local toca para jugar una carta, **When** la acción se envía y el backend devuelve la confirmación, **Then** la carta ya estaba renderizada al instante y la confirmación no produce ningún cambio visible adicional.
2. **Given** el usuario canta envido localmente, **When** el eco del evento llega por WebSocket, **Then** no se vuelve a animar ni se mete en la cola de eventos visibles.

---

### Edge Cases

- **Reconexión / sync masivo**: Cuando el cliente se reconecta y recibe un snapshot/replay con N eventos pasados, no se debe respetar el delay para cada uno (sería esperar N × delay segundos). El estado debe aplicarse de una sola vez al estado final, sin animaciones.
- **Tab inactiva / app en background**: Si el usuario vuelve a la pestaña después de un tiempo, los eventos acumulados no deben reproducirse uno por uno con delay; se aplican al estado final.
- **Fin de mano / fin de partida llegando mientras hay eventos en cola**: El resultado debe mostrarse después de que se vacíe la cola de eventos previos (no antes), para que el jugador vea las cartas finales antes del overlay de resultado.
- **Desconexión mientras hay cola pendiente**: Los eventos en cola que aún no se aplicaron deben procesarse igualmente (no perderse) antes o durante el manejo del estado de desconexión.
- **Eventos de chat / lobby / social llegando durante una partida**: No entran a la cola de match; se procesan al instante por canales separados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE procesar los eventos WebSocket relacionados con una partida en curso de forma serial estricta, en el orden de llegada, dentro de la pantalla de match.
- **FR-002**: El sistema DEBE introducir un tiempo mínimo de espera entre el procesamiento de un evento de match "visible" y el siguiente, de modo que dos eventos consecutivos no se rendericen en el mismo tick visual.
- **FR-003**: El delay aplicado DEBE ser configurable por tipo de evento, con un valor por defecto distinto a cero para los eventos visibles del rival y cero para los eventos puramente de estado.
- **FR-004**: Eventos disparados por el usuario local (eco de su propia carta jugada, eco de su propio canto) NO DEBEN agregar delay a la cola: el feedback local ya ocurrió al tocar.
- **FR-005**: Eventos que NO son de la pantalla de match (chat, lobby, social, achievements, presence) NO DEBEN pasar por la cola de match; se procesan en su canal correspondiente sin afectar el orden de los eventos de partida.
- **FR-006**: Cuando el cliente recibe un snapshot inicial o un replay de eventos por reconexión, el sistema DEBE aplicar el estado resultante de una sola vez, sin reproducir el delay por cada evento individual.
- **FR-007**: El sistema DEBE garantizar que un evento que dispara un panel de respuesta del jugador (p. ej. respuesta a envido, respuesta a truco) sólo se muestre cuando le toca su turno en la cola, no antes de los eventos previos que le dan contexto.
- **FR-008**: Cuando llegan dos eventos del mismo tipo que se invalidan entre sí (p. ej. dos `TURN_CHANGED` consecutivos sin nada entre medio), el sistema PUEDE colapsarlos para evitar trabajo redundante, siempre que no afecte la correctitud.
- **FR-009**: Los delays definidos para cada tipo de evento de match (carta del rival, canto del rival, resultado de envido, resultado de mano, fin de partida, cambio de turno) DEBEN estar centralizados en un único lugar configurable, no dispersos en cada componente.
- **FR-010**: El sistema DEBE seguir aceptando y encolando nuevos eventos mientras hay eventos pendientes de aplicarse; no debe descartar eventos ni romper el orden de llegada.
- **FR-011**: Si el usuario abandona la pantalla de match (navega afuera) con eventos pendientes en la cola, el sistema DEBE limpiar la cola sin aplicar los eventos visualmente; el estado canónico de la partida se reconcilia si vuelve a entrar.

### Key Entities

- **Evento de match encolable**: Representa un evento de partida recibido por WebSocket que debe procesarse en orden. Atributos relevantes: tipo de evento, payload original, timestamp de llegada, delay mínimo asociado a su tipo, marca de si proviene de una acción local o remota.
- **Cola de eventos de match**: Estructura FIFO que retiene los eventos pendientes de procesar, garantizando que el orden de llegada se preserva y que se respeta el tiempo mínimo configurado entre uno y el siguiente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En partidas contra bots, cuando el bot juega dos cartas en ráfaga, el 100% de los pares de cartas aparecen separados por al menos 500 ms (validable observacionalmente con grabación o trazas).
- **SC-002**: Cuando una jugada del rival incluye carta + canto, en el 100% de los casos la carta es visible antes de que aparezca el panel de respuesta al canto.
- **SC-003**: El feedback visual de una acción local del jugador (jugar una carta, cantar) ocurre en menos de 100 ms desde el tap/click, sin verse afectado por el delay de la cola.
- **SC-004**: En una reconexión con backlog de ≥ 5 eventos pendientes, el estado final se aplica en menos de 1 segundo (no en `5 × delay`).
- **SC-005**: Cero regresiones en la respuesta de la app a eventos fuera del match (chat, lobby, social): mantienen su latencia previa.

## Assumptions

- Esta feature aplica **únicamente** a la pantalla de match (partida en curso). Lobby, chat, social, achievements y resto de canales WebSocket quedan fuera de alcance.
- El delay configurado por defecto será del orden de **600–900 ms** para cartas del rival, **400–600 ms** para cantos, **800–1200 ms** para resultados (envido, mano, fin de partida); valores finales se afinan en plan/implementación.
- Los eventos del propio jugador llegan también por WebSocket como eco; el cliente puede distinguirlos (por id de jugador) y tratarlos sin delay.
- El backend no garantiza tiempo mínimo entre eventos consecutivos de match; la responsabilidad de espaciarlos es del cliente.
- El feature no introduce nuevos endpoints REST ni cambios en el contrato WebSocket: sólo cambia la forma en que el cliente procesa eventos ya existentes.
- "Snapshot inicial" / "replay de reconexión" se asume como un evento o conjunto de eventos distinguibles del flujo normal; si no lo son hoy, queda como punto a resolver en el plan.
