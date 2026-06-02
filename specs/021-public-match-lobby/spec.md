# Feature Specification: Lobby público de matches

**Feature Branch**: `021-public-match-lobby`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "Lobby público de matches: listar partidas públicas abiertas, unirse, crear partida pública; motor de reconcile reutilizable para copas y ligas a futuro"

## Clarifications

### Session 2026-06-02

- Q: Cuando falla la unión por race condition (la partida se llenó/cerró justo), ¿qué pasa además del aviso? → A: Toast/snackbar breve y no bloqueante; el jugador permanece en el lobby; NO se fuerza refresco ni se quita la partida en el momento del error — esa remoción ocurre sola cuando llega el evento de actualización en tiempo real.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver y unirse a una partida pública abierta (Priority: P1)

Como jugador autenticado quiero ver un listado de las partidas públicas que otros jugadores
dejaron abiertas esperando rival, para poder elegir una y entrar a jugar de inmediato sin
depender de un código de invitación ni del matchmaking automático.

**Why this priority**: Es el corazón de la feature y el MVP por sí solo. Sin listar y unirse no
hay "lobby público". Entrega valor completo aunque no exista todavía la creación de partidas
públicas desde el front: un jugador puede sumarse a cualquier partida abierta y empezar a jugar.

**Independent Test**: Con al menos una partida pública abierta en el sistema, abrir la pantalla del
lobby público, ver la partida listada con su información (anfitrión, formato de serie, lugares
ocupados) y tocar "Unirse" lleva a la pantalla de partida en curso.

**Acceptance Scenarios**:

1. **Given** existen partidas públicas abiertas, **When** el jugador abre el lobby público,
   **Then** ve la lista de partidas con anfitrión, formato de serie (1/3/5) y lugares ocupados
   sobre totales (p. ej. 1/2).
2. **Given** una partida pública con un lugar libre, **When** el jugador toca "Unirse",
   **Then** entra a la partida y, al completarse el cupo, la partida arranca automáticamente
   sin pasos adicionales.
3. **Given** el lobby público no tiene partidas abiertas, **When** el jugador abre la pantalla,
   **Then** ve un estado vacío claro que lo invita a crear una partida o volver.
4. **Given** ocurre un error al cargar la lista, **When** el jugador abre la pantalla,
   **Then** ve un mensaje de error controlado del front (no el mensaje crudo del backend) y una
   opción para reintentar.
5. **Given** una partida que se llenó justo antes de que el jugador la tocara, **When** el jugador
   toca "Unirse", **Then** ve un toast/snackbar breve y no bloqueante indicando que ya no está
   disponible, permanece en el lobby, y la partida desaparece de la lista recién cuando llega la
   actualización en tiempo real (no por un refresco forzado del error).

---

### User Story 2 - Crear una partida pública y esperar rival (Priority: P2)

Como jugador quiero crear una partida marcándola como pública, eligiendo el formato de serie,
para que aparezca en el lobby y cualquier otro jugador pueda sumarse.

**Why this priority**: Alimenta el lobby con contenido propio y cierra el ciclo (crear ↔ unirse).
Es valioso pero depende de que P1 exista para tener sentido; sin listado, una partida pública no
sería descubierta.

**Independent Test**: Elegir "crear pública", seleccionar formato, confirmar; el jugador queda en
la sala de espera de su partida y esa partida aparece en el lobby público de otro jugador.

**Acceptance Scenarios**:

1. **Given** el jugador está creando una partida, **When** elige visibilidad "Pública" y un
   formato de serie y confirma, **Then** la partida se crea como pública y el jugador queda
   esperando rival.
2. **Given** un jugador creó una partida pública, **When** otro jugador abre el lobby,
   **Then** esa partida aparece en su listado disponible para unirse.
3. **Given** el jugador está creando una partida, **When** elige visibilidad "Privada",
   **Then** el comportamiento actual se preserva (se genera un código de invitación y no aparece
   en el lobby público).

---

### User Story 3 - Listado en tiempo real (Priority: P3)

Como jugador quiero que la lista del lobby se mantenga actualizada sola mientras la miro, para no
intentar unirme a partidas que ya se llenaron ni perderme partidas recién abiertas.

**Why this priority**: Mejora notablemente la experiencia y reduce errores de carrera al unirse,
pero el lobby es usable sin ella (con carga inicial y reintento/refresco manual). Es la capa con
mayor complejidad técnica, por eso se aísla como slice independiente.

**Independent Test**: Con la pantalla del lobby abierta, cuando otro jugador crea una partida
pública aparece en la lista sin recargar; cuando una partida se llena o se cancela, desaparece de
la lista sin recargar.

**Acceptance Scenarios**:

1. **Given** el lobby está abierto, **When** se abre una nueva partida pública en el sistema,
   **Then** aparece en la lista sin que el jugador recargue.
2. **Given** el lobby está abierto mostrando una partida, **When** esa partida se llena o deja de
   estar disponible, **Then** se quita de la lista sin que el jugador recargue.
3. **Given** llega una actualización de una partida ya visible (p. ej. cambió la cantidad de
   lugares ocupados), **When** se reconcilia, **Then** la tarjeta refleja el nuevo estado sin
   duplicarse en la lista.

---

### Edge Cases

- **Unirse a una partida que se llenó justo antes (race condition)**: el intento falla; se muestra
  un toast/snackbar breve y no bloqueante con copy controlado del front. El jugador permanece en el
  lobby. No se fuerza un refresco ni se quita la partida de la lista en ese momento: esa remoción se
  produce sola cuando llega el evento de actualización en tiempo real.
- **La propia partida del jugador en la lista**: si el jugador creó una partida pública, su propia
  partida aparece marcada como "tuya" y la acción lo lleva de vuelta a su sala de espera en lugar
  de intentar un segundo ingreso.
- **Lista larga**: cuando hay muchas partidas abiertas, la lista se carga por páginas (cargar más),
  no todas de golpe.
- **Actualización en tiempo real que llega antes de la carga inicial**: el sistema no debe duplicar
  ni perder partidas al combinar la carga inicial con las actualizaciones.
- **Conexión en tiempo real no disponible**: el lobby sigue siendo usable con la carga inicial y un
  refresco manual; la ausencia de actualizaciones en vivo no rompe la pantalla.
- **Pérdida y recuperación de la conexión en tiempo real**: al reconectar, la lista se reconcilia
  para volver a un estado consistente sin requerir recarga manual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar a un jugador autenticado un listado de las partidas públicas
  que están abiertas esperando jugadores.
- **FR-002**: Cada partida del listado MUST mostrar, como mínimo, el anfitrión, el formato de serie
  (mejor de 1/3/5) y los lugares ocupados sobre los totales.
- **FR-003**: El jugador MUST poder unirse a una partida pública abierta desde el listado con una
  sola acción.
- **FR-004**: Al completarse el cupo de una partida pública, esta MUST iniciar automáticamente sin
  que los jugadores tengan que ejecutar un paso de "iniciar" adicional.
- **FR-005**: El sistema MUST mostrar un estado vacío claro cuando no hay partidas públicas abiertas.
- **FR-006**: El sistema MUST mostrar un estado de carga mientras obtiene la lista inicial.
- **FR-007**: El sistema MUST manejar errores de carga y de unión mostrando copy controlado del
  front (nunca el mensaje crudo del backend) y ofreciendo reintentar.
- **FR-008**: El jugador MUST poder crear una partida eligiendo visibilidad "Pública" o "Privada"
  y un formato de serie.
- **FR-009**: Una partida creada como pública MUST aparecer en el lobby público de los demás
  jugadores mientras siga abierta.
- **FR-010**: El sistema MUST preservar el comportamiento existente de creación privada (código de
  invitación, no aparece en el lobby) y de unión por código.
- **FR-011**: El sistema MUST actualizar el listado en tiempo real: agregar partidas recién
  abiertas, quitar las que dejan de estar disponibles y reflejar cambios de partidas ya visibles,
  todo sin que el jugador recargue (User Story 3).
- **FR-012**: El sistema MUST combinar la carga inicial con las actualizaciones en tiempo real sin
  duplicar ni perder partidas, identificando cada partida de forma unívoca.
- **FR-013**: El sistema MUST cargar el listado por páginas cuando hay muchas partidas, permitiendo
  pedir más resultados.
- **FR-014**: Cuando un intento de unión falla porque la partida ya no está disponible (race
  condition), el sistema MUST informarlo mediante un toast/snackbar breve y no bloqueante con copy
  controlado del front, manteniendo al jugador en el lobby. El sistema MUST NOT forzar un refresco
  ni quitar manualmente esa partida en el momento del error; su remoción de la lista ocurre cuando
  llega el evento de actualización en tiempo real (FR-011).
- **FR-015**: La mecánica de actualización en tiempo real del listado (carga inicial reconciliada
  con actualizaciones incrementales) MUST diseñarse de forma reutilizable, de modo que el mismo
  mecanismo pueda aplicarse a los lobbies públicos de copas y ligas en el futuro sin reescribir la
  lógica de reconciliación.
- **FR-016**: El lobby público MUST respetar el diseño responsivo del proyecto (mobile 360 px+ y
  desktop 1024 px+) y los lineamientos de CTAs tematizados del producto.

### Key Entities *(include if feature involves data)*

- **Partida pública en lobby**: representa una partida abierta visible para todos. Atributos
  relevantes: identificador único, anfitrión, formato de serie (1/3/5), lugares ocupados, lugares
  totales y estado (esperando jugadores). Es la unidad que se lista, se actualiza y desde la cual se
  ejecuta la acción de unirse.
- **Actualización de lobby**: un cambio incremental sobre el listado — alta/actualización de una
  partida, o baja de una partida que salió del lobby. Se reconcilia contra el listado cargado.
- **Configuración de creación de partida**: visibilidad (pública/privada) y formato de serie
  elegidos por el anfitrión al crear.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un jugador puede pasar de abrir el lobby público a estar dentro de una partida en
  curso en 3 acciones o menos (abrir lobby → elegir partida → unirse).
- **SC-002**: El listado inicial de partidas públicas se muestra (o muestra el estado vacío) en
  menos de 2 segundos en condiciones normales de red.
- **SC-003**: Cuando otra persona abre o cierra una partida pública, el cambio se refleja en el
  listado de un jugador que lo está mirando en menos de 3 segundos, sin recarga manual.
- **SC-004**: El 100% de los errores visibles (carga, unión, partida llena) muestran copy del
  catálogo del front; en ninguna situación se muestra el mensaje crudo del backend.
- **SC-005**: Una partida creada como pública aparece en el lobby de otro jugador, y una creada
  como privada nunca aparece allí (verificable en pruebas).
- **SC-006**: La pantalla es plenamente usable y legible tanto a 360 px de ancho como en desktop.

## Assumptions

- El backend ya expone el listado de partidas públicas, el canal de actualizaciones en tiempo real
  y la creación de partidas con visibilidad pública/privada; esta feature consume esas capacidades,
  no las crea.
- "Unirse" reutiliza el mismo mecanismo de ingreso ya existente en el front para partidas (el mismo
  que hoy usa la unión por código).
- El inicio automático de la partida pública al completarse el cupo es responsabilidad del backend;
  el front solo navega a la partida.
- La feature vive dentro del flujo "Jugar online" existente, sumándose a la creación privada y la
  unión por código actuales, sin agregar un modo de juego nuevo en la pantalla de modos.
- El alcance de esta feature es solo matches. Copas y ligas públicas quedan fuera; la única
  exigencia hacia ellas es que el mecanismo de reconciliación se diseñe reutilizable (FR-015).
- El formato de serie por defecto al crear es "mejor de 3", según la convención del producto.
- Solo se contemplan los tamaños mobile portrait y desktop definidos por el proyecto; landscape
  mobile no aplica.
