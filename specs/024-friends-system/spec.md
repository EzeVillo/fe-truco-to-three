# Feature Specification: Sistema de amigos (MVP solo amistades)

**Feature Branch**: `024-friends-system`

**Created**: 2026-06-05

**Status**: Draft

**Input**: User description: "Sistema de amigos (MVP solo amistades) para truco-to-three. Página dedicada en ruta /friends protegida por authGuard, con tabs Amigos, Solicitudes recibidas y Solicitudes enviadas. El identificador del otro usuario es siempre el username. Capacidades: enviar solicitud de amistad por username; ver y aceptar/rechazar solicitudes entrantes; ver y cancelar solicitudes salientes; listar amigos y eliminar a un amigo. Actualizaciones en tiempo real vía WebSocket /user/queue/social. Solo usuarios registrados (guests fuera). Fuera de alcance: invitaciones a recursos (match/liga/copa) y DM de amistad."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agregar a un amigo por nombre de usuario (Priority: P1)

Una jugadora registrada quiere conectarse con alguien que conoce. Ingresa el nombre de usuario de la otra persona y le envía una solicitud de amistad. La solicitud queda registrada como "enviada / pendiente" y la otra persona la recibe para decidir.

**Why this priority**: Es el punto de entrada de todo el sistema social. Sin la capacidad de enviar una solicitud, no existe ninguna relación de amistad que listar, aceptar ni gestionar. Es el mínimo que entrega valor por sí solo.

**Independent Test**: Se puede probar enviando una solicitud a un username válido y verificando que aparece en la lista de "Solicitudes enviadas" como pendiente, y que un segundo usuario la ve en sus "Solicitudes recibidas".

**Acceptance Scenarios**:

1. **Given** una jugadora autenticada y registrada en la página de amigos, **When** ingresa el username de otra persona registrada y confirma el envío, **Then** la solicitud aparece en su pestaña "Solicitudes enviadas" como pendiente.
2. **Given** una solicitud recién enviada, **When** la destinataria abre su página de amigos, **Then** ve la solicitud en su pestaña "Solicitudes recibidas".
3. **Given** la jugadora ingresa su propio username, **When** intenta enviar la solicitud, **Then** el sistema impide el envío y muestra un mensaje claro de que no puede agregarse a sí misma.
4. **Given** la jugadora ingresa un username que no existe o que ya es amigo/tiene solicitud pendiente, **When** intenta enviar, **Then** el sistema muestra un mensaje de error controlado y no crea una solicitud duplicada.

---

### User Story 2 - Responder solicitudes recibidas (Priority: P1)

Una jugadora recibe solicitudes de amistad de otras personas. En la pestaña "Solicitudes recibidas" puede aceptarlas (creando la amistad) o rechazarlas (descartándolas). Al aceptar, ambas personas pasan a verse mutuamente como amigos.

**Why this priority**: Una solicitud que no se puede responder no genera ninguna amistad. Junto con la US1 forma el bucle mínimo completo (enviar → recibir → aceptar) que produce el primer amigo. Es P1 porque es indispensable para que el sistema entregue su valor central.

**Independent Test**: Con una solicitud entrante existente, aceptarla y verificar que desaparece de "Solicitudes recibidas" y aparece en "Amigos"; alternativamente rechazarla y verificar que desaparece sin crear amistad.

**Acceptance Scenarios**:

1. **Given** una solicitud pendiente en "Solicitudes recibidas", **When** la jugadora la acepta, **Then** la solicitud desaparece de esa pestaña y la otra persona aparece en la pestaña "Amigos".
2. **Given** una solicitud pendiente en "Solicitudes recibidas", **When** la jugadora la rechaza, **Then** la solicitud desaparece de la lista y no se crea ninguna amistad.
3. **Given** la jugadora que envió una solicitud, **When** la otra persona la acepta, **Then** la jugadora ve a la nueva persona en su pestaña "Amigos" sin recargar la página.

---

### User Story 3 - Ver y gestionar la lista de amigos (Priority: P2)

Una jugadora quiere ver con quién está conectada y, si lo desea, eliminar a un amigo. La pestaña "Amigos" lista a todas sus amistades confirmadas y permite quitar a cualquiera; al eliminar, la relación desaparece para ambas partes.

**Why this priority**: Aporta el cierre del ciclo de vida de la amistad (consulta y baja). Depende de que existan amistades creadas (US1 + US2), por eso es P2: valiosa pero no indispensable para el primer slice funcional.

**Independent Test**: Con al menos una amistad existente, abrir la pestaña "Amigos", verla listada, eliminarla y confirmar que desaparece de la lista de ambas partes.

**Acceptance Scenarios**:

1. **Given** una jugadora con amistades confirmadas, **When** abre la pestaña "Amigos", **Then** ve la lista completa de sus amigos identificados por su username.
2. **Given** un amigo en la lista, **When** la jugadora confirma su eliminación, **Then** el amigo desaparece de su lista de "Amigos".
3. **Given** dos personas que son amigas, **When** una de ellas elimina la amistad, **Then** la otra deja de ver a esa persona en su lista de "Amigos" sin recargar la página.

---

### User Story 4 - Cancelar una solicitud enviada (Priority: P3)

Una jugadora que envió una solicitud y se arrepiente puede cancelarla desde la pestaña "Solicitudes enviadas" antes de que la otra persona responda.

**Why this priority**: Mejora el control del usuario sobre sus acciones, pero el sistema entrega valor sin esta capacidad (las solicitudes igualmente expiran/pueden ser rechazadas). Por eso es P3.

**Independent Test**: Con una solicitud saliente pendiente, cancelarla y verificar que desaparece de "Solicitudes enviadas" y que la destinataria deja de verla en "Solicitudes recibidas".

**Acceptance Scenarios**:

1. **Given** una solicitud pendiente en "Solicitudes enviadas", **When** la jugadora la cancela, **Then** la solicitud desaparece de esa pestaña.
2. **Given** una solicitud cancelada, **When** la destinataria mira sus "Solicitudes recibidas", **Then** la solicitud ya no aparece, sin necesidad de recargar.

---

### Edge Cases

- **Usuario invitado (guest)**: el sistema de amigos no está disponible para guests; estos no deben poder acceder a la funcionalidad y, si llegan a la página, se les comunica que requiere una cuenta registrada.
- **Doble acción simultánea**: si dos personas se envían solicitud mutuamente, o una acepta mientras la otra cancela, el sistema debe reconciliar el estado final coherente (amistad creada o solicitud desaparecida) sin dejar entradas fantasma en las listas.
- **Evento en tiempo real de algo ya visto**: si llega una notificación de un cambio que la lista ya reflejaba (p. ej. amistad ya aceptada), la lista no debe duplicar entradas ni alterarse incorrectamente (idempotencia).
- **Solicitud a quien ya es amigo o ya tiene solicitud pendiente**: el sistema rechaza el envío con mensaje controlado, sin crear duplicados.
- **Username inexistente o vacío**: el envío se bloquea con mensaje de error controlado.
- **Conexión en tiempo real caída**: al reconectarse, las listas reflejan el estado correcto (se reconcilian); mientras tanto, las acciones por demanda siguen funcionando.
- **Error del backend**: cualquier fallo se comunica al usuario con copy controlado del front, nunca con el mensaje crudo del backend.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a una jugadora registrada y autenticada acceder a una sección de amigos dedicada, organizada en tres vistas: "Amigos", "Solicitudes recibidas" y "Solicitudes enviadas".
- **FR-002**: El sistema MUST permitir enviar una solicitud de amistad identificando a la otra persona por su nombre de usuario.
- **FR-003**: El sistema MUST impedir que una jugadora se envíe una solicitud a sí misma y comunicarlo con un mensaje claro.
- **FR-004**: El sistema MUST impedir solicitudes duplicadas (a alguien que ya es amigo o que ya tiene una solicitud pendiente entre ambas partes) y comunicarlo con un mensaje claro.
- **FR-005**: El sistema MUST listar las solicitudes de amistad recibidas pendientes, identificando a la persona remitente por su username.
- **FR-006**: El sistema MUST permitir aceptar una solicitud recibida, lo que crea la amistad y la refleja en la lista de amigos de ambas partes.
- **FR-007**: El sistema MUST permitir rechazar una solicitud recibida, descartándola sin crear amistad.
- **FR-008**: El sistema MUST listar las solicitudes de amistad enviadas pendientes, identificando a la persona destinataria por su username.
- **FR-009**: El sistema MUST permitir cancelar una solicitud enviada que aún esté pendiente.
- **FR-010**: El sistema MUST listar las amistades confirmadas, identificando a cada amigo por su username.
- **FR-011**: El sistema MUST permitir eliminar una amistad confirmada, lo que la quita de la lista de amigos de ambas partes.
- **FR-012**: El sistema MUST actualizar las listas de amigos y solicitudes en tiempo real ante cambios relevantes (solicitud recibida, solicitud aceptada, solicitud rechazada, solicitud cancelada, amistad eliminada), sin requerir que la jugadora recargue la página.
- **FR-013**: El sistema MUST reconciliar las actualizaciones en tiempo real de forma idempotente, sin generar entradas duplicadas ni inconsistentes cuando un cambio ya estaba reflejado.
- **FR-014**: El sistema MUST restringir la funcionalidad de amigos exclusivamente a usuarios registrados; los usuarios invitados (guest) no deben poder usarla.
- **FR-015**: El sistema MUST comunicar todos los errores mediante mensajes controlados y propios del producto, sin exponer nunca el mensaje crudo del backend.
- **FR-016**: El sistema MUST mantener una experiencia coherente y usable en pantallas mobile (desde 360 px de ancho) y desktop.
- **FR-017**: El sistema MUST reflejar visualmente los estados de carga y vacío de cada lista (cargando, sin amigos, sin solicitudes) de forma comprensible.
- **FR-018**: El sistema MUST dejar fuera de esta entrega las invitaciones a recursos (partida, liga, copa) y la mensajería directa (DM) entre amigos.

### Key Entities *(include if feature involves data)*

- **Amigo**: una persona con la que existe una amistad confirmada. Se identifica únicamente por su username.
- **Solicitud de amistad recibida**: una solicitud pendiente dirigida a la jugadora actual, identificada por el username de quien la envió.
- **Solicitud de amistad enviada**: una solicitud pendiente creada por la jugadora actual, identificada por el username de la persona destinataria.
- **Notificación social en tiempo real**: un aviso de cambio en el estado de una relación o solicitud (recibida, aceptada, rechazada, cancelada, amistad eliminada) que dispara la reconciliación de las listas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una jugadora puede enviar una solicitud de amistad en 3 pasos o menos desde que abre la sección de amigos (abrir → ingresar username → confirmar).
- **SC-002**: Cuando la otra persona acepta una solicitud, la nueva amistad aparece en la lista de la jugadora en menos de 3 segundos sin que esta recargue la página.
- **SC-003**: El 100% de los errores presentados al usuario usan copy del producto; en ninguna circunstancia se muestra el texto de error crudo del backend.
- **SC-004**: Las tres listas (amigos, recibidas, enviadas) reflejan el estado correcto tras cualquier acción propia o cambio remoto, sin entradas duplicadas ni fantasma, verificado en escenarios de acción concurrente.
- **SC-005**: La sección de amigos es completamente operable en una pantalla de 360 px de ancho sin desbordes ni controles inaccesibles.
- **SC-006**: Un usuario invitado nunca obtiene acceso a la funcionalidad de amigos.

## Assumptions

- Existe un backend con la capa social completa (solicitudes y amistades por username) y un canal de eventos en tiempo real; el front consume ese contrato sin modificarlo (referencia: `docs/CONTRATOS_API.md §7.5` y `§9.5e`).
- El identificador público de cualquier persona en este dominio es el `username`; no se expone ningún identificador interno de la amistad.
- La autenticación y la distinción registrado/guest ya existen en el producto y se reutilizan (no se diseñan aquí).
- Las invitaciones a recursos (match/liga/copa) y el DM de amistad existen en el backend pero quedan deliberadamente fuera de esta entrega; podrán construirse sobre esta base más adelante.
- El acceso a la sección de amigos se ofrece desde la navegación existente del producto (p. ej. header o lobby); el punto de entrada exacto se define en diseño/implementación.
- No se contempla bloqueo de usuarios, búsqueda con autocompletado, ni estado de presencia/online dentro de la lista de amigos en esta entrega.
