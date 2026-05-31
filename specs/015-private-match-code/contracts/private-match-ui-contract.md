# Contrato de consumo (FE) — Partida privada por código

Contrato que el frontend consume del backend para esta feature. Fuente autoritativa:
`docs/CONTRATOS_API.md`. Cualquier divergencia detectada se corrige primero en esa fuente
(Principio II). El contract test `src/tests/contract/private-match.contract.spec.ts` verifica paridad.

---

## REST

### 1. Crear partida privada — §4.1

```
POST /api/matches
Authorization: Bearer <jwt>
Content-Type: application/json

{ "gamesToPlay": 3, "visibility": "PRIVATE" }
```

- `gamesToPlay ∈ {1, 3, 5}` (partidas totales de la serie). Nunca `2`.
- Respuesta `200`:

```json
{ "matchId": "<uuid>", "joinCode": "ABC123", "visibility": "PRIVATE" }
```

### 2. Unirse por código — §4.2

```
POST /api/join/{joinCode}
Authorization: Bearer <jwt>
```

- Respuesta `200`: `{ "targetType": "MATCH", "targetId": "<uuid>" }`
- En privada, el segundo jugador entra y el match queda en **`READY`** (no autostart).
- Errores relevantes: `404` (código inexistente), `409` (último lugar ocupado), `422` (no
  joinable / jugador ocupado — `PlayerAlreadyInMatchException`, `PlayerHasOpenRematchSessionException`).

### 3. Iniciar partida — §4.5

```
POST /api/matches/{matchId}/start
Authorization: Bearer <jwt>
```

- Respuesta `204` sin body. La inicia el anfitrión cuando el match está `READY`.

### 4. Salir antes de empezar — §4.13

```
POST /api/matches/{matchId}/leave
Authorization: Bearer <jwt>
```

- Respuesta `204` sin body.
- Creador (PLAYER_ONE) → `CANCELLED` + evento `MATCH_CANCELLED`.
- Segundo jugador (PLAYER_TWO) → vuelve a `WAITING_FOR_PLAYERS` + evento `MATCH_PLAYER_LEFT`.
- Errores: `422` si no pertenece, si el estado no es `WAITING_FOR_PLAYERS`/`READY`, o si pertenece a
  liga/copa (no aplica en MVP).

### 5. Snapshot de estado — §4.14 (reusado, no nuevo)

```
GET /api/matches/{matchId}
```

- `roundGame` es `null` si `status !== 'IN_PROGRESS'` (sala de espera).
- `playerTwoUsername` **puede ser `null`** mientras `WAITING_FOR_PLAYERS`.
- **No incluye `joinCode`** (gap conocido D5 — el host lo recupera por navigation state /
  `sessionStorage`).

---

## WebSocket (`/user/queue/match`) — eventos pre-juego, §9.5/§9.6

Transaccionales (consumen `stateVersion`). El FE ya los recibe; esta feature les da tratamiento:

| Evento              | Payload                           | Tratamiento FE                                      |
|---------------------|-----------------------------------|-----------------------------------------------------|
| `PLAYER_JOINED`     | `{}`                              | Refresh de snapshot (trae rival + status)           |
| `PLAYER_READY`      | `{ seat }`                        | Refresh de snapshot                                 |
| `MATCH_PLAYER_LEFT` | `{ leaverSeat: "PLAYER_TWO" }`    | `status → WAITING_FOR_PLAYERS`, rival → `null`      |
| `MATCH_CANCELLED`   | `{}`                              | Notificar (aviso) y navegar al lobby                |
| `GAME_STARTED`      | `{ gameNumber }`                  | `status → IN_PROGRESS` (transición a tablero, D6)   |

> Tras `GAME_STARTED` llegan `ROUND_STARTED`, `HAND_DEALT`, `TURN_CHANGED`, etc., ya manejados por el
> motor existente.

---

## Enums (§8.2) — divergencia a alinear

- `MatchStateResponse.status`: §8.2 lista `WAITING_FOR_PLAYERS, IN_PROGRESS, FINISHED`, pero
  §4.2/§4.13 implican **`READY`**. Verificar runtime y, si aplica, agregar `READY` a §8.2 y al enum
  `MATCH_STATUS` (D1).

---

## Invariantes que el FE asume

1. El front **no** decide autostart, validez de código ni ocupación del jugador: refleja respuestas
   REST y eventos WS.
2. El anfitrión es siempre `PLAYER_ONE`; el invitado es `PLAYER_TWO`.
3. La transición a tablero ocurre por `GAME_STARTED`, no por polling.
4. Ningún mensaje de error muestra `ApiError.message` crudo (catálogo `getErrorCopy`).
