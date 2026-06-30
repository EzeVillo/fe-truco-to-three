# API REST - Auth

> [← Volver al índice de contratos](../CONTRATOS_API.md)

## Registrar usuario

`POST /api/auth/register`

Request:

```json
{
  "username": "juancho",
  "password": "Clave1!"
}
```

Reglas:

- `username` solo puede contener letras ASCII (`A-Z`, `a-z`) y numeros (`0-9`)
- `username` debe contener al menos 3 letras
- `password` debe tener al menos 5 caracteres, al menos 1 numero y al menos 1 simbolo

Response `200`:

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

Errores:

- `400` si el body es invalido o no cumple las reglas de validacion del request
- `422` si el username ya esta en uso

## Login

`POST /api/auth/login`

Request:

```json
{
  "username": "juancho",
  "password": "Clave1!"
}
```

Response `200`:

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

Errores:

- `401` si las credenciales son invalidas (username no existe o contraseÃƒÂ±a incorrecta)

- `400` si el body es invalido o no cumple las reglas de validacion del request

## Acceso como invitado

`POST /api/auth/guest`

Request: sin body.

Response `200`:

```json
{
  "playerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 604800
}
```

No persiste cuenta. El `playerId` es efimero.

## Refresh de sesion

`POST /api/auth/refresh`

Request:

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

Response `200`:

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

Reglas:

- siempre rota el refresh token
- el refresh token anterior deja de ser valido inmediatamente
- si se reusa un refresh token rotado o revocado, la cadena de esa sesion queda revocada
- no afecta otras sesiones activas del mismo usuario

Errores:

- `401` si el refresh token es invalido, expirado, revocado o rotado

## Identidad de sesion actual

`GET /api/auth/me`

Auth: Bearer requerido.

Permite rehidratar la sesion desde un access token valido sin depender de datos persistidos por el
cliente. El access token sigue teniendo `sub = playerId`; el `username` se resuelve desde el backend
para usuarios registrados.

Response `200` para usuario registrado:

```json
{
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "username": "juancho",
  "tokenUse": "user"
}
```

Response `200` para guest:

```json
{
  "playerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "username": null,
  "tokenUse": "guest"
}
```

Errores:

- `401` si falta Bearer token, el token es invalido o expiro
- `401` si el token es de usuario registrado pero el usuario ya no se puede resolver

## Logout de sesion

`DELETE /api/auth/logout`

Request:

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

Response `204` sin body.

Reglas:

- revoca solo la sesion asociada al refresh token enviado
- si el refresh token no existe, responde `204` igual

