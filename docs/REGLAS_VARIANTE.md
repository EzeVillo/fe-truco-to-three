# Reglas de la variante a 3 puntos

Este documento resume solo las reglas especiales de la variante **Truco a 3 puntos**. No
repite las reglas base del truco argentino: mazo, jerarquía de cartas, estructura de manos,
envido, truco y fold están documentados en `docs/REGLAS_JUEGO.md`.

La regla central de esta modalidad es el **punto exacto**: un game se gana llegando exactamente
a `3` puntos. Si un jugador supera `3`, pierde ese game.

---

## 1. Objetivo del game

- Cada game se gana al acumular exactamente `3` puntos.
- Si un jugador suma puntos y queda por encima de `3`, el game lo gana el rival.
- Al terminar un game, el score interno vuelve a `0-0` y puede comenzar otro game dentro del
  match.

## 2. Formato del match

- Un match se juega al mejor de `1`, `3` o `5` games.
- `gamesToPlay = 1`: partida única.
- `gamesToPlay = 3`: gana el primero que consiga `2` games.
- `gamesToPlay = 5`: gana el primero que consiga `3` games.
- Cuando se necesita un default, el formato esperado es **mejor de 3**.

## 3. Falta envido adaptada a 3 puntos

En esta variante, `FALTA_ENVIDO` no usa el puntaje tradicional largo. Si se quiere, otorga los
puntos que le faltan al rival para llegar exactamente a `3`.

| Canto          | Puntos si se quiere                            | Puntos si no se quiere |
|----------------|------------------------------------------------|------------------------|
| `FALTA_ENVIDO` | Los que le faltan al rival para llegar a `3`   | `1`                    |

Si la resolución de la falta envido hace que un jugador supere `3`, aplica la regla de punto
exacto: ese jugador pierde el game.

## 4. Quiero y me voy al mazo

Cuando hay una respuesta de truco pendiente, el rival puede responder **quiero y me voy al
mazo**:

- Los puntos del nivel vigente del truco se otorgan al rival.
- La round termina inmediatamente.
- Si esos puntos hacen que el rival supere `3`, el rival pierde el game por punto exacto.
- Esta opción no está disponible si el jugador que responde ya no tiene cartas en la mano.

## 5. Cierre automático por ancho de espada

El **1 de espada** cierra el round inmediatamente al ser jugado en cualquiera de estos casos:

- La primera mano fue parda y el ancho se juega en la segunda mano.
- El portador del ancho ganó la primera mano y juega el ancho en la segunda mano.
- Se está jugando la tercera mano.

Después de ese cierre automático ya no se puede cantar truco.

## 6. Restricción especial para irse al mazo

El jugador mano no puede irse al mazo en la primera mano salvo que se cumpla al menos una de
estas condiciones:

- El envido ya fue resuelto.
- El truco ya fue cantado.

El jugador que no es mano puede irse al mazo en cualquier momento.
