# Research: Presencia y reconexion de usuario

## Decision 1: Coordinador global iniciado desde App

**Decision**: Implementar un `PresenceCoordinatorService` singleton iniciado desde `App` cuando la
aplicacion arranca, en lugar de enganchar la presencia en paginas especificas.

**Rationale**: La ocupacion puede cambiar mientras el usuario esta en lobby, perfil, reglas o una
segunda pestana ociosa. Un coordinador global evita que cada pagina replique logica y asegura que la
derivacion funcione desde cualquier ruta autenticada.

**Alternatives considered**:
- Hook en `lobby/online`: insuficiente; no cubre perfil/reglas ni sesiones ociosas en otras rutas.
- Guard por ruta: util para arranque en frio, pero no cubre push en tiempo real sin duplicar
  suscripciones.

## Decision 2: Bootstrap pull + push WebSocket

**Decision**: En el arranque autenticado consultar la foto actual de presencia y luego suscribirse a
la cola de presencia para cambios posteriores.

**Rationale**: El stream push es best-effort y solo cubre cambios posteriores a la suscripcion. La
consulta inicial evita perder ocupaciones ya existentes tras refresh o reconexion.

**Alternatives considered**:
- Solo WebSocket: falla si el usuario ya estaba ocupado antes de abrir la app.
- Solo REST al arrancar: no sincroniza multiples pestanas cuando una de ellas cambia la ocupacion.

## Decision 3: Prioridad de destino match > revancha > sin navegacion

**Decision**: Si hay partida no finalizada, navegar a `/match/:matchId`. Si no hay partida y hay
revancha abierta, navegar a `/match/:originMatchId`. Si no hay ocupacion dentro del alcance actual,
no navegar.

**Rationale**: La partida activa es el recurso mas accionable y la pantalla de match ya concentra la
recuperacion de estado y revancha. La revancha se resuelve desde el match de origen. Ligas/copas se
ignoran en esta iteracion por falta de pantallas implementadas.

**Alternatives considered**:
- Navegar a ligas/copas si aparecen en el contrato: rechazado por alcance; hoy generaria rutas
  inexistentes o UX incompleta.
- Mostrar modal global de revancha sin navegar: rechazado porque el flujo existente de revancha esta
  atado al estado de match y al dialogo de `MatchScreenComponent`.

## Decision 4: Idempotencia de navegacion

**Decision**: El coordinador debe calcular una clave de destino y no navegar si ya esta en la misma
ruta o si procesa el mismo destino consecutivo.

**Rationale**: La cola de presencia puede emitir el mismo snapshot a la sesion que origino el cambio.
Sin idempotencia, la app puede reiniciar componentes, perder foco o duplicar navegaciones.

**Alternatives considered**:
- Navegar siempre ante `busy: true`: simple pero ruidoso y propenso a loops.
- Delegar idempotencia solo al Router: insuficiente porque aun puede disparar eventos y efectos
  innecesarios.

## Decision 5: Errores silenciosos por defecto

**Decision**: Si falla la consulta de presencia por red o servidor, no mostrar mensaje global por
defecto; dejar que los flujos existentes sigan mostrando sus errores controlados. El 401 sigue a cargo
del flujo de autenticacion.

**Rationale**: Presencia es una mejora de recuperacion, no una accion explicita del usuario. Un error
global al arrancar puede ser ruido. Los intentos de crear/unirse ya tienen copy controlado si el
usuario esta ocupado.

**Alternatives considered**:
- Snackbar global de error de presencia: rechazado para v1 por ruido y porque no hay accion clara
  distinta a reintentar automaticamente en la proxima apertura/reconexion.
- Mostrar `ApiError.message`: prohibido por los guardarrailes del proyecto.

## Decision 6: Tests de contrato centrados en shape y enums

**Decision**: Agregar contract test que verifique la presencia de `GET /api/me/presence`,
`/user/queue/presence`, `PRESENCE_UPDATED`, campos `busy`, `match`, `league`, `cup`, `rematch`, y
estados reconectables de match documentados.

**Rationale**: La feature depende de un contrato nuevo. El test debe fallar si se elimina o cambia el
shape documentado, incluso si en v1 ignoramos torneos para navegacion.

**Alternatives considered**:
- Tests unitarios solamente: no protegen divergencias entre tipos y documentacion.
- Validar solo campos usados por v1: debilita la paridad del DTO completo y puede esconder cambios
  del backend.
