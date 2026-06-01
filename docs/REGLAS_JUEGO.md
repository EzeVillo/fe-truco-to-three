# Reglas del Truco a 3 puntos

Esta es la variante de Truco Argentino implementada por el backend. La regla fundamental que
la diferencia del truco tradicional es que **cada game se gana llegando exactamente a `3`
puntos**; si un jugador se pasa de `3`, pierde ese game.

Un `match` se resuelve al mejor de `1`, `3` o `5` games (`gamesToPlay`).

> El presente documento describe únicamente las reglas del juego (mazo, mano, envido, truco,
> scoring del game). La estructura de match, ligas, copas y revancha está descrita en el
> `README.md` y en `docs/CONTRATOS_API.md`.

---

## 1. Mazo

- Mazo español de **40 cartas**: 4 palos (`ESPADA`, `BASTO`, `ORO`, `COPA`) × 10 números
  (`1, 2, 3, 4, 5, 6, 7, 10, 11, 12`).
- Cada `round` se reparten **3 cartas por jugador**.
- El mazo se mezcla al inicio de cada round.

### 1.1 Jerarquía de cartas (de mayor a menor)

| Rank | Carta          |
|------|----------------|
| 14   | 1 de espada    |
| 13   | 1 de basto     |
| 12   | 7 de espada    |
| 11   | 7 de oro       |
| 10   | 3              |
| 9    | 2              |
| 8    | 1 (copa/oro)   |
| 7    | 12             |
| 6    | 11             |
| 5    | 10             |
| 4    | 7 (basto/copa) |
| 3    | 6              |
| 2    | 5              |
| 1    | 4              |

Dos cartas con el mismo rank empardan.

---

## 2. Mano y rondas

- Una `round` se compone de hasta **3 manos** (jugadas de a una carta por jugador).
- En cada mano cada jugador tira una carta. Gana la mano la carta de mayor rank; si empatan, la
  mano queda **parda**.
- Resolución del ganador de la round:
    - El primer jugador que **gana 2 manos** se lleva la round.
    - Si hay **una mano parda** y otra ganada, gana quien ganó la mano no parda.
    - Si las **tres manos** son pardas o el resultado queda indefinido, gana el jugador **mano**.
- El jugador `mano` es quien tira primero en la primera mano. En las manos siguientes empieza el
  ganador de la mano anterior (si fue parda, sigue el mismo orden previo).
- Tras cada round, el rol de `mano` **se alterna** entre los jugadores para la próxima round.

### 2.1 Cierre automático por ancho de espada

El **1 de espada** (ancho de espada) cierra la round inmediatamente al ser jugado en los
siguientes casos:

- La primera mano fue **parda** y el ancho se juega en la segunda mano.
- El portador del ancho **ganó la primera mano** y juega el ancho en la segunda mano (queda
  2-0 efectivo).
- Se está jugando la **tercera mano**.

En cualquiera de esos escenarios, ya no se puede cantar truco después del ancho.

---

## 3. Envido

El envido se canta y resuelve **únicamente en la primera mano** de la round.

### 3.1 Tipos de canto

| Canto          | Puntos si se quiere                            | Puntos si no se quiere |
|----------------|------------------------------------------------|------------------------|
| `ENVIDO`       | 2                                              | 1                      |
| `REAL_ENVIDO`  | 3                                              | 1                      |
| `FALTA_ENVIDO` | *los que le falten al rival para llegar a `3`* | 1                      |

### 3.2 Cuándo se puede cantar

- Solo durante la **primera mano** de la round.
- **Antes** de que el jugador haya tirado su primera carta (si ya tiró, no puede cantar).
- No se puede cantar si el envido ya fue **resuelto** en esta round.
- No se puede cantar después de **aceptar el truco** (sí se puede mientras la respuesta al truco
  está pendiente, pero solo cuando el truco vigente es `TRUCO` — no sobre `RETRUCO` ni
  `VALE_CUATRO`).

### 3.3 Cadena y escaladas permitidas

- Sobre `ENVIDO` se puede subir con `ENVIDO` (a lo sumo **dos** envidos en la cadena),
  `REAL_ENVIDO` o `FALTA_ENVIDO`.
- Sobre `REAL_ENVIDO` solo se puede subir con `FALTA_ENVIDO`.
- `FALTA_ENVIDO` no admite escalada posterior.

### 3.4 Cálculo de tantos del jugador

- Si el jugador tiene **dos o más cartas del mismo palo**, sus tantos son
  `20 + suma de los dos valores más altos de ese palo`.
- Si las tres cartas son de palos distintos, los tantos son **el valor de la carta más alta**.
- Valor de cada carta para envido:
    - `1`..`7` → su número.
    - `10`, `11`, `12` (figuras) → `0`.

### 3.5 No se puede mentir

Cuando se cantan los tantos, el sistema usa los tantos reales del jugador. **No existe la
posibilidad de engañar al rival declarando un número falso.**

### 3.6 Puntos al resolver

- **Quiero**: gana el jugador con más tantos. Si empata, gana el **mano**. Los puntos otorgados
  son la suma de los cantos de la cadena (con la regla especial de `FALTA_ENVIDO`, que da los
  puntos que le faltan al rival para llegar a `3`).
- **No quiero**: el que cantó último gana los puntos definidos en la columna *no quiero* de la
  cadena (todos los cantos previos al último).

---

## 4. Truco

### 4.1 Tipos de canto y puntaje

| Canto         | Puntos si se quiere | Puntos si no se quiere |
|---------------|---------------------|------------------------|
| `TRUCO`       | 2                   | 1                      |
| `RETRUCO`     | 3                   | 2                      |
| `VALE_CUATRO` | 4                   | 3                      |

### 4.2 Reglas de escalada

- La cadena del truco solo avanza en orden: `TRUCO → RETRUCO → VALE_CUATRO`.
- **Solo puede subir el rival del que cantó último**. No se puede re-cantar contra uno mismo.
- `VALE_CUATRO` no tiene escalada posterior.

### 4.3 Respuestas posibles

Al cantarse el truco, el rival puede:

- **Quiero**: la round vale los puntos del canto vigente.
- **No quiero**: el que cantó se lleva los puntos del nivel anterior y la round termina.
- **Quiero y me voy al mazo**: los puntos del nivel **vigente** se otorgan al rival y la round
  termina. Si al sumarse el jugador supera los `3` puntos del game, **pierde ese game**.
    - Esta opción **no está disponible si el jugador no tiene cartas en la mano**.

### 4.4 Combinación con envido

- En una primera mano con truco cantado en `TRUCO`, el rival puede responder cantando envido
  antes de resolver el truco. En ese caso, el envido se resuelve primero y luego se vuelve a la
  decisión del truco.
- A partir de `RETRUCO` o si el truco ya fue aceptado, **el envido ya no puede cantarse**.

---

## 5. Irse al mazo (`fold`)

Distinto de *“quiero y me voy al mazo”* dentro de la respuesta al truco, el `fold` permite
abandonar la round entregando los puntos en juego al rival.

### 5.1 Restricción del jugador mano

El jugador `mano` **no puede irse al mazo en la primera mano** salvo que se cumpla al menos una
de las siguientes condiciones:

- El **envido ya fue resuelto**, o
- El **truco ya fue cantado**.

Esto evita que el mano "tire" la round sin oportunidad de juego para el rival cuando aún no se
canta nada.

El jugador que **no es mano** puede irse al mazo en cualquier momento.

---

## 6. Scoring del game

- Un game se gana al **acumular exactamente `3` puntos**.
- Si un jugador, al sumar los puntos de una round, **supera `3`**, ese game lo gana el rival
  (regla central de esta modalidad).
- Tras finalizar un game se reinicia el score interno y comienza un nuevo game dentro del
  match hasta que alguno de los jugadores alcance `gamesToWin`.

### 6.1 Orden de aplicación de puntos en una round

1. Puntos de envido (si hubo envido resuelto).
2. Puntos de truco (si hubo truco cantado y aceptado, o rechazado).
3. Si nadie cantó truco y la round se jugó hasta el final, el ganador de la round se lleva
   **1 punto**.

---

## 7. Resumen de quién puede ganar puntos

| Situación                    | Puntos otorgados                     | A quién                            |
|------------------------------|--------------------------------------|------------------------------------|
| Envido aceptado              | Suma de la cadena (o falta envido)   | Ganador por tantos (empate → mano) |
| Envido no querido            | Suma de cantos previos al último     | Quien cantó último                 |
| Truco aceptado, round jugada | Puntos del nivel vigente del truco   | Ganador de la round                |
| Truco no querido             | Puntos *no quiero* del nivel vigente | Quien cantó último                 |
| “Quiero y me voy al mazo”    | Puntos del nivel vigente del truco   | Rival del que se va                |
| Fold sin truco               | `1` punto                            | Rival del que se va                |
| Round jugada sin truco       | `1` punto                            | Ganador de la round                |
