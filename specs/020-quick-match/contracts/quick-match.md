# Contract: Quick Match

Fuente autoritativa: `docs/CONTRATOS_API.md §9.3`.

## Entrar a la cola

`POST /api/matches/quick`

Requiere Bearer token.

### Request

```json
{
  "gamesToPlay": 3
}
```

| Campo | Tipo | Reglas FE |
|-------|------|-----------|
| `gamesToPlay` | `1 | 3 | 5` | Partidas totales de la serie. `BEST_OF_1 -> 1`, `BEST_OF_3 -> 3`, `BEST_OF_5 -> 5`. |

### Response `200` buscando

```json
{
  "status": "SEARCHING",
  "matchId": null,
  "enqueuedAt": "2026-05-20T10:00:00Z"
}
```

### Response `200` emparejado

```json
{
  "status": "MATCHED",
  "matchId": "550e8400-e29b-41d4-a716-446655440000",
  "enqueuedAt": "2026-05-20T10:00:00Z"
}
```

| Campo | Tipo | Reglas FE |
|-------|------|-----------|
| `status` | `'SEARCHING' | 'MATCHED'` | Controla si la pantalla espera o navega. |
| `matchId` | `string | null` | `null` si busca; UUID si emparejó. |
| `enqueuedAt` | `string` | ISO-8601. Mostrar opcionalmente como estado informativo, no parsear para lógica crítica. |

### Errores

| Código | Tratamiento FE |
|--------|----------------|
| `401` | Interceptor global limpia sesión y redirige; no mostrar copy local. |
| `422` | Mostrar copy controlado de quick match; no mostrar `message` crudo. |
| `0`/red | Mostrar copy recuperable y permitir reintentar. |
| `5xx` | Mostrar copy recuperable y permitir reintentar. |

## Cancelar búsqueda

`DELETE /api/matches/quick`

Requiere Bearer token. Sin body.

### Response

`204 No Content`

La operación es idempotente: si el jugador no estaba en cola, también devuelve `204`.

## Evento de emparejamiento diferido

Mientras la pantalla está en estado `SEARCHING`, debe escuchar `/user/queue/match`.

Evento relevante:

```json
{
  "matchId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "GAME_STARTED",
  "timestamp": 1772768158123,
  "payload": {
    "gameNumber": 1
  },
  "stateVersion": 1
}
```

Regla FE: al recibir `GAME_STARTED` con `matchId`, navegar a `/match/{matchId}` y dejar de mostrar la
pantalla de búsqueda.
