# Feature Specification: Estado de partida en tiempo real vía WebSocket

**Feature Branch**: `008-match-ws-state`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "vamos con la opcion de delta reducer, por ahora la pantalla de abandono sera la misma que la de ronda finalizada, y q muestre lo que venga del BE en el evento que corresponda"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el estado real de la partida al ingresar (Priority: P1)

Cuando un jugador navega a la pantalla de partida, la pantalla debe mostrar el estado actual real de la partida (puntaje, turno, cartas, acciones disponibles), no datos de prueba. El estado se obtiene inmediatamente al cargar la pantalla consultando al servidor, y luego se mantiene actualizado en tiempo real mediante eventos que llegan de forma continua.

**Why this priority**: Sin este comportamiento, el jugador nunca ve información real de partida. Es la base de toda la feature.

**Independent Test**: Puede testearse navegando a una partida activa y verificando que el marcador, las cartas en mano y el turno actual coincidan exactamente con lo que reporta el servidor.

**Acceptance Scenarios**:

1. **Given** el jugador navega a `/match/:matchId` de una partida activa, **When** la pantalla termina de cargar, **Then** el jugador ve el marcador real, sus cartas reales y el turno actual tal como los reporta el servidor.
2. **Given** la pantalla está cargando el estado inicial, **When** el estado aún no llegó, **Then** el jugador ve un indicador de carga (spinner o skeleton) en lugar de datos vacíos o erróneos.
3. **Given** el jugador ingresa a una partida en la que aún no es su turno, **When** la pantalla carga, **Then** las acciones disponibles están vacías o bloqueadas, reflejando el estado real del servidor.

---

### User Story 2 - Recibir actualizaciones de partida en tiempo real (Priority: P1)

Durante la partida, cada acción de cualquiera de los dos jugadores (jugar carta, cantar truco, responder envido, etc.) debe reflejarse en la pantalla del otro jugador sin necesidad de recargar. Los cambios deben ser inmediatos: marcador, cartas jugadas, turno activo y acciones disponibles se actualizan solos.

**Why this priority**: Sin actualizaciones en tiempo real la partida no es jugable. Es co-crítico con la carga inicial.

**Independent Test**: Puede testearse con dos navegadores en la misma partida: al jugar una carta en uno, el otro debe mostrar la carta en la mesa y el turno cambiado sin recargar.

**Acceptance Scenarios**:

1. **Given** el jugador A juega una carta, **When** el servidor confirma la jugada, **Then** la pantalla del jugador B muestra la carta jugada en la mesa y el turno pasa a B, sin que B haga nada.
2. **Given** el jugador A canta truco, **When** el servidor emite el evento, **Then** la pantalla del jugador B actualiza el estado de truco y le muestra las opciones de respuesta disponibles.
3. **Given** se resuelve una mano, **When** el servidor emite el resultado, **Then** ambas pantallas muestran las cartas reveladas y la mano se agrega al historial de manos jugadas.
4. **Given** llega un evento con número de secuencia menor o igual al estado actual, **When** el sistema lo recibe, **Then** el evento se descarta sin afectar el estado visible.
5. **Given** llega un evento con número de secuencia mayor al esperado (hueco en la secuencia), **When** el sistema lo detecta, **Then** se re-consulta el estado completo al servidor para sincronizar.

---

### User Story 3 - Ver resultado al finalizar la partida (Priority: P2)

Cuando la partida termina — ya sea por victoria normal, abandono voluntario de un jugador, o forfeit administrativo — ambas pantallas deben mostrar un diálogo de resultado que informe al jugador qué pasó y quién ganó. El diálogo reutiliza el componente de resultado de ronda ya existente.

**Why this priority**: Es la conclusión del flujo de juego. Sin esto el jugador queda en la pantalla de partida sin saber qué pasó.

**Independent Test**: Puede testearse forzando el fin de partida (victoria normal o abandono) y verificando que el diálogo aparezca con el resultado correcto.

**Acceptance Scenarios**:

1. **Given** la partida llega a su fin por victoria normal, **When** el servidor emite el evento de fin de partida, **Then** ambos jugadores ven el diálogo de resultado con el ganador indicado por el servidor.
2. **Given** un jugador abandona voluntariamente, **When** el servidor emite el evento de abandono, **Then** ambos jugadores ven el mismo diálogo de resultado con la información provista por el servidor en ese evento.
3. **Given** la partida es terminada administrativamente por inactividad, **When** el servidor emite el evento correspondiente, **Then** ambos jugadores ven el diálogo de resultado con los datos del evento.
4. **Given** el diálogo de resultado está visible, **When** el jugador lo cierra, **Then** la pantalla navega fuera de la partida (al lobby o pantalla anterior).

---

### User Story 4 - Actualización de mano y acciones disponibles (Priority: P2)

Las cartas en mano del jugador y las acciones que puede tomar se actualizan automáticamente tras cada evento relevante (se jugó una carta, empezó una nueva ronda, se repartió mano nueva). El jugador nunca necesita recargar para ver sus cartas actualizadas.

**Why this priority**: Sin esto el jugador no puede actuar correctamente (podría intentar jugar una carta que ya jugó, o no ver que le tocó responder).

**Independent Test**: Puede testearse jugando todas las cartas de una ronda: la mano del jugador debe vaciarse carta por carta y las acciones disponibles cambiar en consecuencia.

**Acceptance Scenarios**:

1. **Given** el jugador juega una carta, **When** el servidor confirma la jugada, **Then** esa carta desaparece de la mano del jugador sin recargar.
2. **Given** empieza una nueva ronda, **When** el servidor emite el reparto de cartas, **Then** el jugador ve sus 3 cartas nuevas en mano.
3. **Given** las acciones disponibles cambian (por ejemplo, pasa a ser turno del jugador), **When** el servidor emite el evento correspondiente, **Then** los botones de acción se actualizan inmediatamente.

---

### Edge Cases

- ¿Qué sucede si la conexión en tiempo real se cae mientras la partida está en curso? → Se intenta reconectar; al volver, se re-consulta el estado completo al servidor y se retoma la partida desde el estado actualizado.
- ¿Qué sucede si el jugador recarga la página estando en una partida activa? → La pantalla repite el flujo de carga inicial: consulta el estado actual y se re-suscribe a los eventos.
- ¿Qué sucede si llegan dos eventos con el mismo número de secuencia? → El duplicado se descarta (idempotencia).
- ¿Qué sucede si el servidor devuelve error al consultar el estado inicial? → Se muestra un mensaje de error genérico y se ofrece reintentar o volver al lobby.
- ¿Qué sucede si la partida ya terminó cuando el jugador intenta ingresar? → Se muestra el diálogo de resultado directamente, ya que el estado del servidor reflejará `FINISHED`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pantalla de partida DEBE mostrar el estado real del servidor (marcador, turno, cartas, acciones) desde el momento en que carga, reemplazando por completo los datos de prueba actuales.
- **FR-002**: Al cargar la pantalla de partida, el sistema DEBE suscribirse al canal de eventos en tiempo real del match ANTES de consultar el estado inicial, para no perder eventos que ocurran durante la carga.
- **FR-003**: Al cargar la pantalla de partida, el sistema DEBE consultar el estado actual de la partida al servidor para obtener el estado base autoritativo, incluyendo el número de secuencia actual.
- **FR-004**: Los eventos recibidos con número de secuencia menor o igual al del estado base DEBEN descartarse para evitar aplicar cambios ya incluidos en el snapshot.
- **FR-005**: Los eventos recibidos con número de secuencia mayor al esperado (hueco) DEBEN disparar una re-consulta del estado completo al servidor para sincronizar.
- **FR-006**: Cada tipo de evento de partida DEBE actualizar únicamente los campos del estado que correspondan a ese evento, sin recargar toda la pantalla.
- **FR-007**: Los eventos derivados de actualización de mano y acciones disponibles (enviados específicamente a cada jugador) DEBEN aplicarse directamente al estado local sin validación de secuencia.
- **FR-008**: Cuando la partida termina por victoria normal, abandono voluntario o forfeit administrativo, DEBE mostrarse el diálogo de resultado con la información provista por el servidor en el evento correspondiente.
- **FR-009**: El diálogo de resultado de abandono DEBE reutilizar el mismo componente visual que el diálogo de resultado de ronda, mostrando los datos que llegan del servidor en el evento de abandono.
- **FR-010**: Al cerrar el diálogo de resultado de fin de partida, el jugador DEBE ser redirigido fuera de la pantalla de partida.
- **FR-011**: Los controles de datos de prueba (mock switchers) DEBEN eliminarse de la pantalla de partida en producción.
- **FR-012**: Al desconectarse del canal en tiempo real, el sistema DEBE intentar reconectar y, al lograrlo, re-consultar el estado completo para sincronizar antes de reanudar el procesamiento de eventos.
- **FR-013**: Mientras el estado inicial aún no haya cargado, la pantalla DEBE mostrar un indicador de carga visible.

### Key Entities

- **Estado de partida**: Snapshot completo del momento actual de la partida. Incluye marcador, turno activo, cartas en mano del jugador, historial de manos jugadas, estado del truco/envido, acciones disponibles y número de secuencia. Es la fuente de verdad que se obtiene del servidor al cargar.
- **Evento de partida**: Mensaje en tiempo real que describe un cambio puntual ocurrido en la partida (carta jugada, turno cambiado, puntaje actualizado, etc.). Cada evento lleva un número de secuencia que permite ordenarlos y detectar huecos.
- **Número de secuencia**: Contador monotónico asociado al estado de partida y a cada evento transaccional. Permite al cliente descartar eventos ya procesados, detectar huecos y resolver conflictos de orden.
- **Evento derivado**: Subconjunto de eventos en tiempo real sin número de secuencia, enviados específicamente a cada jugador para actualizar su mano o sus acciones disponibles. Se aplican siempre directamente.
- **Diálogo de resultado**: Pantalla superpuesta que informa el desenlace de la partida (ganador, puntos, motivo). Reutilizable para victoria normal, abandono y forfeit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al ingresar a una partida activa, el jugador ve el estado real (marcador, cartas, turno) en menos de 2 segundos en red local.
- **SC-002**: Las actualizaciones de estado derivadas de acciones del oponente se reflejan en la pantalla en menos de 500 ms desde que el servidor emite el evento.
- **SC-003**: El 100% de los eventos recibidos en orden (sin huecos) produce una actualización correcta del estado visible, verificable mediante tests automatizados del reductor de eventos.
- **SC-004**: Ante una desconexión y reconexión del canal en tiempo real, la pantalla muestra el estado correcto y actualizado en menos de 5 segundos.
- **SC-005**: El diálogo de resultado aparece dentro de los 500 ms de recibirse el evento de fin de partida.
- **SC-006**: La pantalla de partida no muestra ningún dato de prueba en producción; todos los datos provienen exclusivamente del servidor.

## Assumptions

- El servidor de backend está corriendo en red local y los tiempos de respuesta son bajos (< 100 ms). Los criterios de tiempo están calibrados para ese entorno.
- El canal de eventos en tiempo real de partida (`/user/queue/match`) y el canal de eventos derivados (`/user/queue/match-derived`) ya están disponibles y funcionando en el backend.
- La conexión en tiempo real ya cuenta con un mecanismo de reconexión automática configurado (reintentos con backoff).
- Los archivos de datos de prueba (`mocks/`) se conservan en el proyecto para ser usados por los tests automatizados existentes; solo se eliminan de la UI visible en producción.
- El diálogo de resultado de fin de partida muestra la información tal como la entrega el servidor en el evento correspondiente, sin procesamiento ni traducción adicional en el cliente para esta iteración.
- La navegación post-cierre de diálogo de resultado lleva al lobby o pantalla anterior en el historial de navegación; la pantalla destino exacta puede ajustarse en iteraciones posteriores.
- El manejo de errores en la carga inicial se limita a mostrar un mensaje genérico de fallo; el flujo de error detallado (reintentos, estados offline) se aborda en una feature posterior.
