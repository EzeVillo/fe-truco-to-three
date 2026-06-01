# Contrato interno: audios de cantos visibles

Este contrato no modifica `docs/CONTRATOS_API.md`. Define la paridad esperada entre eventos de partida ya documentados, mensajes visibles y archivos locales de audio.

## Fuente de eventos

Los eventos provienen de `/user/queue/match` y se consideran despues de pasar por la cola de eventos de la pantalla de partida. No se reproducen audios desde acciones REST ni desde eventos crudos antes del delay.

## Eventos soportados

| Evento | Payload requerido | Archivo de audio |
|--------|-------------------|------------------|
| `TRUCO_CALLED` | `{ callerSeat, call: "TRUCO" }` | `/audio/calls/truco.mp3` |
| `TRUCO_CALLED` | `{ callerSeat, call: "RETRUCO" }` | `/audio/calls/retruco.mp3` |
| `TRUCO_CALLED` | `{ callerSeat, call: "VALE_CUATRO" }` | `/audio/calls/vale-cuatro.mp3` |
| `ENVIDO_CALLED` | `{ callerSeat, call: "ENVIDO" }` | `/audio/calls/envido.mp3` |
| `ENVIDO_CALLED` | `{ callerSeat, call: "REAL_ENVIDO" }` | `/audio/calls/real-envido.mp3` |
| `ENVIDO_CALLED` | `{ callerSeat, call: "FALTA_ENVIDO" }` | `/audio/calls/falta-envido.mp3` |
| `TRUCO_RESPONDED` | `{ responderSeat, response: "QUIERO" }` | `/audio/calls/quiero.mp3` |
| `TRUCO_RESPONDED` | `{ responderSeat, response: "NO_QUIERO" }` | `/audio/calls/no-quiero.mp3` |
| `TRUCO_RESPONDED` | `{ responderSeat, response: "QUIERO_Y_ME_VOY_AL_MAZO" }` | `/audio/calls/quiero-y-me-voy-al-mazo.mp3` |
| `ENVIDO_RESOLVED` | `{ response: "QUIERO", winnerSeat, pointsMano?, pointsPie? }` | `/audio/calls/quiero.mp3` |
| `ENVIDO_RESOLVED` | `{ response: "NO_QUIERO", winnerSeat }` | `/audio/calls/no-quiero.mp3` |
| `FOLDED` | `{ seat }` | `/audio/calls/me-voy-al-mazo.mp3` |

## Reglas de reproduccion

- El audio inicia cuando el mensaje visible se setea en pantalla.
- Cada reproduccion reinicia el audio desde el comienzo.
- Si `play()` falla o el archivo no esta disponible, la pantalla no muestra error y la partida sigue.
- Eventos con valores desconocidos no reproducen audio.
- El audio no cambia estado de partida, acciones disponibles, puntajes ni turnos.

## Paridad de assets

La implementacion debe verificar que todos estos archivos existan:

```text
public/audio/calls/envido.mp3
public/audio/calls/falta-envido.mp3
public/audio/calls/me-voy-al-mazo.mp3
public/audio/calls/no-quiero.mp3
public/audio/calls/quiero.mp3
public/audio/calls/quiero-y-me-voy-al-mazo.mp3
public/audio/calls/real-envido.mp3
public/audio/calls/retruco.mp3
public/audio/calls/truco.mp3
public/audio/calls/vale-cuatro.mp3
```
