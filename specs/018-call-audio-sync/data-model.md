# Data Model: Audio sincronizado de cantos

## Entidades y objetos de valor

### Canto audible

Representa un canto o respuesta que ya aparece como mensaje visual en la partida y puede reproducir un audio asociado.

**Campos**:
- `eventType`: tipo de evento de partida que origina el mensaje visible.
- `payloadValue`: valor puntual del payload que distingue el canto cuando aplica.
- `displayText`: texto visible esperado para el jugador.
- `audioKey`: clave canonica del audio.
- `assetPath`: ruta del archivo en `public/audio/calls/`.

**Reglas**:
- Solo se considera audible cuando el mensaje visual se va a mostrar.
- No se reproduce audio para eventos descartados, desconocidos o sin texto visible.
- La clave de audio debe mapear a uno de los archivos existentes en `public/audio/calls/`.

### Grabacion de canto

Archivo local provisto por el propietario del juego.

**Campos**:
- `fileName`: nombre del archivo `.mp3`.
- `path`: ruta publica desde la aplicacion.
- `replaces`: canto audible que representa.

**Reglas**:
- Debe poder reemplazarse por otro archivo con el mismo nombre sin tocar reglas de partida.
- Si falta o falla, no bloquea el mensaje ni las acciones del usuario.

### Evento visible de partida

Momento en que un evento de partida ya fue aplicado por la cola y se muestra al jugador.

**Campos**:
- `matchEvent`: evento de partida aplicado.
- `seat`: asiento del jugador que canta o responde.
- `isSelf`: indica si el mensaje aparece del lado propio o rival.
- `visibleAt`: instante de aplicacion luego del delay correspondiente.

**Reglas**:
- El audio inicia en `visibleAt`, junto con el cambio de mensaje.
- `ENVIDO_RESOLVED` no trae `responderSeat`; se mantiene la regla existente de inferirlo desde el ultimo `ENVIDO_CALLED`.
- La navegacion fuera de la partida debe impedir reproducciones futuras pendientes de esa pantalla.

## Mapeo inicial de audios

| Evento | Valor | Texto visible | Archivo |
|--------|-------|---------------|---------|
| `TRUCO_CALLED` | `TRUCO` | `¡Truco!` | `truco.mp3` |
| `TRUCO_CALLED` | `RETRUCO` | `¡Retruco!` | `retruco.mp3` |
| `TRUCO_CALLED` | `VALE_CUATRO` | `¡Vale cuatro!` | `vale-cuatro.mp3` |
| `ENVIDO_CALLED` | `ENVIDO` | `¡Envido!` | `envido.mp3` |
| `ENVIDO_CALLED` | `REAL_ENVIDO` | `¡Real envido!` | `real-envido.mp3` |
| `ENVIDO_CALLED` | `FALTA_ENVIDO` | `¡Falta envido!` | `falta-envido.mp3` |
| `TRUCO_RESPONDED` | `QUIERO` | `¡Quiero!` | `quiero.mp3` |
| `TRUCO_RESPONDED` | `NO_QUIERO` | `¡No quiero!` | `no-quiero.mp3` |
| `TRUCO_RESPONDED` | `QUIERO_Y_ME_VOY_AL_MAZO` | `¡Quiero y me voy al mazo!` | `quiero-y-me-voy-al-mazo.mp3` |
| `ENVIDO_RESOLVED` | `QUIERO` | `¡Quiero!` | `quiero.mp3` |
| `ENVIDO_RESOLVED` | `NO_QUIERO` | `¡No quiero!` | `no-quiero.mp3` |
| `FOLDED` | `seat` | `Me voy al mazo` | `me-voy-al-mazo.mp3` |

## Transiciones relevantes

1. Evento WebSocket transicional llega al estado de partida.
2. `MatchEventQueueService` aplica delay si corresponde.
3. La pantalla recibe el evento aplicado por `matchEvent$`.
4. La pantalla calcula y setea el mensaje visible.
5. En el mismo paso, se pide reproducir el audio correspondiente.
6. Si el audio falla, se ignora el fallo y el flujo visual continua.
