# Data Model: Visualización de cantos del rival

**Feature**: 009-rival-call-display  
**Date**: 2026-05-26

---

## Entidades

### 1. `CallDisplayEvent` (UI transient state)

Representa la información mínima necesaria para renderizar un canto o respuesta en el panel.

```typescript
interface CallDisplayEvent {
  /** Asiento del jugador que realizó la acción */
  seat: Seat; // 'PLAYER_ONE' | 'PLAYER_TWO'

  /** Texto legible en español para mostrar en el panel */
  text: string;

  /** Indica si es una respuesta de aceptación (activa auto-limpieza a 3 s) */
  isAcceptance: boolean;
}
```

**Reglas de validación**:
- `text` no puede estar vacío después del mapeo.
- Solo eventos de tipo `TRUCO_CALLED`, `TRUCO_RESPONDED`, `ENVIDO_CALLED`, `ENVIDO_RESOLVED` y `FOLDED` producen un `CallDisplayEvent` válido; todo otro `MatchWsEvent` devuelve `null` del mapper.

---

### 2. `PlayerCallTexts` (signals en MatchScreenComponent)

Par de señales que mantienen el texto visible para cada jugador en un momento dado.

```typescript
interface PlayerCallTexts {
  self: string | null;
  opponent: string | null;
}
```

**Ciclo de vida**:
1. Inicializan en `null` al entrar a la pantalla de partida.
2. Se actualizan cuando `matchEvent$` emite un evento mapeable.
3. Se limpian a `null` en las siguientes condiciones:
   - Llega `ROUND_STARTED`
   - Llega `GAME_STARTED`
   - Llega `MATCH_FINISHED`, `MATCH_ABANDONED`, `MATCH_FORFEITED`
   - Un timer de 3 s se dispara sobre un texto con `isAcceptance: true`
4. Se destruyen implícitamente al destruirse `MatchScreenComponent`.

---

### 3. `CallDisplayTimerState` (interno del componente)

Tracking de timers pendientes para cancelación anticipada.

```typescript
type CallDisplayTimerState = Map<Seat, number>;
// key: Seat, value: timeoutId de setTimeout
```

**Invariantes**:
- Como máximo un timer activo por `Seat` en cualquier momento.
- Al llegar un nuevo evento para un `Seat`, el timer previo (si existe) se cancela con `clearTimeout`.
- Al destruir el componente, todos los timers del mapa se cancelan.

---

## Relaciones

```
MatchWsEvent ──► callDisplayMapper() ──► CallDisplayEvent │ null
                                    │
                                    ▼
                    MatchScreenComponent (signals)
                                    │
                                    ├─► PlayerCallTexts.self
                                    └─► PlayerCallTexts.opponent
                                    │
                                    ▼
                    MatchStatusPanelComponent (inputs)
                                    │
                                    ▼
                              Template HTML
```

---

## Mapeo de eventos a texto

Fuente de verdad: `docs/CONTRATOS_API.md §9.4–9.6` para payloads WS.

| EventType | Campo del payload | Valor | Texto generado | isAcceptance |
|-----------|-------------------|-------|----------------|--------------|
| `TRUCO_CALLED` | `call` | `TRUCO` | "¡Truco!" | false |
| `TRUCO_CALLED` | `call` | `RETRUCO` | "¡Retruco!" | false |
| `TRUCO_CALLED` | `call` | `VALE_CUATRO` | "¡Vale cuatro!" | false |
| `TRUCO_RESPONDED` | `response` | `QUIERO` | "¡Quiero!" | true |
| `TRUCO_RESPONDED` | `response` | `NO_QUIERO` | "¡No quiero!" | false |
| `TRUCO_RESPONDED` | `response` | `QUIERO_Y_ME_VOY_AL_MAZO` | "¡Quiero y me voy al mazo!" | false |
| `ENVIDO_CALLED` | `call` | `ENVIDO` | "¡Envido!" | false |
| `ENVIDO_CALLED` | `call` | `REAL_ENVIDO` | "¡Real envido!" | false |
| `ENVIDO_CALLED` | `call` | `FALTA_ENVIDO` | "¡Falta envido!" | false |
| `ENVIDO_RESOLVED` | `response` | `QUIERO` | "¡Quiero!" | true |
| `ENVIDO_RESOLVED` | `response` | `NO_QUIERO` | "¡No quiero!" | false |
| `FOLDED` | — | — | "Me voy al mazo" | false |

**Notas**:
- `callerSeat` / `responderSeat` / `seat` del payload determina el `Seat` del `CallDisplayEvent`.
- No se mapean `HAND_RESOLVED`, `SCORE_CHANGED`, `TURN_CHANGED`, etc.; estos eventos no tienen representación textual de canto.
