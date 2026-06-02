# Contrato FE — Lobby público de matches (021)

Interfaces del backend que esta feature **consume**. Fuente autoritativa:
`docs/CONTRATOS_API.md`. Este documento es el subconjunto relevante; ante divergencia, gana
`CONTRATOS_API.md` (y debe actualizarse primero si el backend cambia — Principio II).

## REST

### 1. Listar partidas públicas abiertas — `§4.3`

```
GET /api/matches/public?limit={1..100}&after={cursor?}
Auth: Bearer requerido
```

`limit` opcional (default 20, máx 100). `after` opcional (cursor opaco).

**200**:

```json
{
  "items": [
    {
      "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
      "host": "juancho",
      "gamesToPlay": 3,
      "totalSlots": 2,
      "occupiedSlots": 1,
      "status": "WAITING_FOR_PLAYERS",
      "_links": { "join": { "href": "/api/join/ABC12345" } }
    }
  ],
  "_links": {
    "self": { "href": "/api/matches/public?limit=20" },
    "next": { "href": "/api/matches/public?limit=20&after=eyJjdXJzb3IiOiJvcGFxdWUifQ" }
  }
}
```

**400**: `limit < 1`, `limit > 100`, o `after` mal formado.

**Mapeo FE**: cada item → `PublicMatchLobbyItem` (con `joinCode` = último segmento de
`_links.join.href`). `nextCursor` = valor de `after` en `_links.next.href` (o `null` si no hay `next`).

### 2. Crear partida (pública o privada) — `§4.1`, `§1.5`

```
POST /api/matches
Auth: Bearer requerido
Body: { "gamesToPlay": 1|3|5, "visibility": "PUBLIC"|"PRIVATE" }
```

**201** (PUBLIC):

```json
{ "matchId": "…", "joinCode": "ABC12345", "visibility": "PUBLIC" }
```

`PUBLIC` aparece en el lobby; `PRIVATE` no. Ambos devuelven `joinCode`.

**Errores** (manejar con `getErrorCopy('CREATE_MATCH', err)`): 403, 409/422 (ya en partida/revancha),
0 (red), 5xx.

### 3. Unirse desde el lobby — `§4.4`, `§4.2`

```
POST /api/join/{joinCode}
Auth: Bearer requerido
```

El FE toma el `joinCode` del item y ejecuta el join. **200**:

```json
{ "targetType": "MATCH", "targetId": "<matchId>" }
```

Navegar a `/match/{targetId}`. **No** llamar a `/start`: la pública pasa a `IN_PROGRESS` sola al entrar
el 2º jugador (`§4.5`).

**Errores** (manejar con `getErrorCopy('JOIN_MATCH', err)`):

| HTTP | Significado | Copy FE | UX |
|------|-------------|---------|-----|
| 409 | **Race condition**: se llenó justo antes | "La partida se llenó justo antes de que entraras." | **toast no bloqueante** (`MatSnackBar`); quedarse en lobby; sin refresco forzado |
| 404 | joinCode ya no resuelve | "Ese código no corresponde a ninguna partida." | toast |
| 422 | ya empezó / estás ocupado | "No podés unirte: la partida ya empezó o estás ocupado en otra." | toast |
| 0 / 5xx | red / servidor | "No pudimos unirte a la partida. Reintentá." | toast |

## WebSocket — topic `/topic/public-match-lobby` — `§9.4`

Broadcast compartido. El cliente **bootstrapea por REST** y usa el topic **solo para reconciliar
deltas**. Suscripción vía `WebSocketService.subscribe('/topic/public-match-lobby')`.

### UPSERT (alta o actualización de una partida abierta)

```json
{
  "eventType": "PUBLIC_MATCH_LOBBY_UPSERT",
  "timestamp": 1772768158123,
  "payload": {
    "lobby": {
      "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7",
      "host": "juancho",
      "gamesToPlay": 3,
      "totalSlots": 2,
      "occupiedSlots": 1,
      "status": "WAITING_FOR_PLAYERS"
    }
  }
}
```

### REMOVED (la partida salió del lobby — llena, cancelada o iniciada)

```json
{
  "eventType": "PUBLIC_MATCH_LOBBY_REMOVED",
  "timestamp": 1772768159000,
  "payload": { "id": "8b9c5936-9a1f-45ec-a587-24306689f6f7" }
}
```

**Excepción de id** (`§9.4`): estos eventos NO llevan `matchId` top-level; el id va en `payload.lobby`
(UPSERT) o `payload.id` (REMOVED).

**Mapeo al delta genérico**:
- `UPSERT` → `{ kind: 'upsert', item: payload.lobby }`
- `REMOVED` → `{ kind: 'removed', id: payload.id }`

## Contract test (a generar en Phase 2)

`src/tests/contract/public-match-lobby.contract.spec.ts` verifica con `satisfies`:
- `PublicMatchLobbyItem` ↔ shape de `§4.3` item y `§9.4` `payload.lobby`.
- `PublicMatchLobbyUpsertEvent` / `PublicMatchLobbyRemovedEvent` ↔ `§9.4`.
- `gamesToPlay` tipado como `1 | 3 | 5`.

## A confirmar en integración (quickstart)

- Si el `payload.lobby` del UPSERT incluye o no lo necesario para construir el `joinCode`/href de
  unión. Si no lo incluye, una partida conocida solo por WS deshabilita "Unirse" hasta reconciliar con
  REST (ver `data-model.md`, nota).
