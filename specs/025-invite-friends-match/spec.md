# Feature Specification: Invitar a partida a los amigos

**Feature Branch**: `025-invite-friends-match`

**Created**: 2026-06-05

**Status**: Draft

**Input**: User description: "hagamos la opcion de invitar a partida a los amigos"

## Clarifications

### Session 2026-06-05

- Q: ¿Se puede invitar desde la pantalla de espera de la partida y también desde la página
  de amigos? → A: Ambas. El contrato (`POST /api/social/invitations` con `targetType: MATCH`
  + `targetId`) no depende de la pantalla; sólo requiere una partida propia que aún admita
  ingreso. La partida activa se obtiene vía presencia (`GET /api/me/presence`).
- Q: Desde la página de amigos, al invitar sin tener una partida propia esperando rival,
  ¿qué pasa? → A: Se redirige a crear partida; la invitación recién se puede enviar una vez
  que la partida ya está creada y esperando rival.
- Q: ¿Dónde se le muestran al destinatario las invitaciones a partida recibidas? → A: Sólo
  como toast/notificación en vivo (con aceptar/rechazar); no hay una lista persistente en la
  UI para revisarlas más tarde.

### Session 2026-06-06

- Q: ¿Se incorporan los nuevos campos de disponibilidad de amigos del contrato? → A: Sí.
  `GET /api/social/friendships` ahora expone por amigo `online`, `availability`
  (`AVAILABLE` | `BUSY`) y `busyReason`; se usan para mostrar disponibilidad y habilitar o
  no la acción de invitar.
- Q: ¿La disponibilidad se reconcilia en vivo? → A: Sí. Al suscribirse a
  `/user/queue/social` llega un snapshot `FRIEND_AVAILABILITY_STATE` y luego deltas
  `FRIEND_AVAILABILITY_CHANGED` por amigo.
- Q: ¿Cómo se muestran los amigos `BUSY` en la UI de invitar? → A: Se muestran todos los
  amigos; sólo se deshabilita la acción de invitar del amigo ocupado (con el motivo), sin
  que la fila/contenedor del amigo se vea deshabilitada.
- Q: ¿`online` condiciona poder invitar? → A: Sí. El gate combinado es
  `online === true` AND `availability === 'AVAILABLE'`. Si está offline se muestra
  "Desconectado" en lugar del botón de invitar; si está online pero `BUSY`, se muestra
  el motivo de ocupación.
- Q: ¿Spectate entra en esta feature? → A: No. `spectatableMatch` y
  `/user/queue/match-spectate` quedan fuera de alcance por ahora.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invitar a un amigo a mi partida desde la pantalla de espera (Priority: P1)

Como jugador registrado que armó una partida privada y está esperando rival, quiero
invitar a un amigo de mi lista para jugar contra él, en lugar de tener que pasarle el
código por fuera de la app.

**Why this priority**: Es el núcleo de la feature y la razón por la que se construyó el
sistema de amigos. Sin esta capacidad de enviar la invitación no hay valor alguno; todo lo
demás (recibir, listar, cancelar) depende de que exista al menos una invitación enviada.
Es la entrada más directa porque ahí el `targetId` de la partida ya está disponible.

**Independent Test**: Estando en la pantalla de espera de una partida privada propia, abrir
la lista de amigos disponibles, elegir uno y enviarle la invitación; verificar que el amigo
queda registrado como "invitación enviada/pendiente" y que el remitente ve confirmación.

**Acceptance Scenarios**:

1. **Given** soy un jugador registrado con al menos un amigo y tengo una partida privada en
   estado de espera, **When** abro la opción "Invitar amigo" y selecciono a un amigo
   disponible, **Then** se envía la invitación y veo que ese amigo pasa a estado
   "Invitación pendiente".
2. **Given** ya tengo una invitación pendiente para ese amigo a esta misma partida, **When**
   intento invitarlo de nuevo, **Then** la app no genera una segunda invitación y me indica
   que ya tiene una invitación pendiente.
3. **Given** un amigo está `BUSY` (en partida, liga, copa, revancha abierta, cola de quick
   match o con invitación/solicitud pendiente) o está offline, **When** veo la lista de
   amigos para invitar, **Then** ese amigo se muestra igual que los demás pero con la
   acción de invitar deshabilitada y una etiqueta del motivo ("Desconectado" si está
   offline; el copy del motivo si está `BUSY`), mientras que los `AVAILABLE` que además
   están `online` quedan invitables.
4. **Given** un amigo estaba invitable y se ocupa, se libera o cambia su presencia
   (`online` ↔ offline) mientras tengo la lista abierta, **When** llega el cambio en vivo,
   **Then** la acción de invitar de ese amigo se deshabilita (o habilita) sin que yo
   recargue.

---

### User Story 1b - Invitar a un amigo a partida desde la página de amigos (Priority: P1)

Como jugador registrado parado en la página de amigos, quiero poder elegir a un amigo e
"Invitar a partida" desde ahí, sin tener que pasar primero por armar la partida si no me
acuerdo, para que el flujo arranque desde donde estoy mirando a mis amigos.

**Why this priority**: Es la entrada que el usuario pidió explícitamente y comparte el mismo
acto final (enviar la invitación) con la US1; ambas son el corazón de la feature, por eso
también es P1. La diferencia es de dónde sale la partida objetivo.

**Independent Test**: Desde la página de amigos, elegir "Invitar a partida" para un amigo;
si no tengo partida esperando rival, comprobar que me lleva a crear una; con la partida ya
creada y esperando, comprobar que la invitación se envía a ese amigo.

**Acceptance Scenarios**:

1. **Given** estoy en la página de amigos y ya tengo una partida propia esperando rival,
   **When** elijo "Invitar a partida" para un amigo disponible, **Then** se envía la
   invitación a esa partida y veo confirmación.
2. **Given** estoy en la página de amigos y NO tengo una partida propia esperando rival,
   **When** elijo "Invitar a partida", **Then** se me lleva a crear una partida y la
   invitación recién se puede enviar una vez que la partida ya está creada y esperando.
3. **Given** ya tengo una invitación pendiente para ese amigo a mi partida, **When** intento
   invitarlo otra vez, **Then** la app no genera una segunda invitación y me lo indica.

---

### User Story 2 - Recibir y aceptar una invitación (Priority: P1)

Como jugador registrado, quiero enterarme en el momento de que un amigo me invitó a su
partida y poder aceptarla con un toque para entrar directo a jugar.

**Why this priority**: La invitación sólo entrega valor cuando el destinatario puede actuar
sobre ella. Recibir y aceptar cierra el flujo extremo a extremo y permite que dos amigos
terminen jugando juntos, que es el objetivo de la feature.

**Independent Test**: Con una invitación pendiente dirigida al usuario, comprobar que se le
notifica en vivo mediante un toast con acciones aceptar/rechazar, y que al aceptarla queda
unido a la partida del amigo.

**Acceptance Scenarios**:

1. **Given** un amigo me envió una invitación a su partida, **When** estoy en la app,
   **Then** recibo un toast/notificación en vivo con el nombre del amigo y las acciones
   aceptar/rechazar.
2. **Given** tengo un toast de invitación recibida, **When** la acepto, **Then** quedo
   unido a la partida del amigo y soy llevado a la pantalla de juego.
3. **Given** tengo un toast de invitación recibida, **When** la rechazo, **Then** el toast
   se descarta y el remitente se entera de que la rechacé.
4. **Given** tengo un toast de invitación recibida pero la partida ya no admite ingreso (se
   llenó, se canceló o expiró), **When** intento aceptarla, **Then** no me uno y veo un
   mensaje indicando que la invitación ya no es válida.

---

### User Story 3 - Gestionar mis invitaciones enviadas (Priority: P2)

Como jugador que invitó a uno o varios amigos, quiero ver el estado de mis invitaciones
enviadas y poder cancelar las que ya no quiero que sigan abiertas.

**Why this priority**: Mejora el control del remitente y evita confusión cuando el amigo no
responde, pero el flujo principal (invitar + aceptar) ya funciona sin esto, por eso es P2.

**Independent Test**: Con una invitación enviada pendiente, verificar que aparece listada y
que al cancelarla deja de figurar y el destinatario deja de poder aceptarla.

**Acceptance Scenarios**:

1. **Given** envié una invitación que sigue pendiente, **When** reviso mis invitaciones
   enviadas, **Then** veo al amigo invitado con estado pendiente.
2. **Given** tengo una invitación enviada pendiente, **When** la cancelo, **Then**
   desaparece de mi lista y el destinatario ya no puede aceptarla.
3. **Given** el destinatario aceptó o rechazó mi invitación, **When** reviso el estado,
   **Then** la invitación ya no figura como pendiente y se refleja el desenlace.

---

### Edge Cases

- **Sin amigos**: si el jugador no tiene amigos, la opción de invitar debe comunicar ese
  estado vacío con contexto en lugar de mostrar una lista vacía sin explicación. (Si tiene
  amigos pero todos están ocupados, se muestran igual con la acción de invitar deshabilitada
  y su motivo.)
- **Expiración por tiempo**: una invitación a partida pendiente expira automáticamente
  pasado el plazo definido (10 minutos por defecto). Al expirar debe dejar de figurar como
  pendiente en ambos lados.
- **Expiración por recurso**: si la partida deja de admitir ingreso (se llena, se cancela o
  termina) antes de que el amigo acepte, la invitación deja de ser válida aunque no haya
  vencido el plazo.
- **Sólo registrados**: los invitados (guests) no participan del sistema de amigos ni de
  invitaciones; la opción no aplica para ellos.
- **Sólo amistades aceptadas**: sólo se puede invitar a usuarios que son amigos confirmados,
  no a solicitudes de amistad pendientes.
- **Recuperación de invitaciones recibidas**: como no hay lista persistente, una invitación
  recibida que no se atendió se vuelve a presentar como toast al reconectar/recargar mientras
  siga pendiente; si ya expiró o dejó de ser válida, no se vuelve a mostrar.
- **Destinatario ocupado al momento de invitar**: si el amigo ya está en otra partida o
  torneo, no se le puede enviar la invitación.
- **Carrera entre aceptar y expirar/cancelar**: si el destinatario acepta justo cuando la
  invitación dejó de ser válida, debe recibir feedback de que ya no puede unirse en vez de
  quedar en un estado inconsistente.
- **Carrera entre disponibilidad y envío**: si un amigo aparece `AVAILABLE` pero se ocupa
  justo antes de que se envíe la invitación, el envío falla y se comunica el motivo; la lista
  refleja el nuevo estado al llegar el delta de disponibilidad.
- **`busyReason = UNKNOWN`**: cuando el motivo de ocupación no es uno de los conocidos, la
  acción de invitar igual se deshabilita y se muestra un copy genérico de "no disponible".
- **Amigo disponible pero offline**: se puede invitar igual; la invitación queda pendiente y
  el amigo la recibe (como toast) al reconectar mientras siga vigente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a un jugador registrado, dueño de una partida que
  todavía admite ingreso, enviar una invitación a esa partida a uno de sus amigos
  confirmados.
- **FR-002**: El sistema MUST ofrecer la acción de invitar a partida desde dos entradas: (a)
  la pantalla de espera de la partida propia y (b) la página de amigos, presentando en ambas
  los amigos a invitar.
- **FR-002a**: Desde la página de amigos, si el jugador no tiene una partida propia que
  todavía admita ingreso, el sistema MUST llevarlo a crear una partida; el envío de la
  invitación sólo MUST habilitarse una vez que la partida ya está creada y esperando rival.
- **FR-002b**: El sistema MUST determinar la partida objetivo del jugador (su partida propia
  no finalizada que aún admite ingreso) a partir de su presencia, sin pedirle que tipee el
  código de su propia partida.
- **FR-002c**: El sistema MUST mostrar, para cada amigo en la lista de invitar, su
  disponibilidad (`AVAILABLE` / `BUSY`) usando el dato provisto por el listado de amigos.
- **FR-002d**: El sistema MUST mostrar a TODOS los amigos en la lista de invitar, deshabilitando
  únicamente la acción de invitar de los que no son invitables (offline o `BUSY`), con una
  etiqueta del motivo ("Desconectado" si está offline; el copy del `busyReason` si está
  `BUSY`), sin atenuar ni deshabilitar la fila/contenedor del amigo.
- **FR-002e**: El sistema MUST traducir `busyReason` (`IN_MATCH`, `IN_LEAGUE`, `IN_CUP`,
  `OPEN_REMATCH`, `IN_QUICK_QUEUE`, `PENDING_INVITATION`, `PENDING_FRIEND_REQUEST`,
  `UNKNOWN`) a copy del catálogo del front; nunca mostrar el código crudo.
- **FR-002f**: El sistema MUST usar como condición para habilitar la invitación que el amigo
  sea `AVAILABLE` Y esté `online`. Un amigo offline NO MUST ser invitable, aunque su
  `availability` sea `AVAILABLE`; en ese caso se muestra "Desconectado" en lugar del botón.
- **FR-002g**: El sistema MUST reconciliar la disponibilidad de los amigos en vivo: aplicar el
  snapshot inicial y los deltas por amigo que llegan por el canal social, de forma
  idempotente y resistente al orden de llegada, actualizando la habilitación de invitar sin
  recarga manual.
- **FR-003**: El sistema MUST impedir invitar a usuarios que no sean amistades confirmadas.
- **FR-004**: El sistema MUST evitar generar más de una invitación pendiente para el mismo
  amigo a la misma partida.
- **FR-005**: El sistema MUST comunicar al remitente, con copy del catálogo del front, cuando
  no se puede enviar la invitación (amigo no disponible, partida ya no admite ingreso,
  invitación duplicada u otro error).
- **FR-006**: El sistema MUST notificar al destinatario en vivo, mediante un toast/
  notificación con acciones aceptar/rechazar, cuando recibe una nueva invitación a partida,
  identificando al amigo remitente.
- **FR-007**: El sistema MUST presentar las invitaciones a partida recibidas únicamente como
  toast/notificación en vivo; NO se requiere una lista persistente de invitaciones recibidas
  en la UI.
- **FR-008**: Los usuarios MUST poder aceptar una invitación recibida desde el toast y, al
  hacerlo, quedar unidos a la partida del remitente y ser llevados a la pantalla de juego.
- **FR-009**: Los usuarios MUST poder rechazar una invitación recibida desde el toast,
  descartándolo; el remitente MUST enterarse del rechazo.
- **FR-010**: El sistema MUST mantener para el remitente una lista de invitaciones a partida
  enviadas y pendientes.
- **FR-011**: Los usuarios MUST poder cancelar una invitación enviada que siga pendiente;
  tras la cancelación el destinatario ya no MUST poder aceptarla.
- **FR-012**: El sistema MUST reflejar en vivo, en ambos lados, los cambios de estado de una
  invitación (aceptada, rechazada, cancelada, expirada) sin requerir recarga manual.
- **FR-013**: El sistema MUST tratar una invitación como ya no válida cuando expira por
  tiempo o cuando la partida deja de admitir ingreso, y MUST dar feedback claro si alguien
  intenta aceptarla en ese estado.
- **FR-014**: El sistema MUST reconciliar el estado de las invitaciones de forma idempotente
  y resistente al orden de llegada, de modo que la carga inicial y los eventos en vivo
  converjan al mismo resultado (consistente con las garantías del sistema de amigos
  existente).
- **FR-015**: El sistema MUST restringir todo el flujo de invitaciones a jugadores
  registrados, excluyendo a los invitados (guests).
- **FR-016**: El sistema MUST mostrar un estado vacío con contexto cuando el jugador no tenga
  amigos (la lista de invitar se construye sobre todos los amigos, disponibles u ocupados).
- **FR-017**: El sistema MUST nunca exponer mensajes crudos de error del backend en la UI,
  usando siempre el catálogo de copy del front mapeado por código.
- **FR-018**: El sistema MUST dejar fuera de alcance, por ahora, la funcionalidad de
  espectar partidas de amigos (`spectatableMatch`, suscripción a `/user/queue/match-spectate`
  y la elegibilidad de espectador por amistad); esos campos del contrato se ignoran en esta
  feature.

### Key Entities *(include if feature involves data)*

- **Invitación a partida (enviada)**: representa una invitación que el jugador envió a un
  amigo para unirse a su partida. Atributos relevantes: amigo destinatario, partida objetivo,
  estado (pendiente / aceptada / rechazada / cancelada / expirada) y momento de expiración.
- **Invitación a partida (recibida)**: representa una invitación que el jugador recibió de un
  amigo. Atributos relevantes: amigo remitente, partida objetivo, estado y momento de
  expiración.
- **Amigo invitable**: un amigo confirmado del jugador que puede ser destinatario de una
  invitación; su elegibilidad depende de estar disponible (no ocupado en otra partida o
  torneo).
- **Disponibilidad de amigo**: estado del amigo a efectos de invitación, con
  `availability` (`AVAILABLE` / `BUSY`), `busyReason` (motivo cuando está ocupado) y `online`
  (presencia aproximada). Tanto `online` como `availability === 'AVAILABLE'` deben cumplirse
  para que el amigo sea invitable. Se obtiene en la carga inicial y se actualiza en vivo por
  el canal social (snapshot + deltas por amigo).
- **Partida objetivo**: la partida propia del remitente a la que se invita; debe seguir
  admitiendo ingreso para que la invitación sea válida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un jugador con una partida en espera puede enviar una invitación a un amigo en
  3 toques o menos desde la pantalla de espera.
- **SC-002**: El destinatario ve la invitación recibida (toast/notificación) dentro de los
  2 segundos posteriores al envío, sin recargar la app.
- **SC-003**: Al aceptar una invitación válida, el destinatario llega a la pantalla de juego
  de la partida del amigo sin pasos manuales adicionales (no necesita pedir ni tipear el
  código de la partida).
- **SC-004**: El 100% de los intentos de invitar a un amigo no disponible, de duplicar una
  invitación o de aceptar una invitación ya inválida resultan en un mensaje de feedback
  claro y ninguna acción inconsistente.
- **SC-005**: Los cambios de estado de invitación (aceptada / rechazada / cancelada /
  expirada) se reflejan en ambos lados sin recarga manual.
- **SC-006**: Cuando un amigo cambia de disponibilidad mientras el usuario tiene abierta la
  lista de invitar, la acción de invitar de ese amigo se habilita/deshabilita dentro de los
  2 segundos sin recarga manual.

## Assumptions

- Se reutiliza el sistema de amigos existente (feature 024): listas de amigos y canal de
  eventos sociales en tiempo real ya disponibles para usuarios registrados.
- El alcance se limita a invitaciones a **partida**; invitaciones a liga o copa quedan fuera
  de esta feature aunque el contrato las contemple.
- Sólo el dueño de una partida que todavía admite ingreso puede invitar; el invitado se une
  directamente al aceptar (no se requiere que el destinatario tipee el código).
- La partida es 1v1, por lo que sólo admite invitar mientras está esperando rival
  (`WAITING_FOR_PLAYERS`); una vez que entró el rival deja de ser invitable.
- La partida objetivo del remitente se identifica vía presencia del propio usuario
  (`GET /api/me/presence` y empuje por WS).
- La disponibilidad de los amigos SÍ es conocida por el front: el listado de amigos expone
  `availability` / `busyReason` / `online`, y se reconcilia en vivo con el snapshot
  `FRIEND_AVAILABILITY_STATE` y los deltas `FRIEND_AVAILABILITY_CHANGED` del canal social. La
  habilitación de invitar es optimista según ese dato, pero el backend sigue siendo la
  autoridad final (si cambió justo antes del envío, se comunica el error).
- Espectar partidas de amigos queda fuera de alcance en esta feature; los campos
  `spectatableMatch` y el canal `/user/queue/match-spectate` se ignoran por ahora.
- La página de amigos ya existe (feature 024) y es donde se agrega la entrada "Invitar a
  partida"; el flujo de crear partida privada también ya existe (feature 015) y se reutiliza
  para la redirección.
- El plazo de expiración de una invitación a partida lo define el backend (10 minutos por
  defecto); el front lo refleja pero no lo configura.
- Mobile portrait (360–599px) y desktop (1024px+) son los únicos rangos soportados, en línea
  con el alcance responsive del proyecto.
- Se respetan los estándares de copy de error del proyecto: nunca se muestra el mensaje crudo
  del backend, siempre el catálogo del front mapeado por código.
