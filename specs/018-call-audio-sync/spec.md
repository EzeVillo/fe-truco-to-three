# Feature Specification: Audio sincronizado de cantos

**Feature Branch**: `018-call-audio-sync`

**Created**: 2026-06-01

**Status**: Draft

**Input**: User description: "Agregar audio grabado por el usuario para los cantos de truco, envido, quiero, no quiero, quiero y me voy al mazo, retruco, vale cuatro y me voy al mazo, sincronizado con el mismo momento en que aparece el mensaje del canto en pantalla, respetando los delays existentes de eventos de partida."

## Clarifications

### Session 2026-06-01

- Q: Que audios forman parte del alcance inicial? -> A: Todos los audios presentes en `public/audio/calls/`: envido, falta envido, me voy al mazo, no quiero, quiero, quiero y me voy al mazo, real envido, retruco, truco y vale cuatro.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escuchar cantos al aparecer el mensaje (Priority: P1)

Como jugador en una partida, quiero escuchar el audio del canto en el mismo momento en que aparece el mensaje visual, para que la experiencia se sienta natural y sincronizada con el ritmo de la mano.

**Why this priority**: Es el valor principal de la feature. Si el audio suena antes o despues del mensaje, rompe la percepcion del delay y del turno.

**Independent Test**: Puede probarse en una partida donde un jugador canta truco, retruco, vale cuatro, envido, real envido, falta envido o se va al mazo; el audio debe iniciar cuando aparece el texto del canto en pantalla.

**Acceptance Scenarios**:

1. **Given** una partida en curso y un canto de truco recibido, **When** termina el delay visual configurado para ese evento, **Then** se muestra el mensaje del canto y se reproduce el audio correspondiente al mismo tiempo.
2. **Given** una partida en curso y una respuesta "quiero", "no quiero" o "quiero y me voy al mazo", **When** aparece el mensaje de respuesta, **Then** se reproduce el audio de esa respuesta sin adelantarse al mensaje.
3. **Given** una partida en curso y un canto de envido, real envido o falta envido recibido, **When** termina el delay visual configurado para ese evento, **Then** se muestra el mensaje del canto y se reproduce el audio correspondiente al mismo tiempo.
4. **Given** una partida en curso y un jugador que se va al mazo, **When** aparece el mensaje "Me voy al mazo", **Then** se reproduce el audio asociado a esa accion.

---

### User Story 2 - Usar audios grabados por el propietario del juego (Priority: P2)

Como propietario del juego, quiero poder incorporar mis propias grabaciones para cada canto, para darle identidad sonora al producto sin depender de audios genericos.

**Why this priority**: Permite completar la experiencia con material propio y facilita reemplazar grabaciones durante iteraciones de producto.

**Independent Test**: Puede probarse incorporando una grabacion distinta para un canto y verificando que esa grabacion sea la que se escucha durante la partida.

**Acceptance Scenarios**:

1. **Given** que existe una grabacion valida para un canto soportado, **When** ese canto aparece en pantalla, **Then** se reproduce esa grabacion.
2. **Given** que se reemplaza la grabacion de un canto por otra valida, **When** se vuelve a disparar ese canto, **Then** se escucha la nueva grabacion sin cambiar el comportamiento visual.

---

### User Story 3 - Mantener la partida usable si falta o falla un audio (Priority: P3)

Como jugador, quiero que la partida continue normalmente aunque un audio falte, no cargue o el navegador bloquee la reproduccion, para que el sonido nunca impida jugar.

**Why this priority**: El audio mejora la experiencia, pero no debe ser una dependencia critica para el flujo de partida.

**Independent Test**: Puede probarse quitando una grabacion o usando un entorno donde la reproduccion automatica este bloqueada; los mensajes y acciones de la partida deben seguir funcionando.

**Acceptance Scenarios**:

1. **Given** que falta el audio de un canto, **When** ese canto aparece en pantalla, **Then** el mensaje visual se muestra igual y la partida continua sin error visible para el jugador.
2. **Given** que el entorno bloquea la reproduccion de audio, **When** aparece un canto, **Then** la partida no se interrumpe y el usuario puede seguir jugando.

### Edge Cases

- Si dos eventos de canto se procesan en secuencia, cada audio debe corresponder al mensaje que se muestra en ese momento, sin reproducir audios de eventos descartados o anteriores.
- Si se limpia un mensaje visual despues de unos segundos, el audio iniciado para ese mensaje no debe reactivar ni prolongar el mensaje.
- Si el resultado de envido abre una confirmacion o modal despues de mostrar la respuesta, el audio de la respuesta debe escucharse cuando aparece "Quiero" o "No quiero", antes de cualquier vista posterior de resultado.
- Si el mismo canto se repite en rondas distintas, el audio debe poder reproducirse nuevamente desde el inicio.
- Si el usuario navega fuera de la partida, no deben quedar reproducciones pendientes asociadas a mensajes futuros de esa partida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE reproducir audio para los cantos soportados cuando el mensaje visual del canto aparece en pantalla.
- **FR-002**: El sistema DEBE respetar los delays existentes de visualizacion de eventos antes de iniciar cualquier audio de canto.
- **FR-003**: El sistema DEBE soportar todos los audios presentes en `public/audio/calls/`: envido, falta envido, me voy al mazo, no quiero, quiero, quiero y me voy al mazo, real envido, retruco, truco y vale cuatro.
- **FR-004**: El sistema DEBE reproducir el audio tanto para cantos propios como para cantos del rival cuando esos cantos se muestran al jugador.
- **FR-005**: El sistema DEBE permitir reemplazar las grabaciones de los cantos sin alterar las reglas de partida ni los textos mostrados.
- **FR-006**: El sistema DEBE mantener el comportamiento visual y la jugabilidad aunque un audio no este disponible, falle al cargar o no pueda reproducirse.
- **FR-007**: El sistema DEBE iniciar cada reproduccion desde el comienzo del audio correspondiente, incluso si ese mismo canto ya se habia reproducido antes.
- **FR-008**: El sistema NO DEBE reproducir audio al presionar una accion si el canto todavia no fue confirmado y mostrado por el flujo de eventos de partida.
- **FR-009**: El sistema DEBE documentar la lista de cantos soportados y las pautas minimas para preparar las grabaciones.
- **FR-010**: El sistema DEBE evitar que el audio modifique puntajes, turnos, acciones disponibles, resoluciones de mano o cualquier regla del dominio de truco-to-three.

### Key Entities

- **Canto audible**: Representa una accion o respuesta de partida que tiene mensaje visual y puede tener una grabacion asociada. Incluye el tipo de canto, el texto mostrado y la referencia a su audio.
- **Grabacion de canto**: Archivo de audio provisto por el propietario del juego para representar un canto audible. Debe poder ser reemplazado por otra version equivalente.
- **Evento visible de partida**: Momento en el que un canto ya fue procesado por la partida y se muestra al jugador, incluyendo el delay correspondiente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de los audios presentes en `public/audio/calls/`, el audio comienza en el mismo momento perceptible en que aparece el mensaje visual correspondiente.
- **SC-002**: En pruebas manuales de partida, ningun audio se reproduce antes de que el mensaje del canto sea visible.
- **SC-003**: El 100% de los cantos soportados mantiene el flujo de partida operativo cuando su audio falta o falla.
- **SC-004**: Una persona que mantiene el juego puede identificar la lista completa de grabaciones requeridas y reemplazar una de ellas en menos de 5 minutos siguiendo la documentacion.
- **SC-005**: La incorporacion de audio no cambia ningun resultado de partida, puntaje, turno ni accion disponible en los escenarios existentes.

## Assumptions

- Las grabaciones seran provistas por el propietario del juego y se mantendran como assets del producto.
- La primera version cubre un audio por archivo presente en `public/audio/calls/`, sin variantes por jugador, genero de voz, intensidad o contexto de partida.
- Los audios son efectos de experiencia: si no pueden reproducirse, la partida sigue sin bloquear al usuario.
- El contrato con backend no cambia porque los eventos y cantos ya existen; la feature consume los mismos momentos visibles de partida.
- La documentacion tecnica del contrato de API no requiere cambios salvo que se detecte una divergencia durante la planificacion.
