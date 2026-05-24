# Quickstart — Verificación manual

**Feature**: 001-auth-models-foundation

Este documento sirve para validar de forma manual que la feature está terminada y se comporta como dice la spec. Se asume el backend corriendo en `http://localhost:8080` y el FE en `http://localhost:4200`.

## 0. Setup

```powershell
pnpm install
pnpm start
```

Abrí `http://localhost:4200` en una **pestaña incógnita** para arrancar sin sesión previa.

---

## 1. Smoke: Jugar como invitado (P1)

1. Llegás a `/login` automáticamente.
2. Click en "Jugar como invitado".
3. ✅ Esperado:
   - El botón muestra un spinner inline.
   - Navegás al lobby (placeholder).
   - DevTools → Application → Local Storage → `tt3.session` existe, con `isGuest: true`, `refreshToken: null` y un `playerId` UUID.
   - Network → la siguiente request protegida lleva `Authorization: Bearer <jwt>`.

## 2. Smoke: Login con cuenta existente (P1)

1. Recargá en incógnito; click "Iniciar sesión" (o `/login`).
2. Completá credenciales válidas → Enter.
3. ✅ `tt3.session` con `isGuest: false`, `refreshToken` poblado, `playerId` UUID.
4. Probá credenciales inválidas → mensaje claro, botón habilitado de nuevo, sin tokens persistidos.

## 3. Smoke: Registro (P2)

1. `/register` con datos válidos y nuevos.
2. ✅ Misma sesión que en login: redirige a lobby.
3. Repetí con el mismo `username` → error inline "Ese usuario ya está en uso", el formulario sigue editable.
4. Probá `username` con tilde o espacio, o `password` de 4 chars → errores client‑side **antes** de pegarle al backend (sin request en Network).

## 4. Refresh transparente (FR‑011, FR‑012)

1. Logueate normalmente.
2. En DevTools → Application → Local Storage, sustituí el `accessToken` del JSON `tt3.session` por basura (por ejemplo, recortale 3 caracteres) y recargá.
3. Navegá a una ruta protegida que dispare una llamada protegida.
4. ✅ Esperado en Network: la llamada original falla `401`, le sigue un `POST /api/auth/refresh`, y luego la **misma** request original retry con el nuevo token y 200. Todo transparente para el usuario.
5. Forzá múltiples llamadas en paralelo (por ejemplo, abrí dos vistas que disparen requests). ✅ Debe haber **un solo** `POST /api/auth/refresh`, no N en paralelo.

## 5. Refresh fallido (FR‑013)

1. Logueate, copiá tu `refreshToken` actual del storage.
2. En el backend o con un script, revocá ese refresh (o esperá su expiración).
3. Forzá un 401 (truncá el access token igual que en 4.2).
4. ✅ El refresh devuelve 401; el FE: limpia `tt3.session`, navega a `/login?returnUrl=/lobby`, muestra aviso de sesión expirada.
5. Volvé a iniciar sesión → al hacer login, debe redirigirte a `/lobby` (o el `returnUrl` original).

## 6. Logout (FR‑010)

1. Click "Salir".
2. ✅ `tt3.session` desaparece de `localStorage`.
3. Intentar volver atrás en el browser a una ruta protegida → te manda a `/login`.

## 7. Storage corrupto (edge case)

1. Logueate.
2. En DevTools, editá `tt3.session` para que sea JSON inválido (por ejemplo, borrá la `}` final).
3. Recargá.
4. ✅ La app arranca en `/login` sin errores visibles; `tt3.session` queda borrada.

## 8. Rutas protegidas (FR‑018, FR‑019)

1. Sin sesión, intentar `/lobby` → redirige a `/login?returnUrl=/lobby`.
2. Con sesión, intentar `/login` o `/register` → redirige a `/lobby` (no muestra formularios).

## 9. Verificaciones de código (SC‑005, SC‑006)

```powershell
# 1) No queda el modelo viejo basado en username como identidad de sesión.
pnpm exec grep -RIn "username" src/app/core/models  # debería no haber referencia como identidad de sesión.

# 2) refreshToken no se referencia fuera de la capa de auth.
pnpm exec grep -RIn "refreshToken" src/app | findstr /V "core\\auth core\\interceptors"
#    ↑ debería retornar vacío (sin coincidencias fuera de la auth layer).

# 3) localStorage no se accede fuera de SessionStorageService.
pnpm exec grep -RIn "localStorage" src/app | findstr /V "session-storage.service.ts"
#    ↑ debería retornar vacío.
```

## 10. Tests

```powershell
pnpm test
```

✅ Esperado: 100% de specs verdes para `auth.store`, `auth.service`, `refresh.interceptor`, `jwt.interceptor`, `session-storage.service`, `login-page`, `register-page`, `auth.guard`, `public-only.guard`.
