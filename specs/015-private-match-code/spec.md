# Feature Specification: MVP de partida privada por código

**Feature Branch**: `015-private-match-code`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: "hagamos entonces el MVP de partida privada por codigo"

## Resumen

Hoy un jugador solo puede iniciar partidas contra bots. Esta feature habilita el primer modo
**jugador contra jugador (humano)**: un anfitrión crea una partida **privada**, recibe un **código
para compartir**, y un segundo jugador se une introduciendo ese código. Cuando ambos están en la
sala, el anfitrión inicia la partida y los dos pasan a jugar con el mismo tablero y reglas que ya
existen.

El alcance es deliberadamente acotado al **flujo privado por código**: no incluye un lobby público
de descubrimiento de partidas de desconocidos (queda para una iteración posterior).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear partida privada y compartir el código (Priority: P1)

Un jugador autenticado elige crear una partida online privada, selecciona el formato de serie
(mejor de 1, 3 o 5) y la crea. Inmediatamente ve un **código de partida** claramente destacado y
fácil de copiar para enviárselo a un amigo por el canal que prefiera (chat externo, mensaje, etc.).
Queda en una **sala de espera** indicando que aguarda al rival.

**Why this priority**: Es el punto de entrada de todo el modo online. Sin la capacidad de crear y
obtener un código compartible no hay forma de iniciar una partida entre humanos. Es el primer slice
con valor demostrable.

**Independent Test**: Se puede probar de forma aislada creando una partida privada y verificando que
(a) se genera y muestra un código, (b) el código se puede copiar, y (c) el creador queda en estado
de espera del rival.

**Acceptance Scenarios**:

1. **Given** un jugador autenticado en la pantalla de creación de partida online, **When** elige un
   formato de serie y confirma la creación, **Then** el sistema crea una partida privada y muestra
   el código de partida asociado.
2. **Given** una partida privada recién creada, **When** el creador ve la sala de espera, **Then** se
   muestra el código de forma destacada con una acción para copiarlo y un indicador de que se espera
   al rival.
3. **Given** que la creación falla porque el jugador ya tiene una partida o una revancha pendiente,
   **When** el sistema responde con ese impedimento, **Then** se muestra un mensaje claro de por qué
   no se pudo crear y el jugador permanece en una pantalla operable (no en una sala rota).

---

### User Story 2 - Unirse a una partida con un código (Priority: P1)

Un segundo jugador autenticado recibe un código por fuera de la app, lo introduce en la opción
"unirse por código" y entra a la partida. Si el código es válido y la partida admite un segundo
jugador, queda incorporado a la sala junto al anfitrión.

**Why this priority**: Es la contraparte imprescindible de la US1. Crear un código no tiene valor si
nadie puede usarlo para unirse. Juntas (US1 + US2) forman el MVP mínimo de "jugar online con un
amigo".

**Independent Test**: Con un código de una partida privada existente y abierta, introducirlo y
verificar que el jugador queda unido a esa partida y ve la sala con ambos participantes.

**Acceptance Scenarios**:

1. **Given** un jugador autenticado con un código válido de una partida privada abierta, **When** lo
   introduce y confirma, **Then** queda incorporado a esa partida y ve la sala de espera con el
   anfitrión y él mismo presentes.
2. **Given** un código que no corresponde a ninguna partida, **When** el jugador lo introduce,
   **Then** se muestra un mensaje indicando que el código no es válido y el jugador puede reintentar.
3. **Given** un código de una partida que ya está llena o ya no admite unirse, **When** el jugador lo
   introduce, **Then** se muestra un mensaje explicando que no puede unirse y el jugador permanece en
   una pantalla operable.
4. **Given** que el jugador ya tiene una partida activa o una revancha pendiente, **When** intenta
   unirse con un código, **Then** se le informa el impedimento sin dejarlo en un estado inconsistente.

---

### User Story 3 - Iniciar la partida y pasar a jugar (Priority: P2)

Con el anfitrión y el rival ya presentes en la sala, el anfitrión inicia la partida. Ambos jugadores
pasan automáticamente del estado de espera al tablero de juego, con las mismas mecánicas, reglas y
temporizador que ya funcionan contra bots.

**Why this priority**: Cierra el ciclo del MVP: convierte la sala de espera en una partida real. Es
P2 porque depende de que US1 y US2 ya existan, pero es indispensable para que la feature entregue
valor de punta a punta.

**Independent Test**: Con anfitrión y rival en una sala lista, ejecutar el inicio y verificar que
ambos transicionan al tablero y pueden jugar la primera mano.

**Acceptance Scenarios**:

1. **Given** una sala privada con ambos jugadores presentes, **When** el anfitrión inicia la partida,
   **Then** ambos jugadores pasan de la sala de espera al tablero de juego en curso.
2. **Given** una sala privada con un solo jugador (sin rival aún), **When** el anfitrión observa los
   controles, **Then** la acción de iniciar no está disponible hasta que el rival se una.
3. **Given** una partida en curso entre dos humanos, **When** ambos juegan, **Then** las acciones de
   juego (jugar carta, cantar/responder truco y envido, irse al mazo) y el resultado final se
   comportan igual que en una partida contra bots.

---

### User Story 4 - Salir de la sala antes de empezar (Priority: P3)

Mientras se aguarda en la sala (antes de que la partida comience), cualquiera de los jugadores puede
retirarse. Si se va el anfitrión, la sala se cancela y el rival es notificado. Si se va el segundo
jugador, la sala vuelve a quedar a la espera de un rival y el anfitrión sigue pudiendo compartir el
mismo código.

**Why this priority**: Evita que los jugadores queden "atrapados" en salas que no van a comenzar y
da un cierre limpio a casos de arrepentimiento o demora. Es P3 porque el MVP es demostrable sin ello,
pero mejora notablemente la experiencia y la robustez.

**Independent Test**: En una sala de espera, hacer que un jugador se retire y verificar que el otro
recibe el estado correcto (sala cancelada si se fue el anfitrión; sala nuevamente a la espera si se
fue el segundo jugador).

**Acceptance Scenarios**:

1. **Given** una sala de espera donde el anfitrión aún no inició, **When** el anfitrión decide salir,
   **Then** la partida queda cancelada y el rival (si estaba presente) es notificado y enviado a una
   pantalla operable.
2. **Given** una sala de espera con anfitrión y rival, **When** el rival decide salir antes de
   comenzar, **Then** la sala vuelve al estado de espera de rival y el anfitrión conserva el mismo
   código para que se una otra persona.
3. **Given** que un jugador abandona la app o pierde conexión estando en la sala, **When** vuelve a
   abrir la partida, **Then** ve el estado actualizado y consistente de la sala (o el aviso de que ya
   no existe).

---

### Edge Cases

- **Código inexistente o mal escrito**: el sistema debe informar que el código no es válido sin
  romper la pantalla ni dejar la sesión en estado ambiguo.
- **Partida llena / carrera por el último lugar**: si dos personas intentan unirse casi a la vez con
  el mismo código, solo una entra; la otra recibe un aviso de que ya no hay lugar.
- **Jugador ocupado**: si quien crea o se une ya tiene una partida activa o una revancha pendiente,
  se le explica el impedimento en lugar de fallar de forma silenciosa.
- **Autounión imposible**: el anfitrión no puede unirse a su propia partida con el código (ya está
  dentro).
- **Reconexión en la sala**: si la conexión se cae mientras se espera, al recuperarla la sala debe
  mostrar el estado real (rival presente o no, sala cancelada, etc.).
- **Llegada del rival mientras el anfitrión mira la sala**: cuando el segundo jugador se une, el
  anfitrión debe ver el cambio reflejado sin tener que recargar manualmente.
- **Pérdida del código**: el creador debe poder volver a ver/copiar el código mientras siga en la
  sala de espera.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer a un jugador autenticado una forma de crear una partida online
  **privada**, eligiendo el formato de serie permitido (mejor de 1, 3 o 5).
- **FR-002**: Al crear la partida, el sistema MUST mostrar al creador un **código de partida**
  compartible, de forma destacada y con una acción para copiarlo.
- **FR-003**: El sistema MUST permitir a un jugador autenticado **unirse** a una partida introduciendo
  un código de partida válido.
- **FR-004**: Tras crear o unirse, el sistema MUST mostrar una **sala de espera** que indique
  claramente el estado: a la espera de rival, o rival presente y listo para iniciar.
- **FR-005**: El sistema MUST reflejar en la sala, **sin recarga manual**, la incorporación del
  segundo jugador para el anfitrión, y los cambios de estado relevantes para ambos.
- **FR-006**: El sistema MUST permitir al **anfitrión iniciar** la partida únicamente cuando el rival
  ya está presente; la acción de iniciar no debe estar disponible mientras falte el rival.
- **FR-007**: Al iniciarse la partida, el sistema MUST transicionar a **ambos** jugadores desde la
  sala de espera al tablero de juego en curso.
- **FR-008**: Una partida privada entre dos humanos MUST soportar las mismas mecánicas, reglas de
  puntaje (partida a 3 puntos exactos; series mejor de 1/3/5), acciones de juego y resolución de fin
  de partida que ya existen contra bots.
- **FR-009**: El sistema MUST permitir a cualquiera de los jugadores **salir de la sala antes de que
  la partida comience**, con el comportamiento correcto según quién sale: cancelación de la partida
  si sale el anfitrión; retorno a "espera de rival" si sale el segundo jugador.
- **FR-010**: El sistema MUST notificar al jugador que permanece cuando el otro **sale o cancela** la
  sala, y conducirlo a una pantalla operable.
- **FR-011**: El sistema MUST mostrar mensajes de error comprensibles y orientados al usuario para los
  casos: código inexistente, partida llena o no disponible para unirse, y jugador ya ocupado (partida
  activa o revancha pendiente), usando el catálogo de copy del front (sin exponer mensajes crudos del
  backend).
- **FR-012**: El sistema MUST impedir que el anfitrión se una a su propia partida mediante el código.
- **FR-013**: Ante una **reconexión** estando en la sala de espera, el sistema MUST recuperar y mostrar
  el estado real y actualizado de la sala (rival presente, sala cancelada o inexistente).
- **FR-014**: El creador MUST poder **volver a ver y copiar** el código mientras permanezca en la sala
  de espera.

### Key Entities *(include if feature involves data)*

- **Partida privada**: representa el encuentro entre dos jugadores creado en modo privado. Atributos
  relevantes a nivel de producto: identificador de la partida, formato de serie (mejor de 1/3/5),
  estado (esperando rival, lista para iniciar, en curso, cancelada), y participantes (anfitrión y
  rival).
- **Código de partida**: identificador corto y compartible que permite a un segundo jugador unirse a
  una partida privada concreta.
- **Sala de espera**: la representación, mientras la partida aún no comenzó, del estado de la partida
  y de quiénes están presentes, con las acciones disponibles según el rol (anfitrión vs. invitado).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dos jugadores que se conocen pueden pasar de "quiero jugar" a "jugando una mano" usando
  solo el código compartido, sin asistencia técnica.
- **SC-002**: Un anfitrión puede crear una partida privada y obtener el código en menos de 30 segundos
  desde que entra a la pantalla de creación.
- **SC-003**: Cuando el rival se une, el anfitrión ve el cambio de estado de la sala en menos de 3
  segundos, sin recargar la página.
- **SC-004**: El 100% de los casos de error contemplados (código inexistente, partida llena, jugador
  ocupado) muestran un mensaje claro y dejan al usuario en una pantalla desde la que puede reintentar
  o volver, sin estados rotos.
- **SC-005**: Una partida privada entre dos humanos se juega de principio a fin (incluido el resultado
  final) sin diferencias funcionales respecto de una partida contra bots.

## Assumptions

- El modo online se construye **sobre la infraestructura de tiempo real y de partida ya existente**
  (la misma que hoy soporta las partidas contra bots): tablero, acciones de juego, temporizador,
  reconciliación de estado y resolución de fin de partida se reutilizan.
- El alcance de esta feature es **solo partidas privadas por código**. El **lobby público** de
  descubrimiento (listar partidas de desconocidos, unirse desde un listado, reconciliación de deltas
  del lobby) queda **fuera de alcance** y se aborda en una iteración posterior.
- Cualquier usuario autenticado puede crear o unirse a una partida privada, incluidos los invitados
  (guests), salvo que tenga una partida activa o una revancha pendiente que lo impida.
- El **canje del código se hace por fuera de la app** (mensajería, voz, etc.); la feature no incluye
  envío del código por canales internos ni invitaciones sociales (esas son features aparte).
- La selección de formato de serie reutiliza el mismo control y las mismas reglas de validación que
  el flujo contra bots (mejor de 1/3/5; default mejor de 3).
- En el modo privado, la partida **no arranca automáticamente** al unirse el rival: requiere una
  acción explícita de inicio por parte del anfitrión.
- El temporizador de inactividad por turno aplica igual que en partidas contra bots una vez la
  partida está en curso.
