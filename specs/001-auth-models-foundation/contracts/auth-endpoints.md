# Contract: Endpoints de Auth consumidos por el FE

Subset relevante de `docs/CONTRATOS_API.md §3` y §2 (errores). Esta versión es **lectura para el FE**; ante divergencia, la fuente autoritativa sigue siendo el documento principal del contrato.

Base URL: `http://localhost:8080/api`

Todos los endpoints de esta sección son **públicos** (sin Bearer) y **excluidos** de los interceptores `jwt` y `refresh` del FE.

---

## POST /api/auth/register

**Request**

```json
{ "username": "juancho", "password": "Clave1!" }
```

**Reglas de validación (eco al cliente)**:
- `username`: ASCII `[A-Za-z0-9]+`, mínimo 3 letras.
- `password`: ≥5 caracteres, al menos 1 número y 1 símbolo.

**Response `200`** — `FullAuthResponse`

```json
{
  "playerId": "uuid",
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 2592000
}
```

**Errores**: `400` (body o reglas), `422` (`username` en uso → `UserFacingAuthError.kind = 'username-taken'`).

---

## POST /api/auth/login

**Request**

```json
{ "username": "juancho", "password": "Clave1!" }
```

**Response `200`** — `FullAuthResponse` (igual shape que register).

**Errores**: `400` (body), `401` (credenciales inválidas → `UserFacingAuthError.kind = 'invalid-credentials'`).

---

## POST /api/auth/guest

**Request**: sin body.

**Response `200`** — `GuestAuthResponse`

```json
{
  "playerId": "uuid",
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 604800
}
```

> No incluye `refreshToken`. El FE persiste `refreshToken = null` y marca `isGuest = true`. Cuando este token expire, el guest queda deslogueado (no se intenta refrescar).

---

## POST /api/auth/refresh

**Request**

```json
{ "refreshToken": "<opaque>" }
```

**Response `200`** — `FullAuthResponse` (con nuevo `accessToken` y `refreshToken` **rotado**).

**Errores**: `401` si el token está revocado, expirado, rotado o no existe. Al recibirlo, el FE: limpia la sesión, navega a `/login?returnUrl=...` y descarta cualquier request encolada.

**Reglas críticas para el FE**:
- El `refreshToken` rota **en cada llamada**. El FE debe escribir el nuevo `refreshToken` en el store/storage **antes** de reanudar las requests encoladas.
- Una sola llamada a `/refresh` a la vez por sesión (single‑flight). Más de una en paralelo provoca que el primer token rotado quede inválido y rompe la cola.

---

## DELETE /api/auth/logout

**Request**

```json
{ "refreshToken": "<opaque>" }
```

**Response `204`** sin body.

**Reglas para el FE**:
- Llamar incluso si la sesión es guest sin `refreshToken`: en ese caso, **omitir** la llamada al backend y limpiar solo el estado local.
- Si la red falla, **igualmente** se limpia el estado local: el logout local siempre debe efectuarse.

---

## Forma estándar de errores (`ErrorResponse`)

```json
{
  "errorCode": "UnauthorizedAccessException",
  "message": "Missing authentication token",
  "timestamp": "2026-03-06T03:15:30Z",
  "requestId": "uuid-optional"
}
```

Mapeo a `UserFacingAuthError` (función `mapApiError`):

| HTTP | `errorCode` (ejemplo) | `UserFacingAuthError` |
|---|---|---|
| 400 | `InvalidEnumValueException`, bean validation | `{kind:'validation', field?, message}` |
| 401 | `UnauthorizedAccessException` (en login) | `{kind:'invalid-credentials'}` |
| 401 | (en refresh) | propaga: el interceptor limpia sesión |
| 422 | conflict de username | `{kind:'username-taken'}` |
| 5xx / network | — | `{kind:'network'}` / `{kind:'server', message}` |
