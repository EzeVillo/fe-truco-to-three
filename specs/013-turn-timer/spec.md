# Feature Specification: Temporizador de turno en partida

**Feature Branch**: `013-turn-timer`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Temporizador de turno en pantalla durante la partida, alimentado por el deadline del backend"

## Resumen

Durante una partida en curso, el jugador que debe actuar (jugar una carta o responder un canto)
dispone de un plazo limitado para hacerlo. Si lo agota, el backend declara la partida perdida por
inactividad. Hoy ese plazo existe en el backend pero no se muestra en la interfaz: el jugador no
tiene forma de saber cuánto tiempo le queda y puede perder sin entender por qué.

Esta feature muestra en pantalla una cuenta regresiva del plazo del turno, sobre el asiento que
debe actuar, visible para los dos jugadores de la partida. El backend sigue siendo el único árbitro
del vencimiento; la interfaz solo representa el tiempo restante que el backend comunica.

## Clarifications

### Session 2026-05-29

- Q: ¿La vista de espectador entra en alcance? → A: No. La feature de espectador no existe hoy en el
  frontend; el temporizador aplica únicamente a los dos jugadores de la partida. Espectador queda
  fuera de alcance.
- Q: ¿Cómo se representa visualmente la cuenta regresiva? → A: Sólo indicador visual de progreso
  (anillo/barra que se vacía), sin mostrar el número de segundos.
- Q: ¿Umbral de urgencia? → A: Cuando quedan 5 segundos o menos.
- Q: ¿Qué pasa con los controles del jugador al llegar a 0 antes de la confirmación del backend? →
  A: Se deshabilitan los controles de acción y se muestra el estado de "tiempo agotado", a la espera
  de la resolución del backend.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver mi tiempo restante para actuar (Priority: P1)

Como jugador en una partida en curso, cuando es mi turno de actuar (jugar carta o responder un
canto), quiero ver una cuenta regresiva clara del tiempo que me queda, para no perder por
inactividad y poder decidir con conciencia del plazo.

**Why this priority**: Es el núcleo de la feature y el caso que evita la pérdida silenciosa por
timeout. Sin esto la feature no aporta valor. Entregable como MVP por sí solo.

**Independent Test**: Iniciar una partida, llegar a un punto donde el jugador autenticado debe
actuar, y verificar que aparece una cuenta regresiva que decrece hasta cero y que coincide con el
plazo informado por el backend.

**Acceptance Scenarios**:

1. **Given** una partida en curso donde es el turno del jugador autenticado, **When** se inicia su
   turno, **Then** se muestra una cuenta regresiva sobre su lado que parte del plazo total y
   decrece en tiempo real.
2. **Given** la cuenta regresiva en curso, **When** el jugador realiza su acción antes de que
   expire, **Then** la cuenta regresiva desaparece (o se detiene) inmediatamente.
3. **Given** el turno del jugador con poco tiempo restante, **When** el tiempo se acerca a cero,
   **Then** la cuenta regresiva comunica visualmente la urgencia.
4. **Given** que el jugador debe responder un canto (truco/envido) y no es su turno de jugar carta,
   **When** queda pendiente su respuesta, **Then** la cuenta regresiva corre sobre su lado igual que
   en un turno normal.

---

### User Story 2 - Ver el tiempo del rival (Priority: P2)

Como jugador en una partida en curso, quiero ver la cuenta regresiva del rival cuando le toca
actuar a él, para saber cuánto puede demorar y anticipar si va a perder por inactividad.

**Why this priority**: Aporta simetría y contexto competitivo, pero la partida es jugable sin ello.
Depende de la misma información que P1.

**Independent Test**: En una partida, llegar a un punto donde debe actuar el rival y verificar que
la cuenta regresiva aparece sobre el lado del rival y decrece en tiempo real.

**Acceptance Scenarios**:

1. **Given** una partida en curso donde es el turno del rival, **When** comienza su turno, **Then**
   la cuenta regresiva se muestra sobre el lado del rival.
2. **Given** la cuenta regresiva del rival corriendo, **When** el rival actúa, **Then** la cuenta
   regresiva del rival desaparece y, si corresponde, comienza la del jugador autenticado.

---

### Edge Cases

- **Reconexión / carga a mitad de turno**: al volver a entrar o recargar con un turno ya en curso,
  la cuenta regresiva debe arrancar en el tiempo restante correcto (no desde el plazo total).
- **Tiempo agotado antes de la confirmación del backend**: si la cuenta regresiva llega a cero
  antes de que el backend confirme el resultado, la interfaz muestra "tiempo agotado", deshabilita
  los controles de acción del jugador y no declara la derrota por su cuenta (el backend es el
  árbitro).
- **Sin turno activo**: cuando no hay un asiento obligado a actuar (mano resuelta, animaciones de
  cierre, transición entre rondas/partidas), no debe mostrarse ninguna cuenta regresiva.
- **Desfase de reloj del dispositivo**: el tiempo mostrado debe basarse en el plazo del backend y no
  en una hipótesis del reloj local que pudiera estar adelantado o atrasado.
- **Cambio de plazo durante la mano**: si cambia el asiento que debe actuar (canto, respuesta, nueva
  ronda), la cuenta regresiva se reinicia para el nuevo plazo.
- **Fin de partida durante la cuenta regresiva**: si la partida termina (por la causa que sea)
  mientras corre la cuenta regresiva, esta se oculta.
- **Partida contra bot**: el bot actúa de inmediato; su cuenta regresiva puede aparecer y
  desaparecer muy rápido o no llegar a percibirse, mientras que la del jugador humano se comporta
  normalmente.
- **Plazo vencido o ausente al cargar el estado**: si al recibir el estado de la partida el plazo ya
  venció, o los campos del plazo llegan ausentes/nulos durante una partida en curso, el sistema no
  muestra un reloj "en marcha" incorrecto: lo trata como sin reloj (indicador oculto) o como "tiempo
  agotado" según corresponda, sin parpadeo, a la espera de la resolución del backend.
- **Falta del evento de limpieza**: si la cuenta regresiva llega a 0 y no llega un evento explícito
  que cierre la mano/partida, el indicador permanece en "tiempo agotado"/oculto sin reiniciarse
  hasta que el backend comunique el cierre.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar una cuenta regresiva del plazo del turno cuando exista un
  asiento obligado a actuar en una partida en curso, mediante un indicador visual de progreso
  (anillo que se vacía a medida que avanza el tiempo). El indicador MUST NOT mostrar el valor
  numérico de segundos restantes.
- **FR-002**: La cuenta regresiva MUST mostrarse sobre el asiento que debe actuar, y MUST aplicar
  tanto al jugador autenticado como al rival (ambos lados).
- **FR-003**: El tiempo restante mostrado MUST derivarse del plazo informado por el backend, no de
  un valor fijo definido por la interfaz.
- **FR-004**: La cuenta regresiva MUST reiniciarse cada vez que cambia el asiento obligado a actuar
  (cambio de turno, canto de truco/envido, respuesta que devuelve el juego al rival, nueva ronda).
- **FR-005**: La cuenta regresiva MUST detenerse y ocultarse cuando ya no hay un asiento obligado a
  actuar.
- **FR-006**: El sistema MUST representar visualmente la urgencia (énfasis/cambio de color del
  indicador) cuando quedan 5 segundos o menos.
- **FR-007**: El sistema MUST NOT declarar la derrota por inactividad por su cuenta; MUST esperar la
  resolución comunicada por el backend.
- **FR-008**: Al alcanzar cero antes de la resolución del backend, el sistema MUST mostrar un estado
  de "tiempo agotado" y MUST deshabilitar los controles de acción del jugador, a la espera de la
  resolución comunicada por el backend.
- **FR-009**: Tras una reconexión o recarga con un turno en curso, el sistema MUST mostrar el tiempo
  restante correcto del plazo vigente, no el plazo total.
- **FR-010**: El cálculo del tiempo restante MUST ser robusto frente al desfase del reloj del
  dispositivo del usuario, alineándose con la referencia temporal del backend.
- **FR-011**: El sistema MUST mostrar la cuenta regresiva de forma legible y sin romper el layout en
  los tamaños soportados (mobile desde 360 px y desktop).
- **FR-012**: Cuando la partida finaliza o se cancela, el sistema MUST ocultar cualquier cuenta
  regresiva activa.
- **FR-013**: El sistema MUST tolerar un plazo ausente/nulo o ya vencido al cargar el estado, sin
  mostrar un reloj en marcha incorrecto ni parpadeo; en ese caso oculta el indicador o muestra
  "tiempo agotado" según corresponda, y nunca declara la derrota por su cuenta.

### Key Entities *(include if feature involves data)*

- **Plazo de acción (action deadline)**: información provista por el backend que describe el momento
  límite en que el asiento obligado debe actuar, el plazo total del turno y a qué asiento aplica.
  Es la fuente de verdad del tiempo restante.
- **Asiento obligado a actuar**: el participante (jugador autenticado o rival) sobre el cual corre
  la cuenta regresiva en un momento dado; puede no coincidir con el "turno" cuando hay una respuesta
  de canto pendiente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de los turnos donde un jugador debe actuar en una partida en curso, se
  muestra una cuenta regresiva visible.
- **SC-002**: El tiempo mostrado coincide con el plazo real del backend con una diferencia no mayor
  a 1 segundo en condiciones normales de red.
- **SC-003**: Tras reconectar o recargar a mitad de un turno, la cuenta regresiva refleja el tiempo
  restante correcto en menos de 2 segundos desde que se restablece el estado de la partida.
- **SC-004**: Ninguna partida se da por perdida en la interfaz sin que el backend lo haya
  comunicado (0 falsos positivos de derrota por timeout originados en el cliente).
- **SC-005**: La cuenta regresiva aparece y se reinicia correctamente al cambiar el asiento obligado
  a actuar en el 100% de los cambios de turno/canto observados en una partida de prueba.
- **SC-006**: La cuenta regresiva se muestra correctamente y sin desbordes de layout en mobile
  (360 px) y desktop.

## Assumptions

- El backend ya expone el plazo del turno (momento límite, duración total y asiento obligado) tanto
  en el estado de la partida como mediante eventos en tiempo real, y es el único árbitro del
  vencimiento. (Ver contrato del backend, sección de temporizador de turno.)
- La feature aplica a partidas en curso (en progreso); no aplica a salas en espera ni a partidas
  finalizadas.
- La cuenta regresiva se muestra para ambos asientos según indique el backend, incluyendo partidas
  contra bot, aunque el lado del bot se resuelva casi instantáneamente.
- El alcance es la representación visual y la lógica de tiempo en el cliente; no incluye cambiar la
  duración del plazo ni la mecánica de forfeit, que viven en el backend.
- La vista de espectador está fuera de alcance: no existe en el frontend actual. El temporizador se
  implementa sólo para los dos jugadores de la partida.
- Se reutiliza la pantalla de partida existente y su panel de estado como lugar donde mostrar la
  cuenta regresiva.
- El proyecto sólo contempla mobile portrait (desde 360 px) y desktop (desde 1024 px); landscape
  mobile está fuera de alcance.
