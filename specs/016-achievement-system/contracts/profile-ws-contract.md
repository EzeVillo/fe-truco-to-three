# Contract: Eventos WebSocket de perfil

Fuente autoritativa: `docs/CONTRATOS_API.md` secciones 9.5f y notas FE.

## Canal

`/user/queue/profile`

Disponible para usuarios registrados autenticados. Transporta eventos de logros del perfil.

## ACHIEVEMENT_UNLOCKED

```json
{
  "eventType": "ACHIEVEMENT_UNLOCKED",
  "timestamp": 1772768158123,
  "payload": {
    "achievementCode": "WIN_RETRUCO_FROM_0_0_TO_3",
    "unlockedAt": 1772768158123,
    "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
    "gameNumber": 1
  }
}
```

## Reglas de procesamiento FE

- Suscribirse solo cuando exista sesion registrada.
- No iniciar notificaciones de perfil para invitados.
- Mostrar una notificacion visible por logro desbloqueado.
- Deduplicar eventos repetidos por codigo de logro en una misma sesion de cliente.
- Si el perfil propio esta abierto, reflejar el logro nuevo sin duplicarlo.
- Si el codigo de logro no existe en el catalogo visible, usar copy fallback.
- No inferir logros localmente desde eventos de match; el evento de perfil es la fuente de desbloqueo en tiempo real.
