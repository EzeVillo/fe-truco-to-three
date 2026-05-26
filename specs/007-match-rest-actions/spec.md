# Feature Specification: Acciones de match contra el backend (REST)

**Feature Branch**: `007-match-rest-actions`

**Created**: 2026-05-25

**Status**: Draft

**Input**: User description: "necesito que se empiece a consumir el BE en cada una de las acciones posibles de match, por el momento solo endpoints REST de docs/CONTRATOS_API.md, las acciones estén disponibles según el mock, no importa si fallan, en esta etapa no se muestra ningún error al usuario. Acciones: truco (cualquiera), envido (cualquiera), responder truco (cualquiera), responder envido (cualquiera), irse al mazo, jugar una carta haciendo click. Si se toca envido en el menú default se abre el submenú de envidos. Si no hay envido disponible, no se marca la opción en el menú por defecto. No se pone la carta en la mesa al hacer click (eso vendrá por WS). Al crear partida contra el bot, llevar al match consumiendo endpoints REST necesarios. Nada de WebSocket."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar al match al crear partida contra el bot (Priority: P1)

Cuando el usuario crea una partida contra el bot desde el lobby, además de invocar al backend para crearla, la aplicación lo navega automáticamente a la pantalla de match correspondiente. Hasta ahora la pantalla de match se accedía con datos mock; ahora se accede como continuación natural del flujo de creación de bot match.

**Why this priority**: Sin este paso, ninguna acción de match contra backend tiene contexto real (no hay `matchId` desde el cual disparar acciones). Es el punto de entrada que habilita el resto de la feature.

**Independent Test**: Desde el lobby vs bots, configurar y crear una partida. Verificar que el frontend llama al endpoint REST de creación de bot match, que recibe un `matchId`, y que la navegación deja al usuario en la pantalla de match con ese `matchId` en la URL, sin abrir conexión WebSocket.

**Acceptance Scenarios**:

1. **Given** el usuario está en la pantalla de configuración de partida vs bot y eligió un formato de serie válido, **When** confirma la creación, **Then** el frontend llama al endpoint REST de creación de bot match, recibe el `matchId` y navega a la ruta de match con ese identificador.
2. **Given** la creación de la partida contra el bot se completó con éxito, **When** la app navega al match, **Then** la pantalla de match se monta en su estado por defecto (mock) usando ese `matchId` como contexto, sin abrir conexión WebSocket.
3. **Given** la creación falla en el backend, **When** ocurre el error, **Then** el usuario no ve mensajes de error y permanece en la pantalla de configuración (no se navega al match).

---

### User Story 2 - Disparar acciones de match contra el backend (Priority: P1)

Desde la pantalla de match, cada acción que el mock hoy presenta como disponible debe invocar el endpoint REST correspondiente del backend con el `matchId` del contexto. Las acciones cubiertas en esta iteración son:

- Cantar truco (cualquier variante: TRUCO / RETRUCO / VALE_CUATRO según el estado del mock).
- Cantar envido (cualquier variante: ENVIDO / REAL_ENVIDO / FALTA_ENVIDO).
- Responder truco (QUIERO / NO_QUIERO / QUIERO_Y_ME_VOY_AL_MAZO).
- Responder envido (QUIERO / NO_QUIERO).
- Irse al mazo (fold).
- Jugar una carta haciendo click sobre ella en la mano del jugador.

La invocación es **fire-and-forget** desde el punto de vista de la UI: la app llama al endpoint, pero no muestra resultado ni error. La carta clickeada **no** se mueve a la mesa: el mover la carta a la mesa será disparado más adelante por un evento WebSocket. La UI puede dar feedback mínimo no bloqueante (ej. botón inactivo temporalmente para evitar dobles disparos) pero **no** muestra mensajes de error al usuario aunque el endpoint falle.

**Why this priority**: Es el corazón de la feature: convierte la pantalla de match de un mock estático en algo que efectivamente habla con el backend.

**Independent Test**: Estando en la pantalla de match (creada vía US1 o ingresada manualmente con un `matchId` válido en la URL), tocar cada una de las acciones disponibles según el mock. Verificar que cada toque produce exactamente una request HTTP al endpoint REST correspondiente con el `matchId` y el body esperado por el contrato. Verificar que ante respuesta de error del backend, la UI no muestra ningún error al usuario.

**Acceptance Scenarios**:

1. **Given** el usuario está en una pantalla de match con `matchId` y la acción "cantar truco" está disponible según el mock, **When** la activa, **Then** se envía exactamente una request al endpoint REST de truco con ese `matchId`.
2. **Given** la acción de cantar envido está disponible, **When** el usuario toca la opción "envido" en el menú default, **Then** se abre un submenú con las variantes de envido (ENVIDO, REAL_ENVIDO, FALTA_ENVIDO) y al seleccionar una se envía la request REST correspondiente con `call` igual al enum elegido.
3. **Given** está en curso un truco rival, **When** el usuario elige una opción de respuesta de truco, **Then** se envía la request REST de respuesta de truco con `response` igual al enum elegido (QUIERO, NO_QUIERO o QUIERO_Y_ME_VOY_AL_MAZO).
4. **Given** está en curso un envido rival, **When** el usuario elige una opción de respuesta de envido, **Then** se envía la request REST de respuesta de envido con `response` igual al enum elegido (QUIERO o NO_QUIERO).
5. **Given** la acción "irse al mazo" está disponible, **When** el usuario la activa, **Then** se envía exactamente una request al endpoint REST de fold con ese `matchId`.
6. **Given** el usuario tiene cartas en la mano según el mock, **When** hace click en una carta jugable, **Then** se envía exactamente una request al endpoint REST de jugar carta con el `suit` y `number` correspondientes, y la carta NO se mueve visualmente a la mesa (la mano permanece igual en el cliente).
7. **Given** cualquiera de las acciones anteriores responde con error 4xx o 5xx desde el backend, **When** la respuesta llega, **Then** no se muestra mensaje de error al usuario; la UI permanece estable en su estado previo.

---

### User Story 3 - Habilitación de acciones según el mock (Priority: P2)

La disponibilidad de cada acción en la UI sigue dictada por el mock actual de estado de match (igual que en la pantalla previa a esta feature): si el mock indica que una acción no está disponible, la UI no la ofrece como activable. Específicamente, en el menú por defecto la opción "envido" sólo aparece marcada/habilitada si hay un envido cantable según el mock; si no hay envido disponible, esa opción no se marca como activable y no abre submenú.

**Why this priority**: Sin esto, el usuario podría disparar requests para acciones que el mock no contempla, generando ruido y comportamiento inconsistente con la UI. No es bloqueante para el corazón de la feature, pero es necesario para que el comportamiento sea coherente con la pantalla actual.

**Independent Test**: Con distintas configuraciones del mock (envido disponible / no disponible, truco disponible / no, fold disponible / no, etc.), verificar que la UI sólo permite activar las acciones marcadas como disponibles y que el menú por defecto sólo marca "envido" cuando hay envido cantable.

**Acceptance Scenarios**:

1. **Given** el mock indica que no hay envido disponible, **When** se renderiza el menú por defecto, **Then** la opción "envido" aparece desactivada o no marcada y no es clickeable como entrada al submenú de envidos.
2. **Given** el mock indica que sí hay envido disponible, **When** el usuario toca "envido" en el menú por defecto, **Then** se abre el submenú con las variantes y al seleccionar una se dispara la request REST.
3. **Given** una acción cualquiera no figura como disponible en el mock, **When** el usuario interactúa con la UI, **Then** no existe forma de activarla y por lo tanto no se dispara request al backend.

---

### Edge Cases

- Tap repetido sobre la misma acción antes de que vuelva la respuesta del backend: la UI debe evitar disparar múltiples requests duplicadas para la misma acción en una ventana corta (debounce / botón inactivo) sin mostrar mensajes al usuario.
- Cliquear una carta de la mano que no está marcada como jugable por el mock: no dispara request ni produce cambios visuales.
- Pérdida momentánea de conectividad: la request falla silenciosamente; la UI no muestra error.
- El usuario navega a la pantalla de match con un `matchId` que no le corresponde o ya no está en progreso: las acciones se intentan igual contra el backend (porque el mock las marca como disponibles) y los errores se silencian. No se hace verificación previa con el backend.
- Submenú de envido abierto y luego el usuario cierra sin elegir: no se dispara ninguna request.
- Creación de bot match exitosa pero el backend tarda más de lo esperado: la UI queda en estado de "creando" sin mostrar error; al recibir respuesta navega al match.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al confirmar la creación de una partida contra el bot, el sistema DEBE invocar el endpoint REST de creación de bot match definido en `docs/CONTRATOS_API.md` y, sólo si la respuesta es exitosa, navegar al usuario a la pantalla de match con el `matchId` recibido.
- **FR-002**: La pantalla de match DEBE poder obtener el `matchId` desde la ruta (parámetro de URL) y mantenerlo como contexto para todas las acciones disparadas.
- **FR-003**: La acción "cantar truco" en la UI DEBE invocar el endpoint REST de truco del contrato pasando el `matchId` del contexto.
- **FR-004**: La acción "cantar envido" DEBE invocar el endpoint REST de envido pasando el `matchId` y un body con `call` ∈ {`ENVIDO`, `REAL_ENVIDO`, `FALTA_ENVIDO`} según la variante elegida por el usuario en el submenú.
- **FR-005**: La acción "responder truco" DEBE invocar el endpoint REST de respuesta de truco con `response` ∈ {`QUIERO`, `NO_QUIERO`, `QUIERO_Y_ME_VOY_AL_MAZO`}.
- **FR-006**: La acción "responder envido" DEBE invocar el endpoint REST de respuesta de envido con `response` ∈ {`QUIERO`, `NO_QUIERO`}.
- **FR-007**: La acción "irse al mazo" DEBE invocar el endpoint REST de fold del contrato.
- **FR-008**: El click sobre una carta de la mano del jugador DEBE invocar el endpoint REST de jugar carta con el `suit` y `number` de la carta clickeada.
- **FR-009**: Al hacer click sobre una carta, el sistema NO DEBE mover visualmente la carta a la mesa ni alterar el estado visual de la mano; la mano sigue mostrando lo que indica el mock.
- **FR-010**: El sistema NO DEBE mostrar mensajes de error al usuario ante respuestas no-2xx, timeouts o errores de red de cualquiera de las acciones de esta feature. Los errores se silencian (pueden loguearse en consola para diagnóstico).
- **FR-011**: La disponibilidad visual de cada acción en la pantalla de match DEBE seguir derivándose del mock de estado actual; las acciones no marcadas como disponibles en el mock no DEBEN ser activables por el usuario.
- **FR-012**: En el menú de acciones por defecto, la opción "envido" sólo DEBE aparecer marcada/habilitada cuando el mock indique que hay un envido cantable; si no, NO DEBE permitir abrir el submenú de envidos.
- **FR-013**: Al activar la opción "envido" del menú por defecto, el sistema DEBE mostrar el submenú con las variantes ENVIDO / REAL_ENVIDO / FALTA_ENVIDO antes de disparar la request.
- **FR-014**: Todas las requests REST DEBEN incluir el `Authorization: Bearer <jwt>` provisto por el interceptor existente; no se introduce auth adicional.
- **FR-015**: El sistema DEBE prevenir disparar múltiples requests duplicadas para la misma acción ante taps repetidos en una ventana corta, sin mostrar feedback de error al usuario.
- **FR-016**: Esta feature NO DEBE introducir suscripciones, conexiones ni manejo de eventos WebSocket; el efecto visual de las acciones (cartas a la mesa, cambios de turno, marcador) sigue siendo provisto por el mock y se conectará a WS en una iteración posterior.

### Key Entities *(include if feature involves data)*

- **MatchId**: Identificador UUID de la partida activa. Se obtiene como respuesta a la creación de bot match y se propaga vía URL a la pantalla de match. Es el único dato de contexto necesario para disparar todas las acciones REST.
- **Acción de match**: Operación discreta que el usuario puede invocar (truco / envido / responder truco / responder envido / fold / jugar carta). Cada una se mapea 1:1 a un endpoint REST del contrato y, donde aplique, lleva un enum o un par `(suit, number)` como payload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las acciones de match disponibles según el mock (truco, envido y sus variantes, responder truco, responder envido, fold, jugar carta) disparan exactamente una request al endpoint REST correspondiente al ser activadas por el usuario.
- **SC-002**: Crear una partida contra el bot navega al usuario a la pantalla de match en ≤ 2 segundos en condiciones normales de red local; tras la navegación, la pantalla de match queda lista para disparar acciones.
- **SC-003**: Ante respuestas de error del backend (4xx, 5xx, timeouts), 0 mensajes de error son mostrados al usuario en la UI durante el flujo de match.
- **SC-004**: La opción "envido" del menú por defecto está marcada como activable únicamente cuando el mock provee al menos una variante de envido cantable; en los demás casos, no es clickeable y no abre submenú.
- **SC-005**: Hacer click repetidamente sobre la misma acción en menos de 1 segundo no produce más de una request HTTP al backend.
- **SC-006**: La pantalla de match no abre conexiones WebSocket ni se suscribe a ningún canal STOMP en el contexto de esta feature (verificable por inspección de red).

## Assumptions

- La pantalla de match ya existe (feature 006) y se renderiza hoy sobre datos mock; esta feature reusa esa misma pantalla y su mock como fuente de verdad para qué acciones están disponibles.
- Existe (o se agrega como parte de esta feature) una ruta de match parametrizada por `matchId`. La navegación al match se hace por esa ruta tras crear el bot match.
- El endpoint para crear partida contra el bot existe en el backend (`POST /api/matches/bot`) y devuelve al menos el `matchId` necesario para la navegación. El detalle exacto del contrato del endpoint de bot match se validará en la fase de planning contra `docs/CONTRATOS_API.md` completo (sección de bot match) y el contract test existente.
- El backend acepta los enums exactamente como están definidos en `docs/CONTRATOS_API.md §8.1` (case-sensitive).
- El interceptor JWT actual ya inyecta `Authorization: Bearer <jwt>` en todas las requests bajo `/api/**`; no hace falta tocarlo.
- "No mostrar errores al usuario" significa: no banners, no toasts, no diálogos, no mensajes inline. Loguear en consola para diagnóstico de desarrollador es aceptable.
- El comportamiento de "no mover la carta a la mesa al click" se mantiene aunque la request de jugar carta sea 2xx exitosa; ese movimiento será disparado por un evento WS futuro y no forma parte de esta entrega.
- Esta iteración no exige eliminar el mock: el mock sigue mandando en la UI, y las requests REST son un side-effect adicional sin loop de retorno visual.
