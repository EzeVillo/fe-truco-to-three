# Feature Specification: Todos los logros en el perfil

**Feature Branch**: `019-all-achievements-profile`

**Created**: 2026-06-01

**Status**: Draft

**Input**: User description: "Que aparezcan todos los logros en el perfil del usuario, arriba los que ya desbloqueó y debajo los que no. Hay un nuevo endpoint disponible (catálogo de logros) y hay que hacer el merge de ese catálogo con los logros desbloqueados que vienen en el perfil, para saber cuáles están desbloqueados y cuáles no."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el catálogo completo con marca de desbloqueo (Priority: P1)

Como jugador, al abrir mi perfil quiero ver **todos los logros que existen en el juego**, no
solo los que ya conseguí, para entender qué me falta y tener una meta clara. Los que ya desbloqueé
aparecen primero, claramente destacados, y debajo aparecen los que todavía no conseguí, presentados
de forma atenuada para que se distingan a simple vista.

**Why this priority**: Es el corazón de la feature. Sin el listado completo cruzado contra lo
desbloqueado no hay valor; todo lo demás (orden, estilos, tiempo real) es refinamiento sobre esto.

**Independent Test**: Abrir el perfil de un jugador que tiene algunos logros desbloqueados y verificar
que se ven los 10 logros del juego, con los desbloqueados arriba y los bloqueados abajo.

**Acceptance Scenarios**:

1. **Given** un jugador con 3 logros desbloqueados de un catálogo de 10, **When** abre su perfil,
   **Then** ve 10 logros en total: los 3 desbloqueados arriba y los 7 restantes (bloqueados) debajo.
2. **Given** un jugador sin ningún logro desbloqueado, **When** abre su perfil, **Then** ve los 10
   logros del catálogo, todos en estado bloqueado, en lugar del mensaje de "todavía no hay logros".
3. **Given** un jugador con todos los logros desbloqueados, **When** abre su perfil, **Then** ve los
   10 logros, todos en estado desbloqueado y ninguno atenuado.

---

### User Story 2 - Distinguir y ordenar desbloqueados vs. bloqueados (Priority: P2)

Como jugador quiero que los logros desbloqueados se diferencien visualmente de los bloqueados y
estén ordenados de forma consistente, para reconocer de un vistazo mi progreso y cuándo conseguí
cada uno.

**Why this priority**: Aporta legibilidad y motivación, pero depende de que primero exista el listado
completo (Historia 1).

**Independent Test**: Con un perfil que mezcla logros desbloqueados en distintas fechas y logros
bloqueados, verificar el orden (desbloqueados primero, por fecha de desbloqueo más reciente arriba)
y la diferenciación visual (bloqueados atenuados con candado y sin fecha).

**Acceptance Scenarios**:

1. **Given** varios logros desbloqueados en fechas distintas, **When** se renderiza la lista, **Then**
   los desbloqueados se ordenan del más reciente al más antiguo por su fecha de desbloqueo.
2. **Given** un logro bloqueado, **When** se renderiza, **Then** se muestra atenuado, con un indicador
   de candado y sin fecha de desbloqueo.
3. **Given** un logro desbloqueado, **When** se renderiza, **Then** se muestra a plena intensidad con
   su fecha de desbloqueo.

---

### User Story 3 - Reflejar un desbloqueo en tiempo real (Priority: P3)

Como jugador que tiene su propio perfil abierto, cuando desbloqueo un logro durante una partida
quiero que ese logro pase de bloqueado a desbloqueado en la lista sin recargar la página, para tener
feedback inmediato del hito conseguido.

**Why this priority**: Mejora la experiencia y reaprovecha la notificación en tiempo real ya existente,
pero la feature aporta valor sin esto (basta recargar el perfil).

**Independent Test**: Con el perfil propio abierto, simular la llegada de la notificación de logro
desbloqueado y verificar que el logro correspondiente pasa de bloqueado a desbloqueado y se reubica
en la zona de desbloqueados.

**Acceptance Scenarios**:

1. **Given** el perfil propio abierto con un logro en estado bloqueado, **When** llega la notificación
   de que ese logro se desbloqueó, **Then** el logro pasa a desbloqueado, muestra su fecha y se reubica
   entre los desbloqueados sin recargar la página.
2. **Given** el perfil propio abierto, **When** llega una notificación de un logro ya marcado como
   desbloqueado, **Then** la lista no se duplica ni cambia de orden de forma inconsistente.
3. **Given** el perfil de **otro** jugador abierto, **When** llega una notificación de logro del
   usuario autenticado, **Then** el perfil mostrado no se modifica.

---

### Edge Cases

- **El catálogo no se puede obtener pero el perfil sí**: la pantalla degrada a mostrar únicamente los
  logros desbloqueados (comportamiento actual), sin romper el perfil ni mostrar error global.
- **El perfil no se puede obtener**: se mantiene el estado de error existente con opción de reintentar.
- **El catálogo trae un código de logro que el front no reconoce**: se muestra igual, con un nombre y
  descripción genéricos de respaldo, en el estado de desbloqueo que corresponda.
- **El perfil trae un logro desbloqueado que no está en el catálogo**: se incluye igual en la lista de
  desbloqueados (no se pierde el progreso del jugador).
- **El catálogo está vacío**: se muestra el mensaje de que todavía no hay logros (sin listado).
- **Dos logros desbloqueados con la misma fecha**: el orden entre ellos se mantiene estable y
  determinista.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El perfil MUST mostrar **todos** los logros existentes en el juego, obtenidos del
  catálogo de logros, no solo los desbloqueados por el jugador.
- **FR-002**: El sistema MUST cruzar el catálogo completo con los logros desbloqueados del perfil
  por su código identificador, para determinar el estado (desbloqueado / bloqueado) de cada logro.
- **FR-003**: El perfil MUST ordenar los logros desbloqueados **antes** que los bloqueados.
- **FR-004**: Dentro de los desbloqueados, el sistema MUST ordenarlos por fecha de desbloqueo, del
  más reciente al más antiguo, con un criterio de desempate estable.
- **FR-005**: Cada logro desbloqueado MUST mostrar su nombre, su descripción y su fecha de desbloqueo.
- **FR-006**: Cada logro bloqueado MUST mostrar su nombre y descripción de forma visualmente atenuada,
  con un indicador de candado y **sin** fecha.
- **FR-007**: El sistema MUST resolver el nombre y la descripción legibles de cada logro a partir de su
  código, usando un texto de respaldo genérico cuando el código no esté contemplado.
- **FR-008**: Si la obtención del catálogo falla pero el perfil se obtiene correctamente, el perfil
  MUST degradar a mostrar solo los logros desbloqueados, sin bloquear la pantalla con un error.
- **FR-009**: Si la obtención del perfil falla, el sistema MUST mantener el estado de error con la
  opción de reintentar la carga.
- **FR-010**: Cuando el jugador está viendo **su propio** perfil y desbloquea un logro en tiempo real,
  el sistema MUST actualizar ese logro de bloqueado a desbloqueado y reubicarlo entre los desbloqueados
  sin requerir recarga.
- **FR-011**: El sistema MUST evitar entradas duplicadas: un mismo código de logro aparece una sola
  vez en la lista, sea cual sea su estado.
- **FR-012**: Cuando se ve el perfil de otro jugador, las notificaciones de logros del usuario
  autenticado MUST NOT modificar la lista mostrada.

### Key Entities *(include if feature involves data)*

- **Logro del catálogo**: representa un logro que existe en el juego, identificado por un código único.
  El catálogo expone todos los códigos existentes; no hay logros ocultos.
- **Logro desbloqueado**: un logro que el jugador ya consiguió; agrega la fecha de desbloqueo y el
  contexto de la partida en que lo obtuvo.
- **Logro en la vista de perfil**: la combinación de un logro del catálogo con su estado para el
  jugador (desbloqueado o bloqueado), su nombre y descripción legibles, y —si está desbloqueado— su
  fecha de desbloqueo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al abrir un perfil, el jugador ve el 100% de los logros del juego, independientemente de
  cuántos haya desbloqueado.
- **SC-002**: En un perfil con logros mixtos, el 100% de los desbloqueados aparece antes que cualquier
  bloqueado, y los desbloqueados quedan ordenados del más reciente al más antiguo.
- **SC-003**: Un jugador puede distinguir a simple vista, sin interactuar, qué logros tiene y cuáles le
  faltan (estado visualmente diferenciado en el 100% de los ítems).
- **SC-004**: Cuando el catálogo no está disponible, el perfil sigue siendo utilizable y muestra al
  menos los logros desbloqueados en el 100% de los casos (sin pantalla de error).
- **SC-005**: Al desbloquear un logro con el propio perfil abierto, el cambio de estado se refleja en
  la lista sin recargar la página.

## Assumptions

- El catálogo de logros se obtiene de un endpoint que devuelve únicamente los códigos de logro
  existentes; el nombre y la descripción legibles los resuelve el frontend a partir del código (texto
  ya existente en el proyecto).
- El catálogo es idéntico para todos los jugadores e independiente de su progreso; no existen logros
  ocultos.
- La feature aplica tanto al perfil propio como al de otros jugadores; la actualización en tiempo real
  solo aplica al perfil propio del usuario autenticado.
- Se reutiliza la notificación de logro desbloqueado en tiempo real ya existente en el producto.
- El diseño respeta los tokens visuales del proyecto y el alcance responsivo vigente (mobile-first con
  un único salto a desktop).
- La cantidad de logros del juego es acotada (decenas como máximo), por lo que no se requiere
  paginación ni búsqueda.
