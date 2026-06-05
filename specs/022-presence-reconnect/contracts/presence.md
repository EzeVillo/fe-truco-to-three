# Contrato FE: Presencia y reconexion de usuario

Fuente autoritativa: `docs/CONTRATOS_API.md` seccion 7.6 y lista de suscripciones STOMP.

## REST: obtener presencia

`GET /api/me/presence`

### Request

- Requiere usuario autenticado.
- No recibe `userId`; opera sobre el token actual.
- No modifica recursos ni reinicia temporizadores.

### Response 200

```json
{
  "busy": true,
  "match": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "IN_PROGRESS"
  },
  "league": null,
  "cup": null,
  "rematch": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "originMatchId": "550e8400-e29b-41d4-a716-446655440003"
  }
}
```

### Response 200 sin ocupacion

```json
{
  "busy": false,
  "match": null,
  "league": null,
  "cup": null,
  "rematch": null
}
```

### Errores

- `401`: token ausente o invalido. El flujo de autenticacion/interceptor existente decide la salida.

## WebSocket: presencia en tiempo real

Destino STOMP:

```text
/user/queue/presence
```

Mensaje:

```json
{
  "eventType": "PRESENCE_UPDATED",
  "timestamp": 1717612800000,
  "payload": {
    "busy": true,
    "match": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "IN_PROGRESS"
    },
    "league": null,
    "cup": null,
    "rematch": null
  }
}
```

## Reglas de consumo FE

- Consultar REST en arranque autenticado.
- Suscribirse al destino STOMP para cambios posteriores.
- Derivar destino con prioridad:
  1. `match.id` -> `/match/:id`
  2. `rematch.originMatchId` -> `/match/:originMatchId`
  3. sin destino -> no navegar
- Ignorar `league` y `cup` para navegacion en v1.
- No navegar si la ruta actual ya es el destino.
- No mostrar `message` crudo de errores backend.

## Tests de contrato propuestos

- `presence.contract.spec.ts` verifica que `docs/CONTRATOS_API.md` documente:
  - `GET /api/me/presence`
  - `/user/queue/presence`
  - `PRESENCE_UPDATED`
  - campos `busy`, `match`, `league`, `cup`, `rematch`
  - campos `match.id`, `match.status`
  - campos `rematch.id`, `rematch.originMatchId`
  - estados de match `WAITING_FOR_PLAYERS`, `READY`, `IN_PROGRESS`
- El mismo test instancia ejemplos tipados con `satisfies UserPresenceResponse` y
  `satisfies PresenceWsEvent`.
