# Feature Specification: Sistema de logros

**Feature Branch**: `016-achievement-system`

**Created**: 2026-05-31

**Status**: Draft

**Input**: User description: "Implementar sistema de logros: identidad visible de usuario registrado, perfil de jugador con estadisticas y logros, notificaciones en tiempo real de logros desbloqueados, sin logros para invitados ni partidas contra bots"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver perfil con estadisticas y logros (Priority: P1)

Como jugador registrado, quiero abrir mi perfil o el perfil de otro jugador para ver sus estadisticas agregadas y los logros que ya desbloqueo.

**Why this priority**: Es el valor principal del sistema de logros: hace visibles el progreso y el historial competitivo de cada jugador registrado.

**Independent Test**: Se puede probar ingresando con un usuario registrado, abriendo un perfil existente y verificando que se muestran estadisticas, logros desbloqueados y estados vacios cuando corresponde.

**Acceptance Scenarios**:

1. **Given** un jugador registrado con logros desbloqueados, **When** abre su perfil, **Then** ve sus partidas jugadas, ganadas, perdidas, porcentaje de victorias y la lista de logros desbloqueados.
2. **Given** un jugador registrado sin logros desbloqueados, **When** abre su perfil, **Then** ve sus estadisticas y un estado vacio claro para logros.
3. **Given** un jugador registrado, **When** consulta el perfil de otro jugador existente, **Then** ve el mismo tipo de informacion publica para ese jugador.

---

### User Story 2 - Recibir aviso al desbloquear un logro (Priority: P2)

Como jugador registrado, quiero recibir una notificacion visible cuando desbloqueo un logro para reconocer inmediatamente el hito conseguido.

**Why this priority**: Refuerza el feedback del juego en el momento de mayor impacto, sin obligar al jugador a revisar manualmente su perfil.

**Independent Test**: Se puede probar simulando o provocando un desbloqueo de logro en una partida humana y verificando que el aviso aparece una sola vez con informacion comprensible.

**Acceptance Scenarios**:

1. **Given** un jugador registrado en una partida contra otro humano, **When** desbloquea un logro, **Then** recibe una notificacion con el nombre del logro y una descripcion breve.
2. **Given** un logro recien desbloqueado, **When** el jugador abre su perfil luego del aviso, **Then** el logro aparece como desbloqueado en la lista.
3. **Given** varios logros desbloqueados en un periodo corto, **When** llegan las novedades, **Then** el jugador puede ver cada logro sin perder informacion.

---

### User Story 3 - Identidad persistente para acceder al perfil propio (Priority: P2)

Como jugador registrado, quiero que la aplicacion recuerde mi nombre de usuario de forma confiable para poder acceder a mi perfil desde la navegacion principal.

**Why this priority**: El sistema de perfil depende de una identidad visible estable; sin esto, el acceso a "mi perfil" queda incompleto despues de iniciar sesion, refrescar sesion o recargar la aplicacion.

**Independent Test**: Se puede probar iniciando sesion, recargando la aplicacion y verificando que el nombre del jugador y el acceso al perfil propio se conservan para usuarios registrados.

**Acceptance Scenarios**:

1. **Given** un usuario registrado que inicia sesion, **When** entra a la aplicacion, **Then** la navegacion muestra su nombre de usuario y permite abrir su perfil.
2. **Given** una sesion registrada persistida, **When** el jugador recarga la aplicacion, **Then** se conserva o recupera su identidad visible antes de entrar al perfil.
3. **Given** un invitado, **When** usa la aplicacion, **Then** no se le ofrece perfil de logros como si fuera un usuario registrado.

---

### User Story 4 - Manejar perfiles no disponibles (Priority: P3)

Como jugador registrado, quiero recibir mensajes claros cuando un perfil no existe o no esta disponible para entender por que no puedo verlo.

**Why this priority**: Mejora la experiencia en busquedas, enlaces compartidos o errores de escritura, pero no bloquea el valor central de ver perfiles existentes.

**Independent Test**: Se puede probar intentando abrir perfiles inexistentes o perfiles de invitados y verificando que se muestra una salida comprensible.

**Acceptance Scenarios**:

1. **Given** un jugador registrado, **When** abre un perfil inexistente, **Then** ve un mensaje de perfil no encontrado y una forma clara de volver.
2. **Given** un invitado o usuario sin perfil persistente, **When** se intenta consultar su perfil, **Then** la aplicacion informa que los invitados no tienen perfil de logros.

### Edge Cases

- Si un jugador registrado no tiene estadisticas aun, el perfil debe mostrar valores en cero sin tratarlo como error.
- Si un logro llega en tiempo real mientras el jugador esta viendo su perfil, la lista debe reflejar el nuevo logro sin duplicarlo.
- Si el jugador pierde la sesion mientras intenta abrir un perfil, debe volver al flujo de autenticacion existente.
- Si el nombre de usuario se escribe con diferente capitalizacion, la busqueda debe seguir el comportamiento vigente del producto y evitar presentar perfiles duplicados.
- Si una partida contra bot finaliza, no debe mostrarse ningun logro desbloqueado por esa partida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir que un jugador registrado consulte su propio perfil de logros y estadisticas.
- **FR-002**: El sistema MUST permitir que un jugador registrado consulte el perfil publico de otro jugador registrado usando su nombre de usuario.
- **FR-003**: El perfil MUST mostrar estadisticas agregadas: partidas jugadas, partidas ganadas, partidas perdidas y porcentaje de victorias.
- **FR-004**: El perfil MUST mostrar los logros desbloqueados con nombre, descripcion, fecha de desbloqueo y contexto de partida disponible.
- **FR-005**: El perfil MUST mostrar un estado vacio claro cuando el jugador no tenga logros desbloqueados.
- **FR-006**: El sistema MUST mostrar un aviso visible cuando un jugador registrado desbloquea un logro durante el uso activo de la aplicacion.
- **FR-007**: El sistema MUST evitar notificaciones y tracking visible de logros para jugadores invitados.
- **FR-008**: El sistema MUST evitar presentar logros como resultado de partidas contra bots.
- **FR-009**: El sistema MUST mantener la identidad visible del jugador registrado despues de iniciar sesion, registrarse, refrescar sesion o recargar la aplicacion.
- **FR-010**: La navegacion principal MUST mostrar el nombre de usuario de jugadores registrados y ofrecer acceso directo al perfil propio.
- **FR-011**: La navegacion principal MUST distinguir invitados de jugadores registrados y no ofrecer perfil de logros a invitados.
- **FR-012**: El sistema MUST mostrar errores comprensibles para perfil no encontrado, sesion no valida o perfil no disponible.
- **FR-013**: El sistema MUST usar textos en español para nombres visibles, mensajes de estado, errores y notificaciones de logros.
- **FR-014**: El sistema MUST representar codigos de logro desconocidos con una etiqueta segura y comprensible, sin romper la pantalla de perfil ni las notificaciones.
- **FR-015**: La informacion de logros y estadisticas MUST respetar que solo las partidas humanas competitivas cuentan para el perfil.

### Key Entities

- **Perfil de jugador**: Vista publica de un jugador registrado. Contiene estadisticas agregadas y logros desbloqueados; se identifica por nombre de usuario.
- **Estadisticas de jugador**: Resumen numerico de actividad competitiva humana: partidas jugadas, ganadas, perdidas y porcentaje de victorias.
- **Logro desbloqueado**: Hito obtenido por un jugador registrado. Contiene codigo de logro, fecha de desbloqueo y contexto de partida cuando existe.
- **Catalogo de logros**: Conjunto de nombres y descripciones visibles que traducen codigos de logro a texto entendible para jugadores.
- **Identidad de sesion**: Datos visibles del jugador autenticado que permiten distinguir usuarios registrados de invitados y abrir el perfil propio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 95% de los jugadores registrados puede abrir su perfil propio desde la navegacion principal en menos de 2 acciones despues de iniciar sesion.
- **SC-002**: El perfil de un jugador existente muestra estadisticas y logros en menos de 2 segundos bajo condiciones normales de uso.
- **SC-003**: El 100% de los perfiles sin logros muestra un estado vacio comprensible en lugar de una pantalla rota o incompleta.
- **SC-004**: El 100% de los avisos de logro desbloqueado muestra nombre del logro, descripcion breve y no interrumpe acciones criticas de la partida.
- **SC-005**: El 100% de las sesiones invitadas quedan excluidas del acceso a perfil de logros propio.
- **SC-006**: En pruebas de aceptacion, las partidas contra bots no producen logros visibles ni avisos de desbloqueo.

## Assumptions

- Los logros son una capacidad para usuarios registrados; invitados pueden jugar pero no acumulan ni consultan perfil de logros.
- El perfil publico de un jugador registrado puede ser consultado por otros jugadores registrados.
- El producto usara un catalogo visible de logros para mostrar nombres y descripciones a partir de codigos de logro.
- Las estadisticas pueden tener una leve demora luego de finalizar una partida, por consistencia eventual del sistema existente.
- El MVP no incluye busqueda global de jugadores; acceder a perfiles ajenos requiere conocer o recibir el nombre de usuario.
- Los logros se otorgan por reglas autoritativas del dominio; la experiencia de usuario solo los presenta y notifica.
