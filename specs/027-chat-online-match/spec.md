# Feature Specification: Chat en vivo para partidas online

**Feature Branch**: `027-chat-online-match`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "agregar la feature del chat como MVP para partidas online (no bots); botón para abrir el chat desde el menú hamburguesa; se despliega desde el costado derecho; carga todos los mensajes, los recibe en vivo, con cooldown para el botón de enviar dependiendo del tiempo que devuelva la API"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Leer la conversación de la partida (Priority: P1)

Durante una partida online (humano vs humano), el jugador abre el menú hamburguesa y elige
"Chat". Se despliega un panel desde el costado derecho que muestra el historial completo de
mensajes de la partida (hasta los últimos 50), identificando quién escribió cada uno y en qué
orden. El jugador puede cerrar el panel y volver a abrirlo sin perder la conversación.

**Why this priority**: Es el corazón del MVP. Sin poder ver los mensajes, ninguna otra parte de la
feature aporta valor. Es la rebanada mínima que ya entrega utilidad (ver lo que el rival escribió).

**Independent Test**: En una partida online con mensajes previos, abrir el panel desde el
hamburguesa y verificar que se listan todos los mensajes existentes con autor y orden correctos.

**Acceptance Scenarios**:

1. **Given** una partida online en curso con mensajes previos, **When** el jugador abre "Chat"
   desde el menú hamburguesa, **Then** el panel se despliega desde la derecha y muestra todos los
   mensajes existentes (hasta 50) en orden cronológico, con el autor de cada uno.
2. **Given** el panel de chat abierto, **When** el jugador lo cierra y lo vuelve a abrir, **Then**
   la conversación sigue visible sin recargarse desde cero de forma visible para el usuario.
3. **Given** una partida online sin mensajes aún, **When** el jugador abre el chat, **Then** ve un
   estado vacío claro indicando que todavía no hay mensajes.

---

### User Story 2 - Recibir mensajes en vivo (Priority: P1)

Mientras el panel de chat está abierto (o cerrado), los mensajes que envía el rival aparecen en la
conversación en tiempo real, sin que el jugador tenga que recargar ni reabrir el panel.

**Why this priority**: Un chat que no actualiza en vivo obliga a recargar y rompe la experiencia de
conversación durante la partida. Junto con la US1 forma el MVP real de "chat".

**Independent Test**: Con dos sesiones en la misma partida online, enviar un mensaje desde una y
verificar que aparece en la otra en segundos, sin interacción manual.

**Acceptance Scenarios**:

1. **Given** dos jugadores en la misma partida online y el panel de chat abierto en uno de ellos,
   **When** el otro jugador envía un mensaje, **Then** el mensaje aparece en la conversación del
   primero en tiempo real.
2. **Given** el panel de chat cerrado, **When** llega un mensaje nuevo en vivo, **Then** al abrir
   el panel el mensaje ya está presente en la conversación.
3. **Given** el chat de la partida recién creado, **When** se inicia la partida, **Then** el cliente
   queda preparado para recibir los mensajes de esa conversación.

---

### User Story 3 - Enviar mensajes con cooldown (Priority: P2)

El jugador escribe un mensaje y lo envía. El botón de enviar entra en un período de espera
(cooldown) cuya duración la determina la respuesta del servidor, evitando que el jugador mande
mensajes demasiado seguido. El cooldown se mantiene correctamente incluso si el jugador recarga la
página durante la espera.

**Why this priority**: Aporta la capacidad de participar, no solo leer. Depende de US1/US2 para ser
útil, por eso es P2. El cooldown es requisito explícito y debe respetar el límite del servidor.

**Independent Test**: Enviar un mensaje y verificar que el botón de enviar queda deshabilitado hasta
el momento indicado por el servidor; al recargar durante la espera, el botón sigue bloqueado el
tiempo restante.

**Acceptance Scenarios**:

1. **Given** el chat abierto y el jugador habilitado para enviar, **When** envía un mensaje válido,
   **Then** el mensaje se incorpora a la conversación y el botón de enviar entra en cooldown hasta
   el instante que indica el servidor.
2. **Given** el botón en cooldown, **When** el jugador intenta enviar otro mensaje antes de que
   termine, **Then** el sistema no permite el envío y comunica de forma clara que debe esperar.
3. **Given** un envío en cooldown, **When** el jugador recarga la página, **Then** al reabrir el
   chat el cooldown restante se reconstruye según el estado del servidor (no se reinicia ni se
   pierde).
4. **Given** el campo de mensaje, **When** el jugador escribe más de 500 caracteres o un mensaje
   vacío, **Then** el sistema impide el envío y lo señala antes o durante el intento.

---

### Edge Cases

- **Partida contra bot**: el chat no existe para partidas vs bots. El acceso al chat no debe
  ofrecerse en ese contexto.
- **Mensaje rechazado por rate limit**: si el servidor rechaza un envío por exceso de frecuencia, el
  cliente debe reconciliar el cooldown leyendo el estado actual del chat (el error de rate limit no
  trae el dato de cooldown).
- **Buffer de 50 mensajes lleno**: al superar 50 mensajes, los más antiguos dejan de estar
  disponibles; la UI no debe asumir que tiene todo el histórico de la partida.
- **Chat aún no disponible / partida terminada**: si la conversación todavía no existe o ya fue
  eliminada (fin o cancelación de la partida), la UI debe manejarlo sin romperse ni mostrar errores
  crudos.
- **Pérdida temporal de conexión en tiempo real**: al reconectarse, los mensajes perdidos durante la
  caída deben poder recuperarse (relectura del historial).
- **Mensaje propio**: el mensaje que envía el propio jugador también llega por el canal en vivo; no
  debe duplicarse en la conversación.
- **Errores del servidor**: cualquier error de red o del backend se comunica con copy controlado del
  front, nunca con el mensaje crudo del backend.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer un acceso al chat dentro del menú hamburguesa, visible
  únicamente durante partidas online (humano vs humano) que tengan una conversación asociada.
- **FR-002**: El sistema MUST NOT ofrecer el acceso al chat en partidas contra bots.
- **FR-003**: Al activarlo, el sistema MUST desplegar un panel de chat desde el costado derecho de
  la pantalla, y permitir cerrarlo para volver a la vista de la partida.
- **FR-004**: El sistema MUST cargar y mostrar el historial de mensajes de la partida (hasta 50),
  en orden cronológico, indicando el autor y el momento de cada mensaje.
- **FR-005**: El sistema MUST recibir y mostrar mensajes nuevos en tiempo real mientras el jugador
  está en la partida, esté el panel abierto o cerrado.
- **FR-006**: El sistema MUST evitar duplicar el mensaje propio cuando este vuelve por el canal en
  tiempo real.
- **FR-007**: El sistema MUST permitir al jugador redactar y enviar un mensaje de texto desde el
  panel de chat.
- **FR-008**: El sistema MUST impedir el envío de mensajes vacíos o de más de 500 caracteres, y
  comunicarlo al jugador.
- **FR-009**: Tras un envío aceptado, el sistema MUST aplicar un cooldown al botón de enviar cuya
  duración se deriva del instante de próximo envío permitido que devuelve el servidor.
- **FR-010**: Durante el cooldown, el sistema MUST impedir nuevos envíos y comunicar de forma clara
  que el jugador debe esperar, mostrando preferentemente el tiempo restante.
- **FR-011**: El sistema MUST reconstruir el cooldown restante tras una recarga de página, a partir
  del estado de envío que provee el servidor (no reiniciarlo ni descartarlo).
- **FR-012**: Si un envío es rechazado por rate limit, el sistema MUST reconciliar el cooldown
  releyendo el estado del chat.
- **FR-013**: El sistema MUST manejar los casos de chat inexistente, partida finalizada/cancelada y
  errores de red mostrando copy controlado del front, sin exponer mensajes crudos del backend.
- **FR-014**: El sistema MUST recuperar los mensajes vía relectura del historial tras una
  reconexión del canal en tiempo real.
- **FR-015**: El panel y sus controles MUST cumplir el diseño responsivo del proyecto (mobile desde
  360 px y desktop), usando los componentes y estilos tematizados del producto.

### Key Entities *(include if feature involves data)*

- **Conversación de partida (Chat)**: la conversación asociada a una partida online. Tiene una
  identidad propia, un tipo de recurso padre (partida) y el identificador de la partida. Contiene
  hasta 50 mensajes (buffer circular).
- **Mensaje**: una entrada de la conversación, con identidad propia, autor (nombre de usuario),
  contenido de texto (máx. 500 caracteres) y momento de envío.
- **Estado de envío del jugador (sendState)**: indica si el jugador autenticado puede enviar ahora
  y, si no, el instante a partir del cual podrá volver a enviar (base del cooldown).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un jugador puede abrir el chat y ver el historial completo de la partida en menos de 2
  segundos desde que activa el acceso, en condiciones de red normales.
- **SC-002**: Un mensaje enviado por el rival aparece en la conversación del jugador en menos de 2
  segundos sin ninguna acción manual.
- **SC-003**: El 100% de los intentos de enviar dos mensajes seguidos antes de que termine el
  cooldown son bloqueados por la UI (cero mensajes enviados durante el período de espera).
- **SC-004**: Tras recargar la página durante un cooldown activo, el botón de enviar permanece
  bloqueado el tiempo restante con un margen de error de a lo sumo 1 segundo respecto del servidor.
- **SC-005**: En partidas contra bots, el acceso al chat nunca aparece (0 ocurrencias).
- **SC-006**: Ningún error (chat inexistente, partida terminada, red caída, rate limit) muestra al
  usuario texto crudo proveniente del backend.

## Assumptions

- **Alcance del MVP**: solo chat de **partidas online (`MATCH`, humano vs humano)**. Quedan fuera
  los chats de liga (`LEAGUE`), copa (`CUP`) y el DM efímero entre amigos (`FRIENDSHIP`), aunque el
  backend los soporta; podrían reutilizar el mismo motor a futuro.
- **Sin badge de no leídos en v1**: no se incluye contador ni indicador de mensajes no leídos en el
  botón del hamburguesa; se evaluará en una iteración posterior.
- **Detección de partida vs bot**: se asume que en una partida contra bot no existe conversación
  asociada y por eso el acceso al chat no se ofrece; el front determina el contexto online/bot con
  la información de la partida que ya maneja.
- **Identificación del chat**: la conversación se localiza a partir del identificador de la partida
  en curso (recurso padre = partida).
- **Reutilización de infraestructura existente**: se reutiliza la conexión de tiempo real ya usada
  por la partida (canal de chat por usuario) y el patrón de feature existente del proyecto.
- **Contrato del backend**: el contrato de chat (endpoints REST, eventos en tiempo real, límites de
  50 mensajes / 500 caracteres / 2 s de rate limit y el estado de envío con próximo envío permitido)
  está documentado y es la fuente autoritativa; el front se valida campo a campo contra él.
- **Solo usuarios registrados**: el chat aplica a jugadores autenticados que participan de la
  partida; espectadores y guests quedan fuera del alcance de envío/lectura en este MVP.

## Dependencies

- Contrato de chat documentado en `docs/CONTRATOS_API.md §7` (REST) y §9.5d (eventos de tiempo
  real `CHAT_CREATED` / `MESSAGE_SENT` por `/user/queue/chat`).
- Infraestructura de tiempo real existente del proyecto para suscripción por usuario.
- Información de la partida en curso (identificador y si es online o vs bot).
