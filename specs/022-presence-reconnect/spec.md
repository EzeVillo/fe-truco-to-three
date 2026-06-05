# Feature Specification: Presencia y reconexion de usuario

**Feature Branch**: `023-presence-reconnect`

**Created**: 2026-06-05

**Status**: Draft

**Input**: User description: "Cuando un usuario se reconecte, refresque la pagina o tenga la sesion abierta en mas de un lugar, debe terminar en el lugar donde esta ocupado: partida, torneo o revancha."

## Clarifications

### Session 2026-06-05

- Q: ¿Deben incluirse ligas/copas en esta feature inicial? -> A: No; hoy no hay torneos implementados, por lo que se desestiman por el momento.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Volver a la partida ocupada al abrir la app (Priority: P1)

Como jugador autenticado que ya esta ocupado en una partida no finalizada, quiero que la aplicacion me lleve automaticamente a esa partida al abrir, refrescar o reconectar la sesion, para no quedar perdido en el lobby ni intentar crear o unirme a otra partida por error.

**Why this priority**: Es el flujo principal de recuperacion. Sin esto, una recarga o una segunda pestana puede dejar al usuario fuera del contexto activo y generar errores de "usuario ocupado" sin una salida clara.

**Independent Test**: Se puede probar con un usuario autenticado que tiene una partida activa, abriendo la aplicacion desde una ruta neutral y verificando que termina en la pantalla de esa partida sin intervencion manual.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con una partida en espera, lista o en progreso, **When** abre la aplicacion desde el lobby, perfil o reglas, **Then** la aplicacion lo lleva a la pantalla de esa partida.
2. **Given** un usuario autenticado que ya esta viendo la partida correcta, **When** la aplicacion verifica su ocupacion, **Then** permanece en la misma pantalla sin reiniciar la navegacion ni mostrar mensajes redundantes.
3. **Given** un usuario autenticado sin ninguna ocupacion activa, **When** abre la aplicacion, **Then** permanece en el flujo que habia elegido y no se lo redirige.

---

### User Story 2 - Sincronizar sesiones abiertas en varios lugares (Priority: P2)

Como jugador con la sesion abierta en mas de una pestana o dispositivo, quiero que todas mis sesiones se enteren cuando entro a una partida o se libera mi ocupacion, para que ninguna sesion quede mostrando acciones incompatibles con mi estado real.

**Why this priority**: Evita que una sesion ociosa permita iniciar acciones que el servidor rechazaria por ocupacion, y hace que la experiencia multi-pestana sea coherente.

**Independent Test**: Se puede probar abriendo dos sesiones del mismo usuario, ocupandolo desde una de ellas y verificando que la otra navega al recurso activo sin recargar manualmente.

**Acceptance Scenarios**:

1. **Given** el mismo usuario autenticado en dos sesiones y una de ellas entra a una partida reconectable, **When** cambia su ocupacion, **Then** ambas sesiones terminan en la pantalla de la partida activa.
2. **Given** el mismo usuario autenticado en dos sesiones y una partida finaliza, **When** la ocupacion deja de existir, **Then** las sesiones dejan de forzar la navegacion hacia esa partida por presencia.
3. **Given** una sesion recibe una actualizacion de ocupacion hacia el mismo destino donde ya esta, **When** procesa la actualizacion, **Then** no duplica navegaciones ni interrumpe la interaccion actual.

---

### User Story 3 - Recuperar revancha abierta (Priority: P3)

Como jugador con una revancha abierta, quiero volver al contexto donde puedo resolverla al reconectar, para aceptar, esperar o abandonar sin quedar bloqueado en el lobby.

**Why this priority**: La revancha abierta bloquea nuevas partidas. La recuperacion debe evitar que el usuario quede en un estado ocupado sin camino visible para continuar.

**Independent Test**: Se puede probar con un usuario que tiene una revancha abierta y verificando que la aplicacion lo deriva al lugar accionable disponible para resolverla.

**Acceptance Scenarios**:

1. **Given** un usuario con una revancha abierta, **When** abre o reconecta la aplicacion, **Then** termina en el contexto donde puede aceptar, esperar o abandonar la revancha.
2. **Given** un usuario con una revancha abierta cuyo origen ya no permite continuar, **When** la aplicacion intenta recuperar el contexto, **Then** no queda atrapado en una pantalla invalida y conserva un retorno claro al lobby.

---

### Edge Cases

- Si llega una ocupacion nueva mientras el usuario intenta crear o unirse a una partida, la ocupacion confirmada tiene prioridad y el usuario debe terminar en el recurso activo.
- Si la informacion de ocupacion indica un recurso ya finalizado o inaccesible al cargar su pantalla, la aplicacion debe dejar de forzar esa navegacion y ofrecer un retorno claro al lobby.
- Si el usuario cierra sesion, ninguna verificacion o actualizacion pendiente debe volver a navegarlo a un recurso autenticado.
- Si hay mas de un dominio ocupado al mismo tiempo dentro del alcance actual, la aplicacion debe elegir el destino accionable mas especifico: partida actual primero, luego revancha.
- Si la informacion de presencia incluye dominios de torneo, la aplicacion debe ignorarlos por ahora y no navegar a pantallas de torneo inexistentes.
- Si una actualizacion de ocupacion se pierde, la siguiente apertura, refresco o reconexion debe recuperar el estado correcto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La aplicacion DEBE verificar la ocupacion del usuario autenticado al iniciar, refrescar o recuperar una sesion.
- **FR-002**: La aplicacion DEBE mantener sincronizadas las sesiones abiertas del mismo usuario ante cambios posteriores de ocupacion.
- **FR-003**: Si el usuario esta ocupado en una partida no finalizada, la aplicacion DEBE llevarlo a la pantalla de esa partida.
- **FR-004**: Si el usuario tiene una revancha abierta y no hay una partida no finalizada con mayor prioridad, la aplicacion DEBE llevarlo al contexto desde donde puede resolver esa revancha.
- **FR-005**: La aplicacion NO DEBE navegar a ligas, copas ni pantallas de torneo como parte de esta feature inicial.
- **FR-006**: Si el usuario no esta ocupado, la aplicacion NO DEBE cambiar la ruta elegida por el usuario por motivos de presencia.
- **FR-007**: La aplicacion NO DEBE forzar navegacion si el usuario ya se encuentra en el destino correcto.
- **FR-008**: La aplicacion DEBE evitar bucles de navegacion cuando recibe la misma ocupacion mas de una vez.
- **FR-009**: La aplicacion DEBE detener la coordinacion de presencia cuando el usuario cierra sesion o pierde autenticacion.
- **FR-010**: La aplicacion DEBE ignorar mensajes de error crudos de sistemas externos y mostrar solo copias controladas por el producto cuando necesite informar un problema.
- **FR-011**: La aplicacion DEBE tratar partidas rapidas en busqueda y partidas contra bots sin partida creada como fuera del alcance de reconexion por presencia.
- **FR-012**: La aplicacion DEBE preservar las reglas del dominio: una ocupacion activa impide iniciar o unirse a otro recurso reconectable hasta que se libere.

### Key Entities

- **Presencia de usuario**: Foto actual de si el usuario esta ocupado o libre. Incluye el indicador de ocupacion y, cuando corresponde, el recurso que bloquea nuevas acciones.
- **Ocupacion de partida**: Partida no finalizada del usuario, en espera, lista o en progreso.
- **Ocupacion de revancha**: Sesion de revancha abierta asociada a una partida de origen.
- **Destino de recuperacion**: Pantalla concreta a la que la aplicacion lleva al usuario para continuar el recurso activo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En al menos 95% de las aperturas o refrescos con usuario ocupado, el usuario termina en el destino correcto en menos de 2 segundos desde que la aplicacion queda autenticada.
- **SC-002**: En pruebas con dos sesiones simultaneas del mismo usuario, 100% de los cambios de ocupacion confirmados llevan ambas sesiones al mismo recurso accionable.
- **SC-003**: Las verificaciones repetidas de la misma ocupacion no producen mas de una navegacion observable hacia el mismo destino.
- **SC-004**: Usuarios libres permanecen en su ruta actual en 100% de los casos de verificacion de presencia.
- **SC-005**: Los intentos fallidos causados por "usuario ocupado" en flujos de lobby disminuyen al menos 80% durante pruebas manuales comparadas con el comportamiento previo.

## Assumptions

- El usuario ya esta autenticado cuando esta feature evalua presencia; usuarios anonimos o con sesion expirada quedan fuera del alcance.
- La fuente de presencia distingue entre usuario libre y ocupado, y expone identificadores suficientes para volver al recurso correcto.
- La aplicacion ya cuenta con una pantalla de partida que puede recuperar partidas no finalizadas y el flujo de revancha asociado.
- Ligas y copas quedan fuera de alcance en esta feature porque hoy no hay torneos implementados en el frontend.
- La modalidad de partida rapida en busqueda no sobrevive a una desconexion y no debe recuperarse como ocupacion.
