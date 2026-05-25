# Contrato — `POST /api/matches/bot`

**Fuente autoritativa**: `docs/CONTRATOS_API.md §9.2` (esta feature corrige la descripción de `gamesToPlay` allí, FR-007a).

**Versión local en `specs/004-lobby-bots-fixes/`**: este archivo es la fotografía del contrato tal como el cliente debe respetarlo después de esta feature.

---

## Endpoint

`POST /api/matches/bot`

Requiere `Authorization: Bearer <jwt>`.

## Request body

```json
{
  "botId": "00000000-0000-0000-0000-000000000001",
  "gamesToPlay": 3
}
```

| Campo         | Tipo            | Reglas                                                                                                                  |
|---------------|-----------------|-------------------------------------------------------------------------------------------------------------------------|
| `botId`       | `string (UUID)` | Obligatorio. ID del bot elegido (de `GET /api/bots`).                                                                   |
| `gamesToPlay` | `integer`       | Obligatorio. **Partidas totales de la serie (mejor de N). Valores válidos: `1`, `3`, `5`.** Cualquier otro valor → 422. |

> No se permite enviar campos extra (`numberOfPlayers`, `visibility`, etc. no aplican a este endpoint).

## Mapeo cliente

```
BEST_OF_1 → gamesToPlay = 1
BEST_OF_3 → gamesToPlay = 3
BEST_OF_5 → gamesToPlay = 5
```

## Response `200 OK`

```json
{
  "matchId": "8b9c5936-9a1f-45ec-a587-24306689f6f7"
}
```

| Campo     | Tipo            | Reglas                                                              |
|-----------|-----------------|---------------------------------------------------------------------|
| `matchId` | `string (UUID)` | UUID v4 del match creado. El cliente navega a `/match/:matchId`.    |

## Errores

| HTTP | Code backend                              | Causa                                                                  | UI                                                          |
|------|-------------------------------------------|------------------------------------------------------------------------|-------------------------------------------------------------|
| 401  | (auth)                                    | Sin/expirado bearer                                                    | Redirección estándar a `/auth/login` por `authGuard`        |
| 404  | `BotNotFoundException`                    | `botId` inexistente                                                    | Invalidar selección, recargar catálogo, copy del catálogo   |
| 422  | `InvalidGamesToPlayException`             | `gamesToPlay` fuera de `{1,3,5}`                                        | Copy genérico (no debería ocurrir si el cliente cumple)     |
| 422  | `PlayerHasActiveMatchException`           | El jugador ya tiene partida activa                                     | Copy accionable + opción "Ir a partida activa"              |
| 422  | `PlayerHasOpenRematchSessionException`    | Revancha `OPEN` pendiente                                              | Copy accionable                                             |
| 422  | `PlayerAlreadyInQueueException`           | Ya en cola de Quick Match                                              | Copy accionable                                             |
| 5xx  | —                                         | Error servidor                                                         | Copy genérico, permitir reintento                           |

> En todos los casos: la UI usa `getErrorCopy('CREATE_BOT_MATCH', err)`. Nunca renderiza `ApiError.message` crudo.

## Invariantes que el contract test verifica

1. Las claves de `CreateBotMatchRequest` son **exactamente** `{ botId, gamesToPlay }`.
2. Las claves de `CreateBotMatchResponse` son **exactamente** `{ matchId }`.
3. El tipo de `gamesToPlay` en `CreateBotMatchRequest` es el literal union `1 | 3 | 5` (verificado vía `satisfies` y type-only check).
4. `seriesFormatToGamesToPlay(BEST_OF_3) === 3` (y los otros dos casos análogos).
5. El heading `### 9.2 Crear partida contra bot` existe en `docs/CONTRATOS_API.md`.
6. La fila del campo `gamesToPlay` en la tabla de §9.2 contiene la frase **"Partidas totales de la serie"** (corrección FR-007a).
