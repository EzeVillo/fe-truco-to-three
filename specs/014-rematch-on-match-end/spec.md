# Feature Specification: Revancha al terminar una partida

**Feature Branch**: `014-rematch-on-match-end`
**Created**: 2026-05-29
**Status**: Draft
**Feature Directory**: `specs/014-rematch-on-match-end`
**Input**: "quiero hacer que al terminar una partida, te de la opcion de rematch"

## Resumen ejecutivo

Cuando una partida **casual** (no perteneciente a liga ni copa) termina, el sistema debe
ofrecer a ambos jugadores la posibilidad de jugar una **revancha** con el mismo rival y el
mismo formato de serie. El backend abre automáticamente una sesión de revancha al finalizar
el match y lo señala con el evento en tiempo real `REMATCH_AVAILABLE`; el frontend reacciona a
esa señal para presentar la opción, reflejar en tiempo real la decisión del oponente y conducir
a la nueva partida cuando ambos aceptan, todo dentro de una ventana de tiempo limitada antes de
que la sesión expire.

> **Responsabilidad:** toda la lógica de negocio de la revancha (cuándo se abre, quién puede,
> tiempos, qué match origina, reglas de liga/copa, comportamiento de bots) vive en el
> **backend**. El frontend es **puramente reactivo**: solo refleja los eventos `REMATCH_*` que
> recibe y no aplica reglas de negocio propias.

## Clarifications

### Session 2026-05-29

- Q: ¿El frontend aplica reglas de negocio (tipo de match, elegibilidad, etc.) para decidir si
  ofrecer revancha? → A: No. Esas reglas viven en el backend. La UI es puramente reactiva a los
  eventos `REMATCH_*`; si el evento no llega, no muestra nada.
- Q: ¿Se agrega lógica especial para bots (asumir que el bot "acepta automáticamente")? → A: No.
  Sin lógica de bot. Si no llega el evento de aceptación/confirmación del rival (caso bot u
  otro), ese estado no se muestra; la UI nunca asume una decisión que no fue notificada.
- Q: ¿Hay que mostrar cuando el rival rechaza la revancha? → A: Sí. Al recibir
  `REMATCH_CLOSED_BY_LEAVE` se muestra el estado "el rival no quiere la revancha" y se
  deshabilita aceptar.
- Q: ¿"Rechazar" es un evento distinto de "abandonar la sesión"? → A: Mismo evento
  (`REMATCH_CLOSED_BY_LEAVE`, decisión `LEFT`): un único estado de cierre por decisión del rival.
- Q: ¿Cuándo aparece la oferta de revancha respecto del modal de fin de partida? → A: Después de
  que el jugador **cierra el modal de resultado**, no de forma simultánea/instantánea (se vería
  raro). No importa si el tiempo de la sesión ya empezó a correr antes: al aparecer la oferta, el
  contador muestra el tiempo restante real (puede ser menor al total).

## User Scenarios & Testing *(mandatory)*

### Historia de usuario principal

Como jugador que acaba de terminar una partida casual, quiero que al ver el resultado se me
ofrezca jugar otra contra el mismo rival, para volver a jugar sin tener que volver al lobby,
crear una partida nueva e invitar/buscar de nuevo al oponente.

### Flujos de aceptación (Given / When / Then)

1. **Oferta de revancha visible tras cerrar el resultado**
   - **Given** una partida casual que llega a su fin con su modal de resultado abierto, y el
     backend abrió la sesión de revancha (llegó `REMATCH_AVAILABLE`, posiblemente con el tiempo
     ya corriendo)
   - **When** el jugador **cierra el modal de resultado**
   - **Then** recién entonces se muestra la oferta de revancha: una opción clara para pedir
     revancha y otra para no aceptarla (volver / salir), con el **tiempo restante real** de la
     ventana (no necesariamente el total). La oferta nunca aparece simultánea al modal de
     resultado.

2. **El jugador acepta la revancha y espera al rival**
   - **Given** la oferta de revancha visible y la sesión en estado abierto
   - **When** el jugador acepta la revancha
   - **Then** su decisión queda registrada y la interfaz muestra que está esperando la
     respuesta del oponente.

3. **El oponente acepta primero**
   - **Given** que el jugador todavía no decidió
   - **When** el oponente pide revancha
   - **Then** la interfaz indica que el oponente quiere revancha (incentivando a aceptar).

4. **Ambos aceptan → nueva partida**
   - **Given** que un jugador ya aceptó la revancha
   - **When** el oponente también acepta
   - **Then** se confirma la revancha y ambos jugadores son llevados automáticamente a la
     nueva partida con el mismo formato de serie y el mismo rival.

5. **El oponente rechaza o abandona la sesión de revancha**
   - **Given** la oferta de revancha visible
   - **When** llega el evento `REMATCH_CLOSED_BY_LEAVE` (el rival rechazó o abandonó: ambos son
     el mismo evento)
   - **Then** la interfaz informa que el oponente no quiere revancha y la opción de aceptar
     deja de estar disponible, ofreciendo solo salir.

6. **La sesión de revancha expira**
   - **Given** la oferta de revancha visible con un tiempo límite corriendo
   - **When** se agota el tiempo sin que ambos acepten
   - **Then** la interfaz informa que la oportunidad de revancha venció y solo queda salir.

7. **El propio jugador decide no jugar revancha**
   - **Given** la oferta de revancha visible
   - **When** el jugador elige no aceptar / abandonar la oferta
   - **Then** sale de la sesión de revancha y puede volver al lobby o pantalla previa.

### Casos límite

- **No llega `REMATCH_AVAILABLE`**: si el evento no llega (p. ej. matches de liga/copa, o
  cualquier caso que el backend no habilite), la UI simplemente no muestra la oferta. El
  frontend no chequea el tipo de match ni aplica ninguna regla propia para decidirlo.
- **Partida contra bot**: la UI no agrega lógica de bot. Si no llega el evento de aceptación
  (`REMATCH_OPPONENT_WANTS`) ni de confirmación (`REMATCH_CONFIRMED`), esos estados no se
  muestran; la interfaz nunca asume que el rival aceptó.
- **Fin por abandono / forfeit**: la UI se apoya únicamente en la señal `REMATCH_AVAILABLE` y
  no necesita distinguir el motivo de fin.
- **Reconexión / recarga durante la ventana de revancha**: al volver a entrar, el jugador
  debe poder recuperar el estado actual de la sesión de revancha (sigue abierta, ya decidió,
  el rival decidió, expiró o se confirmó).
- **Doble aceptación / reintento**: si el jugador toca "aceptar" más de una vez, no debe
  generar estados inconsistentes ni errores visibles.
- **Oferta expira justo al aceptar**: si el jugador acepta cuando la sesión ya expiró, la
  interfaz debe degradar elegantemente mostrando el mensaje de expiración, sin error técnico.
- **Jugador con otra sesión de revancha abierta**: el dominio impide tener dos sesiones de
  revancha abiertas a la vez; la UI debe reflejar el bloqueo con copy de producto, no con el
  mensaje crudo del backend.

## Requirements *(mandatory)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE mostrar la opción de pedir revancha **únicamente** cuando llega
  el evento `REMATCH_AVAILABLE` del backend. Si el evento no llega, no se muestra la oferta.
- **FR-001a**: La oferta de revancha DEBE mostrarse **después de que el jugador cierra el modal
  de fin de partida** (resultado), nunca de forma simultánea o instantánea con él. La señal de
  disponibilidad (`REMATCH_AVAILABLE`) puede haber llegado antes —incluso con el contador ya
  corriendo—; eso no adelanta la aparición de la oferta, que queda supeditada al cierre del modal.
- **FR-002**: El frontend NO DEBE implementar reglas de negocio para decidir si ofrecer
  revancha (no chequea tipo de match liga/copa/casual, elegibilidad, ni infiere el motivo de
  fin). Esa decisión vive en el backend y se comunica exclusivamente por la presencia o
  ausencia del evento `REMATCH_AVAILABLE`.
- **FR-003**: El sistema DEBE permitir al jugador **aceptar** la revancha y reflejar que su
  decisión quedó registrada.
- **FR-004**: El sistema DEBE permitir al jugador **no jugar** la revancha (abandonar la
  oferta) y salir hacia la pantalla previa / lobby.
- **FR-005**: El sistema DEBE reflejar en tiempo real cuando el **oponente pide revancha**
  (evento `REMATCH_OPPONENT_WANTS`), antes de que el propio jugador decida.
- **FR-006**: El sistema DEBE reflejar en tiempo real cuando el **oponente rechaza o abandona**
  la revancha (evento `REMATCH_CLOSED_BY_LEAVE` — rechazo y abandono son el mismo evento),
  mostrando ese estado y deshabilitando la posibilidad de aceptar.
- **FR-007**: Cuando **ambos** jugadores aceptan, el sistema DEBE confirmar la revancha y
  llevar a ambos automáticamente a la **nueva partida**, sin pasos manuales adicionales.
- **FR-008**: La nueva partida DEBE conservar el **mismo formato de serie** (mejor de 1/3/5)
  y el **mismo rival** que la partida original.
- **FR-009**: El sistema DEBE mostrar al jugador el **tiempo restante real** de la ventana de
  revancha al momento de aparecer la oferta (que puede ser menor al total si el contador ya venía
  corriendo) y comunicar claramente cuando la sesión **expira**.
- **FR-010**: Al expirar la sesión sin confirmación, el sistema DEBE deshabilitar la opción
  de aceptar y ofrecer únicamente salir, con copy explicativo.
- **FR-011**: El sistema DEBE recuperar y mostrar el estado correcto de la sesión de revancha
  tras una recarga o reconexión mientras la ventana siga vigente.
- **FR-012**: El frontend NO DEBE agregar lógica especial para bots (no asume que el bot
  "acepta automáticamente"). La UI solo refleja los eventos recibidos; si no llegan
  `REMATCH_OPPONENT_WANTS` ni `REMATCH_CONFIRMED`, esos estados no se muestran.
- **FR-013**: El sistema DEBE traducir los errores de la sesión de revancha (sesión no
  abierta, expirada, jugador no participante, conflicto por sesión ya abierta) a mensajes de
  producto del catálogo del frontend, sin exponer el mensaje crudo del backend.
- **FR-014**: La oferta de revancha y sus controles DEBEN respetar el sistema de diseño del
  producto (botones tematizados, tokens de diseño) y ser usables en mobile (≥360 px) y
  desktop.

### Contexto del contrato (lógica propiedad del backend)

> Estas reglas las **decide y aplica el backend** (`docs/CONTRATOS_API.md §4.17`). Se listan
> solo como contexto del contrato que el frontend consume; el frontend **no las implementa ni
> las valida**: únicamente reacciona a los eventos que recibe.

- Eventos en tiempo real de la sesión que el frontend consume (vía match):
  `REMATCH_AVAILABLE`, `REMATCH_OPPONENT_WANTS`, `REMATCH_CONFIRMED`,
  `REMATCH_CLOSED_BY_LEAVE`, `REMATCH_EXPIRED`. Viajan con el `matchId` de la partida
  **original** (terminada).
- Estados de la sesión (informativos para la UI): `OPEN`, `CONFIRMED`, `CLOSED_BY_LEAVE`,
  `EXPIRED`.
- Decisión por jugador: `UNDECIDED`, `WANTS_REMATCH`, `LEFT`.
- La nueva partida confirmada se identifica con `resultMatchId` (solo presente cuando la
  sesión está `CONFIRMED`).
- El `matchId` usado para operar la revancha es el de la partida **original** (terminada).

### Entidades clave

- **Sesión de revancha**: vínculo temporal entre los dos jugadores de un match casual
  terminado. Atributos relevantes para la UI: identificador de la partida original, estado de
  la sesión, decisión de cada jugador, instante de expiración, identificador de la nueva
  partida (cuando se confirma).
- **Partida original**: el match recién terminado que origina la sesión de revancha.
- **Partida resultante (revancha)**: la nueva partida creada cuando ambos aceptan; hereda
  rival y formato de serie.

## Success Criteria *(mandatory)*

- **SC-001**: Tras cerrar el modal de resultado de una partida casual con sesión de revancha
  disponible, el 100% de las veces el jugador ve la opción de revancha sin tener que navegar a
  otra pantalla. La oferta nunca se muestra simultánea al modal de resultado.
- **SC-002**: Cuando ambos jugadores aceptan, ambos llegan a la nueva partida automáticamente
  sin pasos manuales adicionales (0 acciones extra más allá de aceptar).
- **SC-003**: Los cambios de decisión del oponente (quiere revancha / rechaza o abandona) se
  reflejan en la interfaz del jugador en tiempo real al recibir su evento, percibidos como
  inmediatos.
- **SC-004**: La nueva partida siempre conserva el mismo rival y el mismo formato de serie
  que la original (verificable en el 100% de las revanchas confirmadas).
- **SC-005**: Al expirar la ventana, la interfaz comunica el vencimiento y nunca deja al
  jugador en un estado de espera indefinida.
- **SC-006**: Ningún error de la sesión de revancha muestra texto crudo del backend; todos
  usan copy de producto.
- **SC-007**: La oferta y sus controles son completamente usables en mobile (≥360 px) y
  desktop, sin desbordes ni controles inaccesibles.

## Assumptions

- La oferta de revancha se presenta en la **pantalla de fin de partida** del match casual
  recién jugado (no como notificación global fuera de la pantalla del match), y **secuencialmente
  después** del modal de resultado: primero el jugador cierra el resultado y luego aparece la
  oferta. La sesión/contador del backend puede haber arrancado antes; la UI solo difiere la
  *aparición* de la oferta, no el reloj del backend.
- La oferta es **event-driven**: el frontend se entera de la apertura y los cambios de la
  sesión de revancha por los eventos en tiempo real del match (`REMATCH_AVAILABLE`,
  `REMATCH_OPPONENT_WANTS`, `REMATCH_CONFIRMED`, `REMATCH_CLOSED_BY_LEAVE`, `REMATCH_EXPIRED`)
  y puede consultar el estado puntual vía el snapshot de la sesión cuando necesite reconciliar
  (recarga/reconexión). No infiere el motivo de fin de partida por su cuenta.
- El frontend no agrega lógica de bot ni asume decisiones no notificadas: cada estado de la UI
  (oponente quiere / rechazó / confirmado / expirado) se muestra solo cuando llega su evento
  correspondiente.
- El copy y la traducción de errores siguen el catálogo de mensajes del frontend (no se
  muestra `message` del backend), consistente con la regla de mensajería de errores del
  proyecto.
- El temporizador de la ventana de revancha se representa de forma análoga a otros
  vencimientos del producto (cuenta regresiva basada en el instante de expiración provisto por
  el backend), neutralizando el desfase de reloj cliente/servidor.

## Dependencies

- Contrato de revancha del backend (`docs/CONTRATOS_API.md §4.17`): endpoints de aceptar,
  abandonar y consultar la sesión, y eventos WebSocket `REMATCH_*` (`§9.5`).
- Pantalla / flujo de fin de partida existente, donde se inserta la oferta.
- Conexión WebSocket/STOMP de match ya operativa para recibir eventos en tiempo real.
- Catálogo de copy de errores del frontend.
- Sistema de diseño (tokens y botones tematizados).
