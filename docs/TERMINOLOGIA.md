# Terminología del dominio — Truco a 3

> Este documento fija los nombres de los conceptos del juego para evitar confusiones entre frontend, backend y UI.

## Conceptos del juego

| Concepto (español) | Backend event | Frontend / Código | Significado |
|---|---|---|---|
| **Serie** | — | `match` | Conjunto de partidas individuales. Puede ser "mejor de 1", "mejor de 3" o "mejor de 5". Se gana la serie ganando la mayoría de las partidas individuales. |
| **Partida individual** | `GAME_SCORE_CHANGED` | `game` | Una sola partida de truco que se juega hasta **3 puntos exactos**. Si te pasás de 3, perdés. Es lo que antes se confundía con "ronda". |
| **Mano / Repartida** | `ROUND_STARTED` / `ROUND_ENDED` | `round` | Una sola repartida de cartas dentro de una partida individual. Contiene hasta 3 bazas. Termina cuando un jugador llega a 2 bazas o se resuelve el truco/envido. |
| **Baza** | `HAND_RESOLVED` | `hand` / `playedHand` | Una jugada de una carta de cada jugador dentro de una mano. |
| **Cartas del jugador** | `HAND_DEALT` | `myCards` | Las 3 cartas repartidas al jugador local al inicio de una mano. |

## Reglas clave que afectan al producto

- **Una partida individual se gana llegando a exactamente 3 puntos**. Pasarse de 3 implica perder inmediatamente.
- **Las series** son "mejor de 1, 3 o 5". El default es **mejor de 3**.
- El modal que muestra el progreso de la serie (`GameWonDialogComponent`) debe abrirse cuando cambia `GAME_SCORE_CHANGED`, **no** en `ROUND_ENDED`.
  - `ROUND_ENDED` solo indica que terminó una mano/repartida. El score de la serie (`gamesWonPlayerOne/Two`) todavía no cambió.
  - `GAME_SCORE_CHANGED` indica que alguien ganó (o perdió por pasarse) una partida individual, por lo tanto el marcador de la serie avanza.

## Anti-patrones a evitar

| ❌ Evitar | ✅ Usar |
|---|---|
| Llamar "ronda" a una partida individual | Llamarla **partida** o **game** |
| Llamar "mano" a una baza | Llamarla **baza**; **mano** es la repartida completa |
| Abrir modal de progreso de serie en `ROUND_ENDED` | Abrirlo en `GAME_SCORE_CHANGED` |
| `RoundWonDialog` para progreso de serie | `GameWonDialog` |

## Eventos WebSocket — resumen

| Evento | ¿Cuándo llega? | ¿Abre modal? |
|---|---|---|
| `ROUND_STARTED` | Empieza una nueva mano/repartida | No |
| `ROUND_ENDED` | Terminó la mano actual | No |
| `HAND_DEALT` | Se repartieron cartas al jugador | No |
| `HAND_RESOLVED` | Terminó una baza | No |
| `GAME_STARTED` | Empieza una nueva partida individual | No |
| `GAME_SCORE_CHANGED` | Cambió el marcador de la serie | Sí (`GameWonDialog`) |
| `MATCH_FINISHED` | Terminó la serie completa | Sí (`GameWonDialog` con `matchFinished=true`) |
| `ENVIDO_RESOLVED` | Se resolvió un envido | Sí (`EnvidoResultDialog`) |

## Ubicaciones de código relevantes

- `src/app/features/match/models/match-ws-events.ts` — definición de eventos y payloads del contrato WebSocket.
- `src/app/features/match/services/match-state.service.ts` — emite `gameWon$` cuando detecta `GAME_SCORE_CHANGED`.
- `src/app/features/match/components/game-won-dialog/` — modal de progreso de serie / fin de serie.
- `src/app/features/match/reducers/match-event.reducer.ts` — reducer de estado; `ROUND_ENDED` actualiza `roundGame.status = 'FINISHED'` pero no toca el score de la serie.
