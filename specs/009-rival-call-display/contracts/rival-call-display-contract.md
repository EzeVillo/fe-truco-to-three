# Contrato: Eventos WebSocket consumidos por rival-call-display

**Feature**: 009-rival-call-display  
**Date**: 2026-05-26

---

## Resumen

Esta feature **no expone nuevos endpoints ni canales WebSocket**. Consume los eventos ya existentes del canal `/user/queue/match` documentados en `docs/CONTRATOS_API.md §9.4–9.6` y tipados en `src/app/features/match/models/match-ws-events.ts`.

El documento a continuación detalla qué eventos se consumen, su payload esperado y cómo se transforman en texto de UI.

---

## Eventos consumidos

### `TRUCO_CALLED`

**Payload esperado** (`TrucoCalledPayload`):
```json
{
  "callerSeat": "PLAYER_ONE" | "PLAYER_TWO",
  "call": "TRUCO" | "RETRUCO" | "VALE_CUATRO"
}
```

**Transformación UI**:
| `call` | Texto |
|--------|-------|
| `TRUCO` | "¡Truco!" |
| `RETRUCO` | "¡Retruco!" |
| `VALE_CUATRO` | "¡Vale cuatro!" |

- `isAcceptance`: `false`
- `seat`: `callerSeat`

---

### `TRUCO_RESPONDED`

**Payload esperado** (`TrucoRespondedPayload`):
```json
{
  "responderSeat": "PLAYER_ONE" | "PLAYER_TWO",
  "response": "QUIERO" | "NO_QUIERO" | "QUIERO_Y_ME_VOY_AL_MAZO",
  "call": "TRUCO" | "RETRUCO" | "VALE_CUATRO"
}
```

**Transformación UI**:
| `response` | Texto |
|----------|-------|
| `QUIERO` | "¡Quiero!" |
| `NO_QUIERO` | "¡No quiero!" |
| `QUIERO_Y_ME_VOY_AL_MAZO` | "¡Quiero y me voy al mazo!" |

- `isAcceptance`: `true` solo para `QUIERO`; `false` para los demás.
- `seat`: `responderSeat`
- Nota: el campo `call` del payload **no** se muestra en el texto; solo se usa para contexto interno del reducer.

---

### `ENVIDO_CALLED`

**Payload esperado** (`EnvidoCalledPayload`):
```json
{
  "callerSeat": "PLAYER_ONE" | "PLAYER_TWO",
  "call": "ENVIDO" | "REAL_ENVIDO" | "FALTA_ENVIDO"
}
```

**Transformación UI**:
| `call` | Texto |
|--------|-------|
| `ENVIDO` | "¡Envido!" |
| `REAL_ENVIDO` | "¡Real envido!" |
| `FALTA_ENVIDO` | "¡Falta envido!" |

- `isAcceptance`: `false`
- `seat`: `callerSeat`

---

### `ENVIDO_RESOLVED`

**Payload esperado** (`EnvidoResolvedPayload`):
```json
{
  "response": "QUIERO" | "NO_QUIERO",
  "winnerSeat": "PLAYER_ONE" | "PLAYER_TWO",
  "pointsMano": <number|null>,
  "pointsPie": <number|null>
}
```

**Transformación UI**:
| `response` | Texto |
|----------|-------|
| `QUIERO` | "¡Quiero!" |
| `NO_QUIERO` | "¡No quiero!" |

- `isAcceptance`: `true` solo para `QUIERO`; `false` para `NO_QUIERO`.
- `seat`: `winnerSeat` **NO** — el texto debe aparecer bajo el jugador que *respondió*, no el ganador. El payload no incluye explícitamente el `responderSeat`. Para esta feature, se asume que el `winnerSeat` no es el indicador correcto del respondedor.

**⚠️ Gap identificado**: `EnvidoResolvedPayload` no contiene `responderSeat`. En el reducer actual, `ENVIDO_RESOLVED` solo cambia `roundStatus` a `PLAYING` y no almacena quién respondió. Para la visualización de texto, si el backend no envía el respondedor, se debe discutir con backend si es posible agregar `responderSeat` al payload, o bien mostrar el texto sin asociación de jugador (centrado). **Para la implementación inicial, se propone mostrar el texto de `ENVIDO_RESOLVED` centrado debajo de la fila de puntajes, sin atribución a un jugador específico, hasta que el contrato incluya `responderSeat`.**

---

### `FOLDED`

**Payload esperado** (`FoldedPayload`):
```json
{
  "seat": "PLAYER_ONE" | "PLAYER_TWO"
}
```

**Transformación UI**:
- Texto: "Me voy al mazo"
- `isAcceptance`: `false`
- `seat`: `seat`

---

## Eventos de reset

Los siguientes eventos limpian **todos** los textos de canto visibles:

| Evento | Motivo |
|--------|--------|
| `ROUND_STARTED` | Nueva ronda, panel limpio |
| `GAME_STARTED` | Nuevo juego dentro de la serie |
| `MATCH_FINISHED` | Partida finalizada |
| `MATCH_ABANDONED` | Partida abandonada |
| `MATCH_FORFEITED` | Partida finalizada por forfeit |

---

## Eventos ignorados

Todo `MatchWsEvent` cuyo `eventType` no esté en la lista de eventos consumidos o de reset devuelve `null` del mapper y no afecta el panel de cantos. Ejemplos:

- `CARD_PLAYED`
- `TURN_CHANGED`
- `SCORE_CHANGED`
- `GAME_SCORE_CHANGED`
- `ROUND_ENDED`
- `HAND_RESOLVED`
- `HAND_DEALT`
- `HAND_CHANGED`
- `SPECTATOR_COUNT_CHANGED`
- `PLAYER_JOINED`
- `PLAYER_READY`
- `MATCH_CANCELLED`
- `MATCH_PLAYER_LEFT`
- `REMATCH_*`

---

## Referencias cruzadas

- Tipos TypeScript: `src/app/features/match/models/match-ws-events.ts`
- Contrato backend autoritativo: `docs/CONTRATOS_API.md §9.4–9.6`
- Enums: `src/app/core/models/enums.ts`
