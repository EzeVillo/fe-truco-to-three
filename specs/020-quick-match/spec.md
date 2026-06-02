# Feature Specification: Quick Match

**Feature Branch**: `020-quick-match`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "Implementar quick match siguiendo la misma forma de la UI existente del lobby"

## Resumen

Esta feature agrega el modo **Partida rápida** al lobby: un jugador autenticado elige el formato de
serie, entra a una búsqueda automática de rival humano y, cuando el emparejamiento se completa, pasa
a la partida sin tener que crear ni compartir códigos.

La experiencia debe sentirse como una extensión natural del lobby y de las pantallas de juego ya
existentes: mismos patrones de CTA, jerarquía visual, selector de formato de serie y mensajes
controlados por la aplicación. El modo respeta las reglas de dominio de truco-to-three: cada partida
individual se gana llegando exactamente a 3 puntos y las series disponibles son mejor de 1, 3 o 5,
con **mejor de 3** como default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar a una partida rápida desde el lobby (Priority: P1)

Un jugador autenticado abre el lobby, ve la opción **Partida rápida** junto a los modos existentes,
entra a una pantalla con la misma forma visual del flujo online actual, elige el formato de serie y
confirma que quiere buscar rival.

**Why this priority**: Es el punto de entrada del modo. Sin una acción clara y consistente en el
lobby, el jugador no puede descubrir ni usar quick match.

**Independent Test**: Entrar al lobby con sesión activa, abrir "Partida rápida", verificar que el
selector de serie aparece con default "Mejor de 3", cambiar el formato y confirmar la búsqueda.

**Acceptance Scenarios**:

1. **Given** un jugador autenticado en el lobby, **When** ve los modos de juego, **Then** aparece una
   opción "Partida rápida" con título y descripción coherentes con los CTAs existentes.
2. **Given** el jugador abre "Partida rápida", **When** la pantalla se muestra, **Then** ve una
   acción para iniciar búsqueda y un selector de formato de serie con opciones "Mejor de 1", "Mejor
   de 3" y "Mejor de 5".
3. **Given** el jugador no cambia el selector, **When** inicia la búsqueda, **Then** la búsqueda usa
   el formato default "Mejor de 3".
4. **Given** el jugador cambia el formato de serie, **When** inicia la búsqueda, **Then** la búsqueda
   usa el formato elegido.

---

### User Story 2 - Esperar rival y cancelar la búsqueda (Priority: P1)

Después de iniciar la búsqueda, el jugador queda en una pantalla de espera que informa claramente
que está buscando rival. Desde esa pantalla puede cancelar la búsqueda y volver a una pantalla
operable sin quedar en cola.

**Why this priority**: La búsqueda puede no completarse inmediatamente. El jugador necesita entender
qué está pasando y conservar control sobre su disponibilidad.

**Independent Test**: Iniciar una búsqueda que no empareja de inmediato, verificar el estado de
espera, cancelar y confirmar que el jugador vuelve a poder iniciar otra búsqueda o regresar al
lobby.

**Acceptance Scenarios**:

1. **Given** el jugador inicia quick match y todavía no hay rival disponible, **When** la búsqueda se
   registra, **Then** se muestra un estado "buscando rival" con el formato de serie elegido.
2. **Given** el jugador está buscando rival, **When** pulsa cancelar, **Then** la búsqueda se cancela
   y el jugador vuelve a una pantalla desde la que puede buscar de nuevo o volver al lobby.
3. **Given** el jugador ya estaba buscando rival por una acción anterior, **When** vuelve a intentar
   entrar a quick match, **Then** la pantalla recupera el estado de búsqueda sin duplicar su lugar ni
   mostrar un error bloqueante.
4. **Given** la cancelación falla temporalmente por conectividad, **When** el jugador intenta
   cancelar, **Then** se muestra un mensaje recuperable y la pantalla conserva un estado consistente.

---

### User Story 3 - Pasar automáticamente a la partida al encontrar rival (Priority: P1)

Cuando el sistema encuentra un rival, el jugador deja de ver el estado de búsqueda y pasa
automáticamente al tablero de la partida creada. Si el emparejamiento ocurre inmediatamente al
confirmar, la transición también debe ser inmediata.

**Why this priority**: Es el valor central de quick match: reducir fricción para empezar una partida
humano contra humano sin códigos ni sala manual.

**Independent Test**: Simular o usar un emparejamiento exitoso, tanto inmediato como posterior, y
verificar que el jugador navega a la partida correcta sin acciones adicionales.

**Acceptance Scenarios**:

1. **Given** el jugador inicia quick match y ya hay un rival compatible esperando, **When** confirma
   la búsqueda, **Then** se crea la partida y el jugador pasa directamente al tablero.
2. **Given** el jugador está en estado "buscando rival", **When** se completa el emparejamiento,
   **Then** la pantalla abandona la espera y navega al tablero de la partida encontrada.
3. **Given** la partida rápida comienza, **When** se muestra el tablero, **Then** la serie respeta el
   formato elegido por el emparejamiento y las reglas de truco-to-three.

---

### User Story 4 - Manejar impedimentos y errores sin mensajes crudos (Priority: P2)

Si el jugador no puede entrar a quick match porque ya está ocupado, tiene una revancha pendiente, la
configuración no es válida o hay un problema temporal, la app muestra un mensaje claro y accionable
desde el catálogo controlado de la aplicación.

**Why this priority**: Evita estados confusos y mantiene la regla global del proyecto de no exponer
mensajes crudos del servicio. Es P2 porque el flujo feliz ya entrega valor, pero la experiencia real
depende de manejar estos casos.

**Independent Test**: Provocar cada impedimento contemplado y verificar que el mensaje visible es
controlado, comprensible y permite reintentar o volver.

**Acceptance Scenarios**:

1. **Given** el jugador ya tiene una partida activa, **When** intenta iniciar quick match, **Then** se
   informa que debe terminar o abandonar la partida actual antes de buscar rival.
2. **Given** el jugador tiene una revancha pendiente, **When** intenta iniciar quick match, **Then**
   se informa que debe resolver esa revancha antes de buscar rival.
3. **Given** hay un problema temporal de red o servicio, **When** intenta iniciar o cancelar la
   búsqueda, **Then** recibe un mensaje accionable y puede reintentar.
4. **Given** el servicio devuelve un detalle técnico, **When** se muestra el error al usuario, **Then**
   la UI usa una copia controlada y no muestra el texto crudo del servicio.

---

### Edge Cases

- **Emparejamiento inmediato**: al confirmar la búsqueda puede existir un rival compatible; el
  jugador debe ir directo a la partida sin ver una pantalla intermedia innecesaria.
- **Búsqueda prolongada**: si no aparece rival rápidamente, la pantalla debe seguir comunicando que
  la búsqueda está activa y mantener disponible la cancelación.
- **Intento repetido estando en cola**: volver a pulsar o reingresar al flujo no debe duplicar la
  búsqueda ni perder la posición ya obtenida.
- **Jugador ocupado**: si el jugador ya está en una partida, torneo o revancha pendiente, no puede
  entrar a la cola y debe ver un mensaje claro.
- **Cancelación idempotente**: cancelar cuando la búsqueda ya no existe no debe dejar al jugador en
  un estado roto.
- **Cambio de pantalla durante la búsqueda**: si el jugador vuelve al lobby o navega fuera de la
  pantalla de espera, la app debe evitar que quede una búsqueda activa sin una indicación clara o una
  cancelación explícita.
- **Pérdida y recuperación de conexión**: si la conexión se corta mientras busca rival, al recuperar
  la sesión la UI debe reflejar si sigue buscando, si fue emparejado o si debe reintentar.
- **Formato de serie inválido o no soportado**: la UI solo debe permitir mejor de 1, 3 o 5; cualquier
  rechazo del sistema debe mostrarse como configuración no válida, sin detalles técnicos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El lobby DEBE mostrar una opción de modo **Partida rápida** siguiendo la misma
  estructura visual de las opciones existentes: título, descripción breve y acción completa
  seleccionable.
- **FR-002**: La pantalla de Partida rápida DEBE mantener continuidad visual con el flujo online
  actual: navegación de vuelta al lobby, panel de configuración, selector de formato de serie y CTA
  principal.
- **FR-003**: El sistema DEBE permitir elegir únicamente los formatos de serie **Mejor de 1**,
  **Mejor de 3** y **Mejor de 5**.
- **FR-004**: El formato default DEBE ser **Mejor de 3** cuando el jugador no elige otra opción.
- **FR-005**: El sistema DEBE permitir al jugador iniciar una búsqueda automática de rival humano con
  el formato de serie seleccionado.
- **FR-006**: Al iniciar la búsqueda, el sistema DEBE deshabilitar acciones duplicadas y mostrar un
  indicador de progreso hasta conocer si el jugador quedó buscando o fue emparejado.
- **FR-007**: Si la búsqueda queda activa sin rival inmediato, el sistema DEBE mostrar un estado de
  espera con texto claro, el formato elegido y una acción de cancelar búsqueda.
- **FR-008**: El sistema DEBE permitir cancelar una búsqueda activa y volver a una pantalla operable
  desde la que el jugador pueda buscar de nuevo o regresar al lobby.
- **FR-009**: Si el jugador ya estaba en búsqueda, el sistema DEBE recuperar ese estado como
  búsqueda activa en lugar de tratarlo como un error bloqueante.
- **FR-010**: Si el emparejamiento se completa inmediatamente o durante la espera, el sistema DEBE
  llevar al jugador automáticamente al tablero de la partida creada.
- **FR-011**: La partida creada por quick match DEBE respetar el formato de serie elegido y las reglas
  de dominio de truco-to-three: partida individual a 3 puntos exactos y pérdida al pasarse de 3.
- **FR-012**: El sistema DEBE impedir que un jugador ocupado inicie quick match cuando ya tiene una
  partida activa, una participación incompatible o una revancha pendiente.
- **FR-013**: El sistema DEBE mostrar mensajes de error controlados por la aplicación para configuración
  inválida, jugador ocupado, búsqueda ya existente, problemas de red y errores inesperados.
- **FR-014**: La UI NO DEBE mostrar al usuario ningún mensaje crudo proveniente del servicio ni detalles
  técnicos de error.
- **FR-015**: La experiencia DEBE ser usable en mobile desde 360 px y en desktop, conservando el
  mismo sistema responsivo del lobby existente.
- **FR-016**: La pantalla de espera DEBE conservar un camino claro de salida: cancelar búsqueda o
  volver a una pantalla operable cuando ya no haya búsqueda activa.
- **FR-017**: Si el jugador abandona la pantalla de espera, el sistema DEBE evitar que quede buscando
  sin una decisión visible del usuario; debe cancelar, confirmar salida o mantener un indicador claro
  según el patrón definido en la app.
- **FR-018**: Los textos visibles DEBEN usar tono y nomenclatura consistente con el resto del lobby:
  "Partida rápida", "Buscar rival", "Buscando rival", "Cancelar búsqueda" y formatos "Mejor de 1/3/5".

### Key Entities

- **Búsqueda de partida rápida**: representa el intento activo de un jugador por encontrar rival
  humano. Atributos relevantes: estado (buscando o emparejado), formato de serie elegido, momento de
  ingreso y partida resultante si ya fue encontrada.
- **Formato de serie**: opción elegida para definir cuántas partidas integran la serie: mejor de 1,
  mejor de 3 o mejor de 5. No modifica la regla de puntaje interno de cada partida.
- **Partida rápida**: partida humano contra humano creada por emparejamiento automático, sin código
  compartido ni sala privada manual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un jugador autenticado puede iniciar una búsqueda de Partida rápida desde el lobby en
  menos de 20 segundos usando el valor default de serie.
- **SC-002**: El 100% de los formatos ofrecidos al usuario son válidos para la variante del producto:
  mejor de 1, mejor de 3 y mejor de 5.
- **SC-003**: En una búsqueda sin rival inmediato, el jugador entiende que sigue buscando y encuentra
  la acción de cancelar sin hacer scroll en mobile 360 x 780 y desktop 1440 x 900.
- **SC-004**: Cuando se completa el emparejamiento, el jugador llega al tablero de la partida sin
  acciones manuales adicionales.
- **SC-005**: El 100% de los errores contemplados muestran mensajes controlados por la aplicación y dejan
  al jugador con una acción clara: reintentar, cancelar o volver.
- **SC-006**: La incorporación de Partida rápida al lobby no degrada los flujos existentes de jugar
  contra bots, crear partida privada, unirse por código ni consultar reglas.

## Assumptions

- La feature está disponible para jugadores autenticados, incluyendo invitados, siempre que no estén
  ocupados por otra partida, torneo o revancha pendiente.
- El modo Partida rápida empareja exclusivamente partidas humano contra humano 1 vs 1.
- La selección de formato de serie reutiliza la misma semántica del resto del producto: mejor de 1,
  mejor de 3 y mejor de 5, con default mejor de 3.
- Quick match no reemplaza el flujo de partida privada por código; es un acceso paralelo para jugar
  contra un rival automático sin coordinación previa.
- Si el emparejamiento ya existe al momento de iniciar búsqueda, el jugador debe ir directo a la
  partida.
- La UI debe seguir la forma visual y patrones de interacción ya presentes en el lobby y la pantalla
  online, sin introducir un lenguaje visual nuevo.
- El alcance de esta especificación no incluye lobby público, rankings de matchmaking, elección de
  rival, filtros por nivel ni invitaciones sociales.
