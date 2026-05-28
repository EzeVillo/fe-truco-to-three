# Especificación de Feature: Avance de la cola de eventos por ACK del usuario en modales

**Feature Branch**: `011-ack-gated-event-queue`

**Created**: 2026-05-27

**Status**: Draft

**Input**: User description: "hagamoslo entonces — que el delay de los eventos, después de algún evento que dispare un modal, no sea en segundos, sino que sea cuando el usuario le da click en aceptar"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El resultado del envido pausa la partida hasta que el jugador lo reconoce (Priority: P1)

Cuando se resuelve el envido, hoy aparece un modal con el resultado (puntos cantados, ganador, puntos sumados) y la cola de eventos sigue procesando con un delay fijo en segundos. Si el jugador todavía está leyendo, el siguiente evento (cambio de turno, carta del rival, etc.) se aplica por debajo y al cerrar el modal se encuentra con un estado distinto al que pausó. Queremos que la cola de eventos quede **bloqueada** mientras el modal de resultado de envido está abierto, y que sólo avance cuando el jugador toca "Aceptar".

**Why this priority**: Es el caso más doloroso: el resultado del envido tiene información que el jugador necesita asimilar (qué cantó el rival, cuántos puntos sumó, marcador actual). Si la mesa cambia mientras lee, pierde el hilo. Es el escenario que motiva toda la feature.

**Independent Test**: Forzar una secuencia donde se resuelve el envido y a los pocos cientos de ms llega un `CARD_PLAYED` del rival. Verificar que mientras el modal de envido está abierto, la carta del rival NO aparece en la mesa. Al tocar "Aceptar", la carta se renderiza recién entonces (respetando, si corresponde, el delay configurado del siguiente evento).

**Acceptance Scenarios**:

1. **Given** una partida en curso y el modal de "Resultado de envido" recién abierto, **When** llegan por WebSocket eventos posteriores (carta del rival, cambio de turno, otro canto), **Then** esos eventos quedan encolados y no producen ningún cambio visible en la mesa hasta que el jugador toca "Aceptar" en el modal.
2. **Given** el modal de resultado de envido está abierto y hay 2 o más eventos encolados, **When** el jugador toca "Aceptar", **Then** el modal se cierra y la cola retoma el procesamiento serial respetando los delays configurados entre eventos.
3. **Given** el modal de resultado de envido está abierto, **When** el jugador no toca nada durante un período prolongado (p. ej. 30 segundos), **Then** el modal permanece abierto y la cola sigue pausada — no hay auto-dismiss.

---

### User Story 2 - El fin de mano y el fin de partida pausan la cola hasta ACK (Priority: P1)

Cuando se gana una mano (ronda) o una partida, aparece un modal con el resultado. La pantalla de match recibe inmediatamente eventos del backend que arrancan la siguiente mano o la siguiente partida (reparto de cartas, cambio de mano, nuevo turno). Si esos eventos avanzan mientras el modal está abierto, al cerrarlo el jugador ve una mesa nueva sin haber digerido el cierre de la anterior.

**Why this priority**: Mismo problema que envido pero en transiciones de mano/partida — más raro pero igual de desorientador. Si el flujo de envido queda pausado por ACK, el de fin de mano/partida también debe estarlo, por consistencia.

**Independent Test**: Jugar la última carta de una mano y verificar que mientras el modal de "Ronda ganada" / "Partida ganada" está abierto, los eventos del backend que reparten la siguiente mano (nuevas cartas, cambio de mano) no se aplican visualmente. Al tocar "Aceptar", se aplican entonces.

**Acceptance Scenarios**:

1. **Given** se cierra una mano y el modal de "Ronda ganada" está abierto, **When** el backend emite los eventos del inicio de la siguiente mano (nuevas cartas, mano, turno), **Then** esos eventos quedan encolados y la mesa permanece en el estado del cierre de la mano anterior hasta el ACK.
2. **Given** un jugador llega a 3 puntos exactos y se abre el modal de "Partida ganada", **When** el backend emite eventos posteriores (p. ej. inicio de la siguiente partida de la serie), **Then** la cola queda pausada hasta que el jugador toca "Aceptar".
3. **Given** se cierra una serie (mejor de 3 / mejor de 5) y se abre el modal de "Serie ganada", **When** llegan eventos posteriores, **Then** la cola queda pausada hasta el ACK del jugador.

---

### User Story 3 - Los eventos no bloqueantes siguen avanzando con delay temporal (Priority: P2)

No todos los eventos requieren ACK del usuario. Cartas jugadas, cambios de turno y cantos en sí (sin su resolución) siguen comportándose como hoy: con un delay temporal corto entre uno y otro. Sólo los eventos cuyo dispatch abre un modal **bloqueante** pausan la cola hasta el click. Si todo requiriese ACK, el juego se volvería tedioso.

**Why this priority**: Garantiza que el cambio no degrade el ritmo del juego en el caso común. Es necesario diferenciar claramente qué eventos son "bloqueantes" (ACK requerido) y cuáles no, para que sólo los momentos importantes pausen la mesa.

**Independent Test**: Forzar una secuencia de `CARD_PLAYED` + `TURN_CHANGED` + `CARD_PLAYED` del rival. Verificar que el comportamiento es idéntico al de la feature 010 (delays temporales entre eventos, sin requerir click).

**Acceptance Scenarios**:

1. **Given** el rival juega dos cartas seguidas sin ningún modal de por medio, **When** la cola las procesa, **Then** se renderizan con el delay temporal configurado entre una y otra, sin pedir ACK.
2. **Given** el rival canta envido (evento que abre un panel de respuesta, no un modal bloqueante), **When** la cola procesa el evento, **Then** se muestra el panel de respuesta sin requerir ACK del jugador local más allá de su propia respuesta al canto.

---

### Edge Cases

- **Múltiples modales bloqueantes encadenados**: Si en la cola hay un evento "fin de envido" inmediatamente seguido de "ronda ganada" (caso real: el envido define los puntos que cierran la mano), al hacer ACK al primer modal se procesa el siguiente evento y aparece el segundo modal — cada uno con su propio ACK.
- **Abandono de pantalla con modal abierto**: Si el jugador navega afuera de la pantalla de match con un modal bloqueante abierto y eventos encolados, la cola se descarta (consistente con FR-011 de la 010); al volver a entrar, el estado se reconcilia desde el snapshot del backend.
- **Reconexión con modal abierto**: Si el cliente se reconecta mientras el modal está abierto, los eventos del snapshot/replay se aplican al estado final de una sola vez (sin animaciones ni delays, igual que en 010) y el modal se cierra automáticamente porque el evento que lo originó ya forma parte del estado canónico aplicado.
- **Evento bloqueante que llega mientras la cola está pausada por otro modal**: Queda encolado detrás del actual; cuando se hace ACK al primero, se procesa y abre el segundo modal, pausando la cola de nuevo.
- **Doble click en "Aceptar"**: El ACK debe ser idempotente — un segundo click rápido no debe procesar dos eventos.
- **Modales no bloqueantes (toasts, snackbars, indicadores efímeros)**: NO pausan la cola; siguen el comportamiento de delay temporal del FR de la 010.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE distinguir, para cada evento procesado por la cola de match, si su renderizado abre un modal **bloqueante** que requiere ACK explícito del usuario, o si es un evento no bloqueante que continúa con el delay temporal estándar.
- **FR-002**: Para los eventos bloqueantes, el sistema DEBE pausar el procesamiento de la cola desde el momento en que se abre el modal y hasta que el usuario confirme con el botón "Aceptar" (o equivalente) del modal.
- **FR-003**: Para los eventos no bloqueantes, el sistema DEBE mantener el comportamiento actual (definido en la feature 010): delay temporal configurable entre eventos consecutivos.
- **FR-004**: La lista de tipos de evento bloqueantes DEBE estar centralizada en un único lugar configurable, no dispersa por cada componente. Inicialmente incluye al menos: resultado de envido, ronda/mano ganada, partida ganada, serie ganada.
- **FR-005**: Mientras la cola está pausada esperando ACK, el sistema DEBE seguir aceptando y encolando nuevos eventos del WebSocket sin perderlos.
- **FR-006**: El ACK del usuario DEBE ser idempotente: clicks adicionales sobre "Aceptar" después del primero no procesan eventos adicionales ni reabren el modal.
- **FR-007**: Los modales bloqueantes NO DEBEN tener auto-dismiss por tiempo: permanecen abiertos hasta el ACK explícito del jugador.
- **FR-008**: Si el usuario abandona la pantalla de match con un modal bloqueante abierto, el sistema DEBE limpiar la cola y cerrar el modal sin aplicar los eventos pendientes (alineado con la feature 010).
- **FR-009**: Ante un snapshot/replay por reconexión, el estado canónico se aplica de una sola vez (consistente con 010); cualquier modal bloqueante actualmente abierto que corresponda a un evento ya superado por el snapshot DEBE cerrarse automáticamente.
- **FR-010**: Si dos eventos bloqueantes consecutivos llegan en la cola, al hacer ACK al primero el sistema DEBE procesar inmediatamente el siguiente (abriendo su modal correspondiente) sin aplicar delay temporal entre ambos — el delay efectivo es el tiempo de lectura del usuario.

### Key Entities

- **Evento de match en cola**: Cada elemento de la cola lleva, además de su tipo y payload (definidos en la 010), un atributo que indica si su procesamiento es **bloqueante** (requiere ACK) o no.
- **Modal bloqueante**: Diálogo que abre un evento bloqueante. Tiene un botón explícito de ACK ("Aceptar" u otro CTA equivalente) que es la única vía de cierre. Mientras está abierto, la cola está suspendida.
- **Catálogo de eventos bloqueantes**: Configuración centralizada que enumera los tipos de evento cuyo procesamiento requiere ACK. Permite agregar/quitar tipos sin tocar cada componente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de las resoluciones de envido durante una partida, la mesa no cambia visualmente mientras el modal de resultado de envido está abierto.
- **SC-002**: En el 100% de los cierres de mano, partida y serie, los eventos posteriores del backend no producen cambios visibles hasta el ACK del jugador.
- **SC-003**: Para secuencias de eventos no bloqueantes (cartas, cambios de turno, cantos en sí), el tiempo entre eventos consecutivos no se incrementa respecto del comportamiento de la feature 010 — el ritmo del juego en el flujo común no se degrada.
- **SC-004**: Cero pérdida de eventos: en escenarios de ráfaga con un modal bloqueante abierto, el 100% de los eventos posteriores llegan a aplicarse luego del ACK (ningún evento queda descartado).
- **SC-005**: Tiempo de lectura promedio del modal de resultado de envido por parte de los jugadores se vuelve observable y no acotado por un timer (métrica cualitativa: el jugador deja de reportar "no me dio tiempo a leer").

## Assumptions

- La feature 010 ("cola serial estricta de eventos WebSocket de match") está implementada y operativa: existe ya una cola serial con delays temporales por tipo de evento. Esta feature **extiende** ese mecanismo, no lo reemplaza.
- Los modales bloqueantes ya existentes (resultado de envido, ronda ganada, partida ganada) ya tienen un botón "Aceptar" / CTA equivalente como vía de cierre actual; esta feature no requiere rediseño visual de esos modales, sólo conectar su cierre a la reanudación de la cola.
- El alcance es exclusivamente la pantalla de match (consistente con el alcance de la 010). Modales de otras pantallas (chat, lobby, social) están fuera del scope.
- Eventos puramente de estado (sin modal asociado) y eventos que abren paneles inline no bloqueantes (p. ej. panel de respuesta a canto) NO son bloqueantes; siguen con delay temporal.
- El catálogo inicial de eventos bloqueantes es: resultado de envido, ronda/mano ganada, partida ganada, serie ganada. Truco aceptado/rechazado y otros cambios de puntaje no abren modal y por lo tanto no son bloqueantes.
- No se requieren cambios en el contrato del backend ni en `docs/CONTRATOS_API.md`: esta feature es puramente de comportamiento del cliente sobre eventos que ya se reciben.
