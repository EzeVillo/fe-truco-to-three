# Research: Sistema de logros

## Decision: Persistir `username` como parte de la identidad de sesion

**Rationale**: El contrato actualizado declara `username` como dato autoritativo en registro, login, refresh y consulta de identidad actual. El perfil propio necesita un identificador visible estable despues de recargar la aplicacion y no debe depender de decodificar JWT.

**Alternatives considered**:
- Guardar el username ingresado en el formulario: rechazado porque no cubre sesiones antiguas ni cambios autoritativos.
- Decodificar el JWT: rechazado porque el contrato define `sub = playerId`, no username.
- Consultar identidad en cada arranque: valido pero innecesario cuando la sesion persistida ya tiene username.

## Decision: Rehidratar identidad incompleta con la identidad actual

**Rationale**: Puede haber sesiones persistidas antes de que `username` exista en el storage. Si hay access token valido y falta username, el cliente debe recuperar la identidad visible antes de ofrecer el perfil propio.

**Alternatives considered**:
- Forzar logout de sesiones antiguas: rechazado por mala experiencia.
- Mostrar "Jugador" hasta el proximo login: rechazado porque deja incompleto el acceso a perfil.

## Decision: Separar perfil/logros en un bounded context frontend propio

**Rationale**: Perfil, estadisticas y logros tienen reglas y pantallas propias. No son parte del agregado de match en el frontend; match solo puede producir eventos que luego se notifican globalmente.

**Alternatives considered**:
- Agregar logros dentro de `features/match`: rechazado porque el perfil tambien existe fuera de una partida.
- Agregar todo en `core`: rechazado porque la UI de perfil es una feature de producto, no infraestructura compartida.

## Decision: Usar catalogo local para nombres y descripciones de logros

**Rationale**: El contrato de backend entrega `achievementCode`, fecha y contexto, pero no metadata de presentacion. El frontend necesita textos en español y una salida segura para codigos desconocidos.

**Alternatives considered**:
- Mostrar codigos crudos: rechazado por baja calidad de UX.
- Bloquear codigos desconocidos: rechazado porque haria fragil la UI ante nuevos logros.
- Pedir endpoint de metadata: fuera de alcance actual; puede agregarse en una feature futura.

## Decision: Suscripcion global a logros solo para usuarios registrados

**Rationale**: Los logros pueden llegar mientras el usuario esta en cualquier pantalla autenticada. Un servicio global inicializado desde el shell puede conectarse una vez, ignorar invitados y publicar avisos visibles sin acoplarse a match.

**Alternatives considered**:
- Suscribirse solo en pantalla de match: rechazado porque perderia unlocks si el evento llega luego de navegar.
- Suscribirse en la pagina de perfil: rechazado porque los avisos deben aparecer durante el juego.

## Decision: Actualizar perfil abierto al recibir un logro nuevo

**Rationale**: Si el jugador esta mirando su propio perfil, el logro recien desbloqueado debe aparecer sin duplicarse. La fuente autoritativa sigue siendo REST, pero el evento permite feedback inmediato.

**Alternatives considered**:
- Refrescar siempre el perfil completo ante cada evento: aceptable pero mas costoso; se reserva para inconsistencias.
- Ignorar eventos en la pagina de perfil: rechazado por dejar visible un estado stale.

## Decision: Mantener estadisticas como eventual-consistent

**Rationale**: El contrato declara que las estadisticas se actualizan despues del procesamiento de eventos de fin de partida. La UI debe mostrar el snapshot recibido y no prometer actualizacion instantanea exacta.

**Alternatives considered**:
- Calcular stats en frontend desde eventos de match: rechazado porque duplicaria reglas del dominio y podria divergir.

## Decision: Tests de contrato y unitarios enfocados

**Rationale**: La feature toca autenticacion, DTOs, perfil, errores y WebSocket. Se requieren pruebas para paridad con contrato, mapeo de catalogo, persistencia de username, exclusion de invitados y flujo de evento de logro.

**Alternatives considered**:
- Solo tests de componentes: insuficiente para auth y eventos.
- Solo pruebas manuales: insuficiente por el riesgo de regresion en sesion y contratos.
