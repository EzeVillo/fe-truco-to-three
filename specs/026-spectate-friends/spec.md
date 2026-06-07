# Feature Specification: Espectar partidas de amigos

**Feature Branch**: `026-spectate-friends`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "quiero hacer que se pueda espectear amigos" + "entiendo que ya viene en contratos api el match id"

## Clarifications

### Session 2026-06-06

- Q: ¿La vista pública de spectate expone el roster (asiento→nombre) y el formato de serie para que
  el tablero etiquete ambos lados? → A: Sí — el contrato (`docs/CONTRATOS_API.md` §4.15) ya incluye
  `playerOneUsername`, `playerTwoUsername` (`null` si todavía no hay rival sentado) y `gamesToPlay`
  (best-of, igual que la vista de jugador). Se resuelve el riesgo D1 del plan sin fallback de
  "Jugador 1/2".
- Q: ¿Cómo se presentan al espectador los hitos (fin de partida, fin de game, resolución de envido)?
  → A: De forma **neutra e inline**, en la misma pantalla, sin reusar los modales de jugador
  (`GameWonDialog`, `EnvidoResultDialog`). El fin de partida muestra "Ganó X" + CTA volver; el fin de
  game y la resolución de envido se reflejan inline sin marco "ganaste/perdiste".
- Q: ¿Espectar es un contexto único y persistente (incluido cross-device), y deja al usuario en
  estado "ocupado"? → A: Sí. El contrato ya lo soporta sin cambios de backend: (1) espectar deja
  `busy = true` (no puede crear/unirse/buscar Quick Match/aceptar invitaciones mientras espectа);
  (2) `GET /api/me/presence` y el push `PRESENCE_UPDATED` exponen `spectating.matchId`, que el front
  usa para devolver al usuario a la partida espectada al cargar/reconectar desde cualquier
  dispositivo; (3) la suscripción multi-dispositivo es idempotente y la sesión se cierra solo cuando
  cae la última. Para mirar otra partida hay que **salir** de la actual primero. Los amigos ven a
  quien especta con `busyReason = SPECTATING` (ya existe en el contrato; falta agregarlo en el front).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar a mirar la partida de un amigo (Priority: P1)

Como usuario con amigos confirmados, quiero ver cuáles de ellos están jugando una partida en
curso y entrar a mirarla en un toque, para acompañarlos y seguir el juego en vivo.

**Why this priority**: Es el corazón de la feature y el MVP. Sin el punto de entrada desde la
lista de amigos y el alta como espectador, no hay nada que mirar. La pieza de descubrimiento
(qué partida está jugando el amigo) ya viene resuelta por el backend, así que esta historia
entrega valor por sí sola.

**Independent Test**: Con un amigo confirmado jugando una partida en curso, el usuario ve un
indicador "Mirar" junto a ese amigo, lo toca, y queda viendo el estado de la partida en vivo.

**Acceptance Scenarios**:

1. **Given** un amigo confirmado con una partida espectable en curso, **When** el usuario abre la
   lista de amigos, **Then** ve una acción "Mirar" disponible para ese amigo.
2. **Given** un amigo cuya partida no es espectable (no está en curso), **When** el usuario abre la
   lista de amigos, **Then** no ve la acción "Mirar" para ese amigo.
3. **Given** un amigo con partida espectable, **When** el usuario toca "Mirar", **Then** se lo
   registra como espectador y pasa a una pantalla que muestra el estado actual de la partida.
4. **Given** el usuario ya está mirando una partida, **When** intenta mirar otra distinta, **Then**
   el sistema impide ser espectador de dos partidas a la vez y lo informa con un mensaje claro.

---

### User Story 2 - Seguir el desarrollo de la partida en tiempo real (Priority: P1)

Como espectador, quiero ver cómo avanza la partida en vivo —puntaje, cartas jugadas sobre la mesa,
cantos (truco/envido), de quién es el turno y el reloj de turno— sin ver las cartas ocultas de
ninguno de los dos jugadores, para disfrutar la partida sin alterar su justicia competitiva.

**Why this priority**: Mirar sin ver la evolución en vivo no tiene valor. Junto con la US1 forman
el MVP indivisible: entrar y ver el juego desarrollarse. La restricción de no ver manos ocultas la
impone el backend y es condición de la feature.

**Independent Test**: Estando como espectador de una partida en curso, cada jugada o canto de los
jugadores se refleja en la pantalla del espectador en segundos, y en ningún momento se ven las
cartas en mano de los jugadores ni acciones jugables.

**Acceptance Scenarios**:

1. **Given** el usuario es espectador de una partida en curso, **When** un jugador juega una carta,
   **Then** esa carta aparece en la mesa del espectador en tiempo real.
2. **Given** el usuario es espectador, **When** un jugador canta truco o envido, **Then** el canto
   se muestra en la vista del espectador.
3. **Given** el usuario es espectador, **When** observa la pantalla, **Then** ve el puntaje del
   game actual, los games ganados por cada lado, de quién es el turno y la cuenta regresiva del
   turno sobre el asiento que debe actuar.
4. **Given** el usuario es espectador, **When** observa la pantalla, **Then** nunca ve las cartas en
   mano de los jugadores ni botones de acción de juego (no puede jugar ni cantar).
5. **Given** el usuario es espectador, **When** observa la pantalla, **Then** ve una indicación
   clara de que está en modo espectador y cuántos espectadores hay.
6. **Given** la partida termina mientras el usuario la mira, **When** se resuelve el ganador,
   **Then** la vista refleja el fin de la partida y el resultado.

---

### User Story 3 - Robustez de la sesión de espectador (Priority: P2)

Como espectador, quiero que mi sesión se recupere si se corta la conexión y poder dejar de mirar
cuando quiera, para que la experiencia sea confiable y no me deje "colgado".

**Why this priority**: Mejora la calidad y confiabilidad de la experiencia, pero la feature ya
entrega valor sin esto. Es la capa de robustez sobre el MVP.

**Independent Test**: Mientras se mira una partida, simular una caída de conexión; al reconectar, la
vista de espectador se restablece sola con el estado actual. Además, una acción explícita de
"Dejar de mirar" devuelve al usuario a la lista de amigos y lo libera para mirar otra partida.

**Acceptance Scenarios**:

1. **Given** el usuario está mirando una partida, **When** la conexión se cae y vuelve, **Then** la
   sesión de espectador se restablece automáticamente y la vista vuelve a mostrar el estado actual
   sin intervención manual.
2. **Given** el usuario está mirando una partida, **When** elige "Dejar de mirar", **Then** deja de
   recibir actualizaciones, vuelve a la lista de amigos y queda libre para mirar otra partida.
3. **Given** el usuario intenta mirar una partida para la que no está habilitado o que ya no es
   espectable, **When** se rechaza el alta, **Then** se le muestra un mensaje claro del catálogo de
   copy del front y permanece en la lista de amigos.
4. **Given** el usuario está espectando una partida, **When** abre la app en otro dispositivo o en
   una sesión nueva, **Then** se lo devuelve automáticamente a la pantalla de espectador de esa
   partida (detectado desde la presencia).
5. **Given** el usuario está espectando, **When** intenta crear/unirse a una partida, buscar Quick
   Match o aceptar una invitación, **Then** esas acciones no están disponibles porque está ocupado.

---

### Edge Cases

- **El amigo abandona / la partida termina justo al entrar**: el alta puede ser rechazada porque la
  partida ya no está en curso; mostrar mensaje y volver a la lista.
- **La amistad se elimina mientras se mira**: el backend desregistra al espectador; la vista debe
  reaccionar al corte de la sesión sin quedar en estado roto.
- **El usuario es uno de los jugadores de esa partida**: nunca debe ofrecerse "Mirar" su propia
  partida; si igual se intentara, el alta se rechaza.
- **Reconexión repetida / inestable**: las reintentos de re-alta no deben duplicar suscripciones ni
  contar al usuario como múltiples espectadores.
- **El amigo deja de estar espectable mientras el usuario mira la lista**: la acción "Mirar"
  desaparece o se deshabilita al actualizarse la disponibilidad.
- **Guests**: un guest sin amigos confirmados no tiene amigos espectables; la feature simplemente no
  ofrece nada que mirar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST indicar, en la lista de amigos, cuáles amigos confirmados tienen una
  partida en curso espectable.
- **FR-002**: El sistema MUST ofrecer una acción "Mirar" únicamente para amigos con una partida
  espectable en curso, y ocultarla/deshabilitarla en caso contrario.
- **FR-003**: El sistema MUST registrar al usuario como espectador de la partida del amigo elegido y
  mostrarle el estado actual de la partida.
- **FR-004**: El sistema MUST actualizar la vista del espectador en tiempo real ante cada cambio de
  la partida (cartas jugadas, cantos, cambios de turno, puntaje, fin de game y de partida).
- **FR-005**: El sistema MUST mostrar al espectador la información pública de la partida: puntaje del
  game actual, games ganados por cada lado, cartas ya jugadas en la mesa, canto de truco/envido
  vigente, de quién es el turno, el reloj del turno sobre el asiento que debe actuar y el ganador
  cuando corresponda.
- **FR-006**: El sistema MUST NOT mostrar al espectador las cartas en mano de los jugadores ni
  ninguna acción jugable; la vista es de solo lectura.
- **FR-007**: El sistema MUST indicar visualmente que el usuario está en modo espectador y mostrar
  la cantidad de espectadores de la partida.
- **FR-008**: El sistema MUST impedir que el usuario sea espectador de más de una partida a la vez e
  informarlo con un mensaje claro si lo intenta.
- **FR-009**: El sistema MUST NOT ofrecer espectar la propia partida del usuario.
- **FR-010**: El sistema MUST restablecer automáticamente la sesión de espectador tras una
  reconexión, recuperando el estado actual de la partida sin acción manual del usuario.
- **FR-011**: El sistema MUST ofrecer una acción explícita para dejar de mirar, que libere al usuario
  para mirar otra partida y lo devuelva a la lista de amigos.
- **FR-012**: El sistema MUST reaccionar al fin de la partida o a la pérdida de elegibilidad
  (p. ej. eliminación de la amistad) cerrando o señalando el fin de la sesión de espectador sin
  dejar la vista en estado inconsistente.
- **FR-013**: El sistema MUST mapear los rechazos de alta de espectador a mensajes del catálogo de
  copy del front, sin exponer el mensaje crudo del backend en la UI.
- **FR-014**: El sistema MUST presentar al espectador los hitos de la partida (fin de partida, fin de
  cada game, resolución de envido) de forma neutra e inline en la pantalla de espectador, sin reusar
  los modales de jugador ni marco "ganaste/perdiste". El fin de partida muestra el ganador y un CTA
  para volver a la lista de amigos.
- **FR-015**: El sistema MUST tratar el espectar como un **contexto único**: para empezar a mirar
  otra partida, el usuario debe salir primero de la que está mirando.
- **FR-016**: El sistema MUST reflejar que, mientras especta, el usuario está ocupado (`busy`): el
  backend impide crear/unirse a partidas, buscar Quick Match o aceptar invitaciones; el front no
  ofrece esas acciones en ese estado.
- **FR-017**: El sistema MUST devolver al usuario a la partida que está espectando al cargar o
  reconectar desde cualquier dispositivo o sesión, detectándolo desde la presencia
  (`spectating.matchId`).
- **FR-018**: El sistema MUST mostrar a los amigos que un usuario está espectando como ocupado, con
  el motivo "espectando" (mapeado desde `busyReason = SPECTATING` al copy del front), de modo que no
  se lo pueda invitar mientras especta.

### Key Entities *(include if feature involves data)*

- **Amigo espectable**: un amigo confirmado que tiene una partida en curso que el usuario puede
  mirar. Atributos relevantes para la UI: nombre visible del amigo, si tiene partida espectable y el
  identificador de esa partida.
- **Vista de espectador**: representación pública del estado de una partida para quien la mira.
  Incluye: estado de la partida, puntaje y games ganados por lado, ganador (si lo hay), ronda actual
  (turno, canto vigente, cartas jugadas, reloj de turno) y cantidad de espectadores. No incluye
  cartas en mano ni acciones jugables.
- **Sesión de espectador**: vínculo activo entre el usuario y la partida que mira; existe mientras el
  usuario tenga al menos una sesión registrada como espectador (multi-dispositivo idempotente) y se
  cierra cuando cae la última. Mientras existe, el usuario está `busy` y su presencia expone
  `spectating.matchId`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde la lista de amigos, un usuario puede empezar a mirar la partida de un amigo
  espectable en 2 toques o menos.
- **SC-002**: El 100% de las acciones de los jugadores (cartas y cantos) se reflejan en la vista del
  espectador, en menos de 2 segundos desde que ocurren.
- **SC-003**: En ningún escenario el espectador ve cartas en mano de los jugadores ni acciones
  jugables (0% de fugas de información oculta).
- **SC-004**: Tras una caída y recuperación de conexión, la sesión de espectador se restablece sin
  intervención manual en el 95% de los casos.
- **SC-005**: El 100% de los rechazos de alta de espectador se presentan con un mensaje del catálogo
  de copy del front (nunca el mensaje crudo del backend).

## Assumptions

- El backend ya expone todo lo necesario para espectar; esta feature es íntegramente de frontend y
  no requiere cambios de contrato.
- El identificador de la partida espectable de cada amigo ya viene en el contrato de la lista de
  amigos (`spectatableMatch`), incluyendo sus actualizaciones en tiempo real; el front lo consume
  para descubrir qué partida mirar. (Quedó deliberadamente fuera de alcance en la feature 025 y se
  incorpora acá.)
- El alta como espectador es "WebSocket-first": mirar implica abrir una suscripción en vivo, y la
  vista pública de la partida es el mismo estado que el snapshot REST de espectador.
- El backend ya modela el spectate en la presencia (`spectating.matchId` en `GET /api/me/presence` y
  en `PRESENCE_UPDATED`), deja al usuario en `busy` mientras especta, soporta multi-dispositivo
  idempotente y expone `busyReason = SPECTATING` para los amigos. El retorno cross-device y el estado
  de ocupación son por tanto frontend-only (consumir lo que ya existe); el front solo debe agregar el
  campo `spectating` y el `busyReason` SPECTATING a sus modelos/copy.
- La elegibilidad para espectar la decide y valida el backend (amistad confirmada o pertenencia a la
  misma liga/copa); el front solo ofrece "Mirar" según la disponibilidad informada y respeta los
  rechazos.
- La visibilidad de la información (qué ve el espectador) la define el backend; el front consume y
  renderiza exactamente esa vista pública, sin manos ni acciones.
- Alcance responsivo del proyecto: mobile portrait (360–599px) y desktop (1024px+).
- Out of scope para esta versión: chat de espectadores, repeticiones/diferido, espectar partidas vs
  bots o de no-amigos fuera de liga/copa, y compartir un link público para mirar.
