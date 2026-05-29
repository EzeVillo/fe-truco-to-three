# Contrato de consumo: Temporizador de turno

**Feature**: 013-turn-timer | **Fecha**: 2026-05-29

Este documento fija qué consume el frontend del backend para el temporizador. Es una proyección de
`docs/CONTRATOS_API.md` (fuente autoritativa). El test `src/tests/contract/action-deadline.contract.spec.ts`
verifica la paridad de los `eventType` y la forma de los payloads contra §9.6.

## 1. Snapshot REST — `GET /api/matches/{matchId}` (§4.14)

Dentro de `roundGame` (sólo cuando `status === 'IN_PROGRESS'`):

```jsonc
{
  "roundGame": {
    // ...campos existentes...
    "actionDeadline": 1772768188123,   // epochMillis absoluto | null
    "turnDurationMillis": 30000,        // long | null
    "actionDeadlineSeat": "PLAYER_ONE"  // "PLAYER_ONE" | "PLAYER_TWO" | null
  }
}
```

- Los tres campos van juntos: o los tres con valor, o los tres `null`.
- En reconexión/carga inicial son la base para arrancar el indicador en el tiempo restante correcto
  (FR-009).
- (Spectate §4.15 expone los mismos campos en `currentRound`, pero la vista de espectador está
  **fuera de alcance** de esta feature.)

## 2. Eventos WebSocket — `/user/queue/match` (§9.5 / §9.6)

Derivados del temporizador (NO avanzan `stateVersion`; llega `null`):

### `ACTION_DEADLINE_SET`

```jsonc
{
  "matchId": "…",
  "eventType": "ACTION_DEADLINE_SET",
  "timestamp": 1772768158123,          // epochMillis del servidor (now)
  "stateVersion": null,
  "payload": {
    "seat": "PLAYER_ONE",              // asiento que debe actuar
    "actionDeadline": 1772768188123,   // epochMillis absoluto
    "turnDurationMillis": 30000         // plazo total
  }
}
```

### `ACTION_DEADLINE_CLEARED`

```jsonc
{
  "matchId": "…",
  "eventType": "ACTION_DEADLINE_CLEARED",
  "timestamp": 1772768190000,
  "stateVersion": null,
  "payload": {}
}
```

## 3. Reglas de consumo (frontend)

1. **Ruteo**: ambos eventos se procesan por el camino de eventos **derivados**; NO deben pasar por la
   reconciliación por `stateVersion` ni por la detección de huecos.
2. **Cálculo del restante (en vivo)**: `remainingMs = payload.actionDeadline - event.timestamp`,
   luego countdown local por deltas (independiente del reloj del dispositivo).
3. **Cálculo del restante (snapshot)**: `remainingMs = actionDeadline - (Date.now() + serverClockOffsetMs)`,
   donde `serverClockOffsetMs` se deriva del `timestamp` del último evento WS (o 0 si no hubo).
4. **Reinicio**: cada `ACTION_DEADLINE_SET` reemplaza el plazo vigente.
5. **Limpieza**: `ACTION_DEADLINE_CLEARED`, `roundGame === null`, o fin/cancelación de partida ocultan
   el indicador.
6. **El backend es el árbitro**: al llegar a 0, el cliente deshabilita los controles del viewer y
   muestra "tiempo agotado", pero NO declara la derrota; espera `MATCH_FORFEITED` u otro evento.

## 4. Mapeo a Functional Requirements

| Regla / campo | FR |
|---|---|
| Mostrar indicador cuando hay plazo activo | FR-001, FR-002 |
| Restante derivado del backend (no fijo) | FR-003 |
| Reinicio en cambio de asiento (`SET`) | FR-004 |
| Limpieza (`CLEARED` / sin ronda) | FR-005, FR-012 |
| Urgencia ≤ 5 s | FR-006 |
| No declarar derrota en cliente | FR-007 |
| Deshabilitar controles + "tiempo agotado" a 0 | FR-008 |
| Tiempo correcto en reconexión (snapshot) | FR-009 |
| Robustez a desfase de reloj (offset/`timestamp`) | FR-010 |
