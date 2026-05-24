# Phase 0 — Research & Decisiones técnicas

**Feature**: 001-auth-models-foundation
**Fecha**: 2026-05-23

Este documento resuelve las decisiones técnicas que la spec dejó abiertas a criterio de ingeniería, alineándolas con las prácticas idiomáticas de Angular 21 y el stack ya elegido en el repo.

---

## 1. Estrategia de estado para la sesión

**Decisión**: usar `signalStore` de `@ngrx/signals` (ya presente en el proyecto) como único contenedor del estado de sesión, en `core/auth/auth.store.ts`. La hidratación desde `localStorage` se hace en un `withHooks({ onInit })`.

**Rationale**:
- Coherente con el `AuthStore` actual del repo y con la guía de Angular para apps "signal‑first".
- `signalStore` ya expone señales tipadas → integra natural con `computed` y plantillas sin `async` pipes.
- Permite `methods` síncronos (`setSession`, `clearSession`, `updateAccessToken`) y composición vía `withMethods`/`withHooks` sin acoplar lifecycle del componente.

**Alternativas consideradas**:
- **NgRx classic (`feature` + reducer + effects)**: sobredimensionado para sesión, no requiere time‑travel ni eventos asíncronos densos; el repo lo deja disponible globalmente para features de juego, pero aquí es ruido.
- **`BehaviorSubject` en un service**: funciona, pero pierde la integración nativa con señales/templates y obliga a `getValue()` sincronía manual.

---

## 2. Forma y persistencia del `AuthSession`

**Decisión**: el store mantiene la siguiente forma en memoria, y persiste **solo el subconjunto reanudable** en `localStorage` bajo una **única clave JSON** (`tt3.session`):

```ts
type AuthSession = {
  playerId: string;
  accessToken: string;
  refreshToken: string | null;   // null para guests (3.3 no devuelve refreshToken)
  isGuest: boolean;
  // Derivados volátiles (sólo memoria, no se persisten):
  accessTokenExpiresAt: number;  // epochMs estimado al recibir la respuesta
};
```

**Rationale**:
- Una sola clave JSON evita estados parciales en `localStorage` (el bug clásico de tener `auth_token` sin `auth_username`). Al parsear, si el shape no valida (zod‑like check manual o type guard), se descarta entera y se trata al usuario como no autenticado.
- `accessTokenExpiresAt` se mantiene **solo en memoria**: al rehidratar no se confía en relojes anteriores; el refresh reactivo en 401 es la red de seguridad.
- `refreshToken` se persiste, pero **solo se lee desde `AuthService`/`refreshInterceptor`**. Ningún otro consumidor lo necesita (FR‑SC‑006 de la spec).

**Alternativas consideradas**:
- **`sessionStorage`**: pierde sesión al cerrar la pestaña; rompe el escenario "vuelve mañana sin loguearse de nuevo" para usuarios registrados.
- **Cookies HttpOnly**: ideal para seguridad XSS, pero requiere coordinación con backend y desactiva fácilmente el control de "logout local" sin red. Queda como mejora futura, fuera de alcance.
- **Claves separadas `auth_token` / `auth_username`** (estado actual): fragmentación que ya causó la deuda que motiva esta feature.

---

## 3. Interceptores: separación de responsabilidades

**Decisión**: dos interceptores funcionales **separados**, registrados en este orden en `app.config.ts`:

1. `jwtInterceptor` — añade `Authorization: Bearer <accessToken>` a toda request **excepto** las que matchean `/api/auth/(register|login|guest|refresh)`.
2. `refreshInterceptor` — atrapa respuestas `401` para requests **no excluidas**, dispara el refresh **una sola vez** (cola compartida con `BehaviorSubject<string | null>`), reintenta la request original con el nuevo token. Si el refresh falla, llama `authStore.clearSession()`, navega a `/login?returnUrl=...` y propaga el error original.

**Rationale**:
- Single‑responsibility: el `jwt` es trivial, el `refresh` es el complejo. Separarlos hace el `refresh` testeable en aislamiento.
- Interceptores funcionales (Angular 17+) eliminan boilerplate de clases y `multi: true`.
- Excluir `/api/auth/*` por **path matching explícito** (constante exportada) evita bucles de refresh sobre refresh.

**Algoritmo de cola** (resumido):

```text
estado de módulo:
  refreshing: boolean = false
  newToken$: Subject<string | null>

al recibir 401 en una request no excluida:
  if (refreshing):
    esperar newToken$.first()
    if token: retry(req con token); else: forward error
  else:
    refreshing = true
    authService.refresh().subscribe({
      next: (newToken) => { newToken$.next(newToken); refreshing = false; retry(req); },
      error: () => { newToken$.next(null); refreshing = false; authStore.clearSession(); router.navigate(['/login'], {queryParams: {returnUrl}}); forward 401; }
    })
```

**Alternativas consideradas**:
- **Un solo interceptor monolítico**: más simple de leer al principio, pero impide cobertura de tests fina y mezcla concerns.
- **`HttpInterceptor` clásico (clase)**: deprecado en favor del funcional, sin upside en este caso.

---

## 4. Validación de formularios

**Decisión**: **Reactive Forms tipadas** (`FormGroup` con types) y los validadores nativos de Angular. Las reglas de validación reflejan exactamente las del contrato (`docs/CONTRATOS_API.md §3.1`):

- `username`: requerido, `Validators.pattern(/^[A-Za-z0-9]+$/)`, al menos 3 letras (custom validator `minLettersValidator(3)`).
- `password`: requerido, `Validators.minLength(5)`, al menos 1 número y 1 símbolo (custom validator `passwordStrengthValidator`).

**Rationale**:
- Replicar la validación cliente evita un round‑trip para errores triviales (mejor UX) y deja al backend como autoridad final (defensa en profundidad).
- Reactive Forms ya es estándar en el repo (Angular 21) y juega bien con Material `mat-form-field`.

**Alternativas consideradas**:
- **Template‑driven forms**: peor tipado, menos testeable.
- **Validación solo en backend**: peor UX y obliga a parsear `ErrorResponse` para errores que son obvios.

---

## 5. Rutas y guards

**Decisión**:
- Rutas top level: `/login`, `/register`, redirect `'' → /login` cuando no hay sesión, `'' → /lobby` (placeholder) cuando sí. `features/auth` queda **lazy** vía `loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)`.
- Guards como `CanMatchFn` (no `CanActivateFn`):
  - `authGuard`: deja pasar si `authStore.isAuthenticated()`; si no, redirige a `/login?returnUrl=<url-original>`.
  - `publicOnlyGuard`: aplicado a `/login` y `/register`; si hay sesión, redirige a `/lobby`.

**Rationale**:
- `CanMatchFn` permite a Angular **no descargar el chunk** del módulo lazy cuando el guard rechaza → mejor rendimiento y seguridad (no exponer bundles innecesariamente).
- `returnUrl` cubre el SC‑004 de la spec.

**Alternativas consideradas**:
- **`CanActivateFn`**: válido pero descarga el chunk antes de evaluar.
- **`/auth/login` y `/auth/register`** (estructura actual del guard viejo): la spec pide explícitamente `/login` y `/register`; respetamos la spec.

---

## 6. Hidratación al arrancar la app

**Decisión**: `signalStore` con `withHooks({ onInit })` que lee `tt3.session` del `SessionStorageService`, valida el shape y popula el state. Si el JSON es inválido o falta cualquier campo obligatorio, se purga la clave y se sale en estado anónimo. **No** se usa `APP_INITIALIZER` porque la hidratación es sincrónica desde `localStorage` y no se quiere bloquear el bootstrap por una llamada de red.

**Rationale**:
- Sincrónico = sin "pestañeo" entre "no autenticado" y "autenticado" al cargar.
- Refrescar proactivamente al arrancar es una optimización; el refresh reactivo en el primer 401 ya cubre el caso.

**Alternativas consideradas**:
- **Refresh proactivo al arrancar** (`APP_INITIALIZER` que llama `/refresh` si hay `refreshToken`): añade latencia visible y complica el bootstrap; se difiere a una feature futura si la telemetría muestra que vale la pena.

---

## 7. Tipado de enums case‑sensitive

**Decisión**: usar **union literal types** + objetos `as const` en `core/models/enums.ts`. Por ejemplo:

```ts
export const SUIT = { ESPADA: 'ESPADA', BASTO: 'BASTO', COPA: 'COPA', ORO: 'ORO' } as const;
export type Suit = typeof SUIT[keyof typeof SUIT];
```

**Rationale**:
- Los `enum` de TypeScript generan código en runtime y no son friendly a tree‑shaking; además, su `enum` numérico es trampa fácil.
- `as const` mantiene los literales exactos del contrato, sin transformaciones, y el `type` derivado da autocompletado y exhaustividad en `switch`.

**Alternativas consideradas**:
- **`enum` clásico de TS**: bundle más grande, comportamiento numérico vs string a veces confuso.
- **Solo `type X = 'A' | 'B'`**: pierde el "valor" disponible para iterar o validar en runtime.

---

## 8. Encapsulamiento de `localStorage`

**Decisión**: `SessionStorageService` con tres métodos: `read<T>(key, validator)`, `write<T>(key, value)`, `remove(key)`. Internamente envuelve los accesos en `try/catch` (cuotas excedidas, `localStorage` deshabilitado, JSON corrupto) y devuelve `null` ante fallo silenciosamente para no romper el bootstrap.

**Rationale**:
- Testabilidad: en tests inyectamos un fake en lugar de stubear `localStorage`.
- Robustez: una sola línea de mitigación frente a navegadores en modo privado o con storage corrupto.
- Cumple con el constraint del plan: cero accesos directos a `localStorage` fuera de este service.

**Alternativas consideradas**:
- **Acceder a `localStorage` directamente**: pasable pero contradice testabilidad y el constraint del plan.

---

## 9. UX y look & feel

**Decisión**: las pantallas de Login y Register usan Angular Material (`mat-form-field`, `mat-input`, `mat-button`, `mat-progress-spinner` para loading inline). El layout y la paleta se inspiran en el prototipo `public/referencias/Truco a 3 - Prototipo clickable.html`, pero adaptados a componentes Material (en lugar de copiar markup HTML del prototipo). Idioma: español rioplatense.

**Rationale**:
- Material ya está instalado y configurado; usar otra librería duplicaría peso.
- El prototipo es una referencia de **dirección visual**, no un contrato de markup; copiarlo al pie de la letra acoplaría la implementación a estilo prototipal.

---

## 10. Testing

**Decisión**:
- **Unit**: `AuthStore` (state transitions, hidratación con storage fake), `AuthService` (con `HttpTestingController`), `SessionStorageService` (con `Storage` fake), `refreshInterceptor` (con `HttpTestingController` + cola simulada), `authGuard`/`publicOnlyGuard` (con `Router` fake).
- **Component**: `LoginPage` y `RegisterPage` con `TestBed`, formularios, estados loading/error.
- **No e2e en esta feature**: queda fuera de alcance; el `quickstart.md` cubre la verificación manual.

**Rationale**: las áreas de mayor riesgo (cola de refresh, hidratación) se cubren con unit tests determinísticos. E2E real conviene con un backend de staging estable, que no es el estado actual.

---

## 11. Manejo de errores del backend

**Decisión**: un pequeño helper `mapApiError(err: HttpErrorResponse): UserFacingAuthError` que mapea:

- `400 InvalidEnumValueException`/bean‑validation → "Datos inválidos".
- `401` en login → "Usuario o contraseña incorrectos".
- `422` con `errorCode` específico → mensaje localizado del catálogo.
- Network / 5xx → "No pudimos conectar con el servidor. Probá de nuevo en un momento."

**Rationale**: centralizar el mapping evita strings duplicados en cada componente y mantiene los mensajes consistentes con el copy del prototipo. El `errorCode` del contrato (`docs/CONTRATOS_API.md §2`) es la fuente canónica para discriminar.

**Alternativas consideradas**:
- Strings inline en cada componente: rompe consistencia, dificulta i18n futura.

---

## 12. Out of scope (confirmado)

Para mantener foco y no introducir scope creep, **fuera de alcance** en esta feature:

- Recuperación de contraseña / forgot password.
- Login federado (Google/Apple/etc.).
- Verificación por email.
- Cambio de contraseña post‑login.
- Edición de perfil.
- Persistencia de la sesión en cookies HttpOnly (sigue siendo `localStorage`).
- Refresh proactivo basado en `accessTokenExpiresIn` antes de fallar.
- i18n (todo el copy va hard‑coded en español, listo para extractarse después).

Cualquiera de estos puede convertirse en spec independiente.
