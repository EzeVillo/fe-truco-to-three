# Contract: API interna expuesta por `AuthService` y `AuthStore`

Define el **contrato hacia el resto de la app**. Cualquier feature posterior debe consumir solo lo que aquí se documenta; no debe acceder a `localStorage`, ni a `refreshToken`, ni a endpoints de `/api/auth/*` directamente.

---

## `AuthStore` (signalStore, providedIn: 'root')

### State (signals expuestas, todas readonly)

| Signal | Tipo | Significado |
|---|---|---|
| `playerId()` | `string \| null` | UUID del jugador autenticado. |
| `accessToken()` | `string \| null` | JWT actual. **Solo `jwtInterceptor` y `AuthService` deben leerlo.** |
| `refreshToken()` | `string \| null` | Token opaco. **Solo `AuthService` y `refreshInterceptor` deben leerlo.** Nunca exponer a UI. |
| `isGuest()` | `boolean` | `true` si la sesión proviene de `/guest`. |
| `isAuthenticated()` | `boolean` (computed) | `!!playerId() && !!accessToken()`. |

### Methods

| Método | Firma | Efecto |
|---|---|---|
| `setSession(input: AuthResponse)` | `void` | Deriva `AuthSession` desde `AuthResponse`, persiste en `localStorage` (`tt3.session`) y publica el nuevo estado. **Operación atómica**: storage primero, `patchState` después. |
| `updateAccessToken(token, expiresIn, refreshToken?)` | `void` | Actualiza solo los tokens (usado por `refreshInterceptor`). Si llega `refreshToken`, lo rota. |
| `clearSession()` | `void` | Borra `tt3.session` y vuelve a estado ANON. Atómica. |

### Hooks

- `onInit`: lee `tt3.session` vía `SessionStorageService`. Si el shape es válido, hidrata; si no, borra la clave y arranca en ANON.

---

## `AuthService` (providedIn: 'root')

```ts
class AuthService {
  register(req: RegisterRequest): Observable<FullAuthResponse>;
  login(req: LoginRequest): Observable<FullAuthResponse>;
  guest(): Observable<GuestAuthResponse>;
  refresh(): Observable<string>;  // emite el nuevo accessToken; popula store internamente
  logout(): Observable<void>;     // siempre limpia store; intenta backend si hay refreshToken
}
```

**Comportamiento**:

- Después de `register`/`login`/`guest` exitoso → llama `authStore.setSession(response)` antes de emitir al subscriber.
- `refresh()` lee `refreshToken()` del store; si es `null` (guest o ANON) emite `EMPTY` y dispara `clearSession()`.
- `refresh()` es **single‑flight**: implementado con `shareReplay({bufferSize: 1, refCount: true})` o un `BehaviorSubject` local; múltiples subscribers reciben el mismo resultado.
- `logout()`:
  1. Si hay `refreshToken`, llama `DELETE /api/auth/logout` (best‑effort, no espera).
  2. Llama `authStore.clearSession()`.
  3. Emite `void` siempre.

---

## `SessionStorageService` (providedIn: 'root')

```ts
class SessionStorageService {
  read<T>(key: string, isValid: (v: unknown) => v is T): T | null;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
}
```

- Encapsula todas las operaciones sobre `localStorage`.
- `read` devuelve `null` y borra la clave si el JSON está corrupto o el `isValid` falla.
- `write` ignora silenciosamente `QuotaExceededError`/`SecurityError` (modo privado) — no se rompe la app por falla de storage.

---

## Interceptores

### `jwtInterceptor`

- Si la URL matchea `AUTH_PUBLIC_PATHS` (`/api/auth/register|login|guest|refresh`) → pasa la request sin tocar.
- Si hay `accessToken()` → clona con `Authorization: Bearer <token>`.

### `refreshInterceptor`

- Se aplica **después** del `jwtInterceptor`.
- Para requests no excluidas, si la respuesta es `401`:
  1. Si ya hay un refresh en vuelo → espera el resultado.
  2. Si no, invoca `authService.refresh()`.
  3. Con el nuevo token, reintenta la request original **una sola vez**.
  4. Si el refresh falla → `authStore.clearSession()`, `router.navigate(['/login'], { queryParams: { returnUrl } })`, propaga el 401 original.
- Si la respuesta no es `401`, pasa el error tal cual.

---

## Guards

### `authGuard` (`CanMatchFn`)

```ts
() => authStore.isAuthenticated() ? true
  : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
```

### `publicOnlyGuard` (`CanMatchFn`)

```ts
() => !authStore.isAuthenticated() ? true
  : inject(Router).createUrlTree(['/lobby']);
```

---

## Rutas (top level)

```ts
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [publicOnlyGuard],
    loadComponent: () => import('./features/auth/pages/login-page/login-page.component').then(m => m.LoginPageComponent),
  },
  {
    path: 'register',
    canMatch: [publicOnlyGuard],
    loadComponent: () => import('./features/auth/pages/register-page/register-page.component').then(m => m.RegisterPageComponent),
  },
  {
    path: 'lobby',
    canMatch: [authGuard],
    loadComponent: () => import('./features/lobby/...').then(...), // placeholder, se afina en feature de lobby
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
```
