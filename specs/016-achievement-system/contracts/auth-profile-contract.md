# Contract: Auth y perfil de jugador

Fuente autoritativa: `docs/CONTRATOS_API.md` secciones 3.1, 3.2, 3.3, 3.4, 3.5 y 7.5.

## Autenticacion registrada

### Registro

`POST /api/auth/register`

**Request**:

```json
{
  "username": "juancho",
  "password": "Clave1!"
}
```

**Response 200**:

```json
{
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "username": "juancho",
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 2592000
}
```

### Login

`POST /api/auth/login`

Mismo shape de respuesta que registro. `username` es autoritativo y debe persistirse.

### Refresh

`POST /api/auth/refresh`

**Request**:

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

**Response 200**:

```json
{
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "username": "juancho",
  "accessToken": "<jwt>",
  "refreshToken": "<new-opaque-refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 2592000
}
```

**Regla FE**: reemplazar access token, refresh token, playerId y username con la respuesta completa.

## Invitado

`POST /api/auth/guest`

**Response 200**:

```json
{
  "playerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 604800
}
```

**Regla FE**: la sesion invitada tiene `username = null`, no tiene refresh token y no habilita perfil de logros propio.

## Identidad actual

`GET /api/auth/me`

**Response 200 usuario registrado**:

```json
{
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "username": "juancho",
  "tokenUse": "user"
}
```

**Response 200 invitado**:

```json
{
  "playerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "username": null,
  "tokenUse": "guest"
}
```

**Regla FE**: usar este endpoint para rehidratar sesiones persistidas sin username o validar identidad visible incompleta.

## Perfil de jugador

`GET /api/profile/{username}`

**Response 200**:

```json
{
  "achievements": [
    {
      "achievementCode": "WIN_RETRUCO_FROM_0_0_TO_3",
      "unlockedAt": 1772768158123,
      "matchId": "550e8400-e29b-41d4-a716-446655440001",
      "gameNumber": 1
    }
  ],
  "stats": {
    "matchesPlayed": 42,
    "matchesWon": 24,
    "matchesLost": 18,
    "winRate": 57
  }
}
```

**Errores relevantes**:
- `401`: sesion ausente o invalida.
- `404`: username sin perfil registrado.

**Reglas FE**:
- No esperar `username` ni `playerId` en el body.
- Mostrar errores con copy frontend.
- Tratar perfil vacio como estado valido, no como error.
