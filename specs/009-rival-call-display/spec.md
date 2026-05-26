# Feature Specification: Visualización de cantos del rival en panel de estado

**Feature Branch**: `009-rival-call-display`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Visualización en tiempo real de los cantos del rival (truco, retruco, vale cuatro, envido, real envido, falta envido) y sus respuestas (quiero, no quiero, quiero y me voy al mazo) en el panel de estado de la partida, debajo del nombre del jugador que realizó el canto. Cada nuevo canto reemplaza el anterior. Las respuestas de aceptación (QUIERO) se borran automáticamente a los 3 segundos. Al iniciar una nueva ronda, se resetean todos los cantos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver canto del rival en el panel (Priority: P1)

Como jugador activo en una partida de truco, quiero ver el texto del canto o respuesta que acaba de realizar mi rival (o yo mismo), ubicado debajo de su nombre en el panel de estado, para saber inmediatamente qué acción está pendiente y qué debo responder.

**Why this priority**: Es el objetivo central de la feature. Sin esta visibilidad, el jugador no tiene forma de saber qué está en juego si llegó distraído o el evento WS llegó mientras miraba otra parte de la pantalla.

**Independent Test**: Se puede probar simulando un evento WS `TRUCO_CALLED` y verificando que el texto "¡Truco!" aparece debajo del nombre del rival en el panel.

**Acceptance Scenarios**:

1. **Given** una partida en progreso, **When** el rival canta "Truco" vía WebSocket, **Then** el texto "¡Truco!" aparece debajo del nombre del rival en el panel de estado.
2. **Given** una partida en progreso, **When** el jugador canta "Envido" desde su propia interfaz, **Then** el texto "¡Envido!" aparece debajo del nombre del jugador en el panel de estado.
3. **Given** que ya hay un canto visible, **When** llega un nuevo canto, **Then** el texto anterior desaparece y se reemplaza por el nuevo.

---

### User Story 2 - Auto-limpieza de aceptaciones (Priority: P2)

Como jugador, quiero que las respuestas de tipo "Quiero" desaparezcan solas después de unos segundos, porque una vez aceptado el canto la partida continúa y ese texto ya no aporta información útil.

**Why this priority**: Evita saturar visualmente el panel con mensajes obsoletos. No es crítico para entender la mecánica, pero mejora significativamente la claridad.

**Independent Test**: Se puede probar simulando un evento `TRUCO_RESPONDED` con `QUIERO` y verificando que el texto desaparece pasados 3 segundos sin interacción del usuario.

**Acceptance Scenarios**:

1. **Given** que el rival respondió "Quiero" a un canto, **When** transcurren 3 segundos, **Then** el texto "¡Quiero!" desaparece del panel.
2. **Given** que el texto de aceptación está visible, **When** llega un nuevo canto antes de los 3 segundos, **Then** el texto se reemplaza inmediatamente por el nuevo canto (no espera el timeout).

---

### User Story 3 - Reset al iniciar nueva ronda (Priority: P2)

Como jugador, quiero que todos los textos de cantos se borren al empezar una nueva ronda, para empezar cada mano con un panel limpio y sin información de la ronda anterior.

**Why this priority**: Garantiza que no queden mensajes confusos de rondas previas. Es importante para la integridad de la experiencia, pero depende de que exista el flujo de nueva ronda.

**Independent Test**: Se puede probar simulando un evento `ROUND_STARTED` y verificando que cualquier texto de canto previo desaparece.

**Acceptance Scenarios**:

1. **Given** que hay un texto de canto visible del rival, **When** el servidor envía `ROUND_STARTED`, **Then** el texto desaparece inmediatamente.
2. **Given** que hay un texto de canto propio visible, **When** empieza una nueva ronda, **Then** el texto también desaparece.

---

### Edge Cases

- **Canto inesperado**: Si llega un evento de canto cuando no hay una ronda activa (estado inconsistente transitorio), el sistema no debe intentar renderizar texto de canto.
- **Reconexión**: Si el jugador se reconecta en medio de una ronda, solo ve el canto más reciente (si existe en el snapshot), no el historial de cantos de la ronda actual.
- **Cantos rápidos consecutivos**: Si llegan dos eventos de canto en un intervalo menor a 100 ms, se debe mostrar el segundo; no es necesario mostrar ambos ni encolarlos.
- **Timeout interrumpido**: Si un timer de 3 segundos para auto-limpieza está activo y llega un nuevo evento, el timer anterior se debe cancelar para evitar que borre el nuevo texto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El panel de estado debe mostrar el texto del último canto o respuesta realizado por cualquier jugador de la partida.
- **FR-002**: El texto debe ubicarse visualmente debajo del nombre del jugador que realizó la acción (rival o propio).
- **FR-003**: Cada nuevo canto o respuesta debe reemplazar visualmente al texto anterior; nunca debe haber más de un texto de canto visible simultáneamente por jugador.
- **FR-004**: Las respuestas de aceptación (tipo "Quiero", tanto para truco como para envido) deben desaparecer automáticamente del panel a los 3 segundos de haber aparecido.
- **FR-005**: Al iniciar una nueva ronda de juego (evento de nueva mano), el texto de canto debe borrarse completamente para ambos jugadores.
- **FR-006**: El texto de canto debe tener un estilo visual distintivo (color, peso de fuente o fondo) que lo diferencie de los datos estáticos del panel (nombres, puntos, serie).
- **FR-007**: Si un jugador abandona o la partida finaliza, los textos de canto deben desaparecer.

### Key Entities *(include if feature involves data)*

- **Último canto**: Representa la acción más reciente de canto o respuesta dentro de una ronda. Atributos: jugador que actuó (asiento), texto legible del canto, indicador de si es una aceptación (para activar auto-limpieza).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El jugador identifica un canto del rival en menos de 1 segundo desde que llega el evento al front-end.
- **SC-002**: En ningún momento hay más de un texto de canto visible simultáneamente por jugador en el panel.
- **SC-003**: Las respuestas de aceptación desaparecen entre 2.5 y 3.5 segundos después de haber aparecido (margen de tolerancia de ±0.5 s).
- **SC-004**: Al iniciar una nueva ronda, el texto de canto desaparece antes de que el jugador deba tomar su primera decisión de la nueva mano.
- **SC-005**: El 100% de los tipos de canto y respuesta soportados por las reglas del juego (truco, retruco, vale cuatro, envido, real envido, falta envido, quiero, no quiero, quiero y me voy al mazo, me voy al mazo) se reflejan correctamente en el panel.

## Assumptions

- La fuente de eventos de cantos es el canal WebSocket de partida ya existente (`/user/queue/match`); no se requiere un nuevo endpoint ni canal.
- El panel de estado (`MatchStatusPanel`) cuenta con espacio suficiente debajo de los nombres de jugador para una línea de texto adicional sin romper el layout en resoluciones móviles (360 px de ancho mínimo).
- No se requieren sonidos, animaciones complejas ni notificaciones push para la primera versión de esta feature.
- El idioma de los textos renderizados es español, coherente con el resto de la aplicación.
