# Data Model: Sistema de logros

## AuthSession

Representa la sesion autenticada persistida y en memoria.

**Campos**:
- `playerId`: UUID tecnico del jugador autenticado.
- `username`: nombre visible del usuario registrado; `null` para invitados.
- `accessToken`: token Bearer vigente.
- `refreshToken`: token de refresh para usuarios registrados; `null` para invitados.
- `isGuest`: indica si la sesion corresponde a invitado.
- `accessTokenExpiresAt`: instante calculado en memoria para expiracion del access token.

**Reglas de validacion**:
- `username` es obligatorio para usuarios registrados.
- `username` debe ser `null` para invitados.
- `refreshToken` es obligatorio para usuarios registrados y `null` para invitados.
- Sesiones persistidas sin `username` se aceptan como legacy y deben rehidratarse si el access token sigue valido.

## CurrentIdentity

Identidad visible recuperada desde la sesion actual.

**Campos**:
- `playerId`: UUID tecnico.
- `username`: nombre visible para usuarios registrados; `null` para invitados.
- `tokenUse`: `user` o `guest`.

**Reglas de validacion**:
- `tokenUse = user` requiere `username` no nulo.
- `tokenUse = guest` requiere `username = null`.

## PlayerProfile

Vista publica del perfil de un jugador registrado.

**Campos**:
- `stats`: estadisticas agregadas del jugador.
- `achievements`: logros desbloqueados del jugador.

**Reglas de validacion**:
- No expone `playerId`.
- No repite `username`; el recurso se identifica por la ruta o contexto de navegacion.
- Si no hay actividad, las estadisticas se muestran en cero.
- Si no hay logros, `achievements` puede ser arreglo vacio.

## PlayerStats

Resumen competitivo humano del jugador.

**Campos**:
- `matchesPlayed`: cantidad de partidas humanas computadas.
- `matchesWon`: cantidad de partidas humanas ganadas.
- `matchesLost`: cantidad de partidas humanas perdidas.
- `winRate`: porcentaje entero de victorias.

**Reglas de validacion**:
- Todos los campos son numeros no negativos.
- `matchesWon + matchesLost` no debe exceder `matchesPlayed`.
- `winRate` se muestra tal como llega del contrato.
- Bots no aportan a estas estadisticas visibles.

## UnlockedAchievement

Logro ya desbloqueado por un jugador registrado.

**Campos**:
- `achievementCode`: codigo estable del logro.
- `unlockedAt`: epoch millis del desbloqueo.
- `matchId`: UUID de la partida asociada, si el contrato lo provee.
- `gameNumber`: numero de game dentro de la serie, si el contrato lo provee.

**Reglas de validacion**:
- La clave de deduplicacion principal es `achievementCode`; si en el futuro hay logros repetibles, se debe revisar esta regla.
- `unlockedAt` debe renderizarse como fecha/hora legible en español.
- Codigos desconocidos se muestran con copy fallback, no como error.

## AchievementDefinition

Metadata visible para un codigo de logro.

**Campos**:
- `code`: codigo de logro.
- `name`: nombre visible en español.
- `description`: descripcion breve en español.

**Reglas de validacion**:
- Todo codigo conocido debe tener nombre y descripcion.
- Codigos no registrados usan una definicion fallback.

## ProfileWsEvent

Evento de perfil recibido en tiempo real para el usuario autenticado.

**Campos**:
- `eventType`: `ACHIEVEMENT_UNLOCKED`.
- `timestamp`: epoch millis del evento.
- `payload`: `UnlockedAchievement`.

**Reglas de validacion**:
- Solo se procesa para sesiones registradas.
- Invitados deben ignorar o no iniciar este flujo.
- Eventos duplicados no deben duplicar avisos ni items del perfil abierto.

## State Transitions

```text
Sesion anonima -> usuario registrado autenticado -> identidad visible disponible -> perfil propio habilitado
Sesion registrada legacy -> identidad visible faltante -> rehidratacion exitosa -> perfil propio habilitado
Sesion invitada -> identidad visible invitado -> perfil propio deshabilitado
Logro no desbloqueado -> ACHIEVEMENT_UNLOCKED -> logro notificado -> logro visible en perfil
```
