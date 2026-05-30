# Contrato de consumo: Revancha (Rematch)

**Feature**: 014-rematch-on-match-end | **Fecha**: 2026-05-29

Proyección de `docs/CONTRATOS_API.md` (fuente autoritativa) de lo que consume el frontend para la
revancha. El test `src/tests/contract/rematch.contract.spec.ts` verifica la paridad de `eventType`,
forma de payloads y presencia de endpoints contra §4.17 / §9.6.

## 1. REST (§4.17)

### Aceptar revancha — `POST /api/matches/{matchId}/rematch/choose` (§4.17.1)
- `matchId` = partida **original** (terminada). Sin body. Respuesta `204`.
- Errores: `401`, `404` (no existe sesión), `422` (sesión no `OPEN` / expirada / no participante).

### Abandonar revancha — `POST /api/matches/{matchId}/rematch/leave` (§4.17.2)
- Sin body. Respuesta `204`. El bot no puede ser actor.
- Errores: `401`, `404`, `422` (sesión no `OPEN` / no participante / bot intenta abandonar).

### Consultar sesión — `GET /api/matches/{matchId}/rematch` (§4.17.3)
```jsonc
{
  "sessionId": "550e8400-…0000",
  "originMatchId": "550e8400-…0001",
  "status": "OPEN",                 // OPEN | CONFIRMED | CLOSED_BY_LEAVE | EXPIRED
  "playerOneChoice": "UNDECIDED",   // UNDECIDED | WANTS_REMATCH | LEFT
  "playerTwoChoice": "WANTS_REMATCH",
  "expiresAt": "2026-05-16T18:00:00Z", // ISO-8601 (REST)  ⚠ distinto del WS (epochMillis)
  "resultMatchId": null              // UUID solo si status === 'CONFIRMED'
}
```
- Solo participantes. `404` si no hay sesión para ese `matchId` → **no se ofrece revancha**.

## 2. Eventos WebSocket — `/user/queue/match` (§9.5 / §9.6)

`matchId` top-level = `originMatchId` (la partida terminada). Se rutean por un **canal dedicado**
(no por la cola ack-gated ni por la reconciliación por `stateVersion`; ver research D1).

```jsonc
// REMATCH_AVAILABLE  (a jugador 1 y jugador 2 si NO es bot)
{ "eventType": "REMATCH_AVAILABLE",
  "payload": { "sessionId": "…", "originMatchId": "…", "expiresAt": 1775304600000 } } // epochMillis

// REMATCH_OPPONENT_WANTS  (al otro jugador)
{ "eventType": "REMATCH_OPPONENT_WANTS",
  "payload": { "sessionId": "…", "originMatchId": "…", "actor": "juancho" } }

// REMATCH_CONFIRMED  (a ambos; nueva partida ya IN_PROGRESS)
{ "eventType": "REMATCH_CONFIRMED",
  "payload": { "sessionId": "…", "originMatchId": "…",
               "newMatchId": "…", "newPlayerOne": "juancho", "newPlayerTwo": "martina" } }

// REMATCH_CLOSED_BY_LEAVE  (al otro jugador)
{ "eventType": "REMATCH_CLOSED_BY_LEAVE",
  "payload": { "sessionId": "…", "originMatchId": "…", "actor": "martina" } }

// REMATCH_EXPIRED  (a ambos)
{ "eventType": "REMATCH_EXPIRED",
  "payload": { "sessionId": "…", "originMatchId": "…" } }
```

## 3. Reglas de consumo (frontend)

1. **Event-driven puro**: la disponibilidad de revancha se conoce por `REMATCH_AVAILABLE` (o al
   reconciliar con el snapshot). El FE **no** chequea tipo de match ni aplica reglas de negocio
   (FR-001/FR-002).
1b. **Secuencia de UI**: la oferta se muestra **después** de que el jugador cierra el modal de
   resultado, nunca simultánea (FR-001a). Aunque `REMATCH_AVAILABLE` haya llegado antes (con el
   contador corriendo), la *aparición* de la oferta queda supeditada al cierre del modal; el
   countdown muestra el **restante real**.
2. **Sin lógica de bot**: no se asume aceptación del rival; si no llegan `REMATCH_OPPONENT_WANTS` /
   `REMATCH_CONFIRMED`, esos estados no se muestran (FR-012).
3. **Rechazo = abandono**: `REMATCH_CLOSED_BY_LEAVE` cubre ambos; un único estado de cierre por
   decisión del rival (FR-006).
4. **Ruteo**: los 5 eventos se entregan por `rematch$`, fuera de la cola y de `stateVersion`.
5. **`expiresAt`**: normalizar a epochMillis (WS ya viene así; REST viene ISO-8601 → `Date.parse`).
6. **Confirmación**: en `REMATCH_CONFIRMED`, navegar a `/match/{newMatchId}` (ya `IN_PROGRESS`,
   sin `POST /start`).
7. **El backend es el árbitro de la expiración**: el countdown es informativo; el cierre lo marca
   `REMATCH_EXPIRED` / el `status` del snapshot.
8. **Errores**: mapear con `getErrorCopy('REMATCH', error)`; nunca mostrar `ApiError.message`.

## 4. Mapeo a Functional Requirements

| Regla / dato | FR |
|---|---|
| Conocer disponibilidad por `REMATCH_AVAILABLE` | FR-001 |
| Mostrar la oferta tras cerrar el modal de resultado (no simultánea) | FR-001a |
| No aplicar reglas de negocio (sin chequeo liga/copa) | FR-002 |
| Aceptar (`choose`) / Salir (`leave`) | FR-003, FR-004 |
| Reflejar `REMATCH_OPPONENT_WANTS` | FR-005 |
| Reflejar `REMATCH_CLOSED_BY_LEAVE` (rechazo/abandono) | FR-006 |
| `REMATCH_CONFIRMED` → nueva partida automática | FR-007, FR-008 |
| Countdown de `expiresAt` + `REMATCH_EXPIRED` | FR-009, FR-010 |
| Snapshot `GET …/rematch` en reconexión/recarga | FR-011 |
| Sin lógica de bot | FR-012 |
| Copy de errores del catálogo | FR-013 |
