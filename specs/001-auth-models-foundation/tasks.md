---
description: "Lista de tareas para la feature 001-auth-models-foundation"
---

# Tasks: Cimientos de Autenticación y Modelos de Dominio

**Input**: Documentos de diseño en `/specs/001-auth-models-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-endpoints.md, contracts/auth-service.md, quickstart.md

**Tests**: Se incluyen tareas de tests para áreas de alto riesgo identificadas en el plan (§ Constitution Check y research §10): `AuthStore`, `AuthService`, `SessionStorageService`, `refreshInterceptor`, `jwtInterceptor`, `authGuard`/`publicOnlyGuard` y componentes de páginas. No se incluyen tests E2E (fuera de alcance).

**Organización**: Las tareas están agrupadas por historia de usuario. La capa Auth completa (modelos, store, servicio, interceptores, guards, rutas) es prerrequisito compartido y vive en **Phase 2: Foundational**. Cada historia de usuario aporta la UI específica y su flujo end‑to‑end verificable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias en curso)
- **[Story]**: Mapea la tarea a la historia de usuario (US1, US2, US3)
- Las rutas de archivos son relativas a la raíz del repo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar dependencias instaladas y eliminar la deuda del modelo viejo antes de tocar código nuevo.

- [X] T001 Verificar instalación de `@ngrx/signals@^21` en `package.json` y, si falta, agregarlo con `pnpm add @ngrx/signals` (ya presente según `plan.md` — confirmar versión)
- [X] T002 [P] Crear estructura de carpetas vacías del árbol objetivo: `src/app/core/auth/`, `src/app/features/auth/pages/login-page/`, `src/app/features/auth/pages/register-page/`, `src/app/features/auth/components/guest-cta/` (sin archivos aún)
- [X] T003 [P] Borrar archivos legacy obsoletos: `src/app/core/stores/auth.store.ts`, `src/app/core/guards/auth.guard.ts`, `src/app/core/interceptors/jwt.interceptor.ts` (se reescribirán en sus nuevas ubicaciones — capturar imports rotos para corregir luego) y `src/app/core/models/index.ts` legacy con `AuthResponse {token, username}` / `Player` / `Room` si existen
- [X] T004 Ajustar `src/app/app.config.ts` y `src/app/app.routes.ts` para que compilen sin las referencias eliminadas (dejar TODOs marcados en los lugares que se rellenan en Phase 2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Toda la capa Auth (modelos canónicos, store, servicio, interceptores, guards y rutas) que las tres historias comparten. Sin esto ninguna historia es testeable.

**⚠️ CRITICAL**: Ninguna historia de usuario puede comenzar hasta que esta fase esté completa.

### Modelos de dominio (cimientos para todas las features)

- [X] T005 [P] Crear `src/app/core/models/enums.ts` con `SUIT`, `TRUCO_CALL`, `TRUCO_RESPONSE`, `ENVIDO_CALL`, `ENVIDO_RESPONSE`, `MATCH_STATUS`, `ROUND_STATUS`, `AVAILABLE_ACTION_TYPE`, `SEAT`, `VISIBILITY` como objetos `as const` + union literal types derivados (`Suit`, `TrucoCall`, …) según `data-model.md §3`
- [X] T006 [P] Crear `src/app/core/models/match.models.ts` con `Card`, `PlayedHand`, `CurrentHand`, `AvailableAction`, `RoundState`, `MatchState` según `data-model.md §2` (no se consumen en esta feature, solo se exportan)
- [X] T007 [P] Crear `src/app/core/models/ws.models.ts` con `WsEventBase`, `MatchWsEvent` (variantes documentadas) y la unión `WsEvent` según `data-model.md §4`
- [X] T008 [P] Crear `src/app/core/models/auth.models.ts` con `RegisterRequest`, `LoginRequest`, `RefreshRequest`, `LogoutRequest`, `FullAuthResponse`, `GuestAuthResponse`, `AuthResponse`, `AuthSession`, `ApiError`, `UserFacingAuthError` según `data-model.md §1`
- [X] T009 Crear `src/app/core/models/index.ts` (barrel) re-exportando `enums.ts`, `match.models.ts`, `ws.models.ts`, `auth.models.ts`

### Almacenamiento y mapeo de errores

- [X] T010 [P] Crear `src/app/core/auth/session-storage.service.ts` (`providedIn: 'root'`) con `read<T>(key, isValid)`, `write<T>(key, value)`, `remove(key)`, envoltura `try/catch` para `QuotaExceededError`/`SecurityError`/JSON inválido según `contracts/auth-service.md` y `research.md §8`
- [X] T011 [P] Crear `src/app/core/auth/auth.tokens.ts` exportando constantes `AUTH_STORAGE_KEY = 'tt3.session'` y `AUTH_PUBLIC_PATHS = ['/api/auth/register', '/api/auth/login', '/api/auth/guest', '/api/auth/refresh']`
- [X] T012 [P] Crear `src/app/core/auth/map-api-error.ts` con `mapApiError(err: HttpErrorResponse): UserFacingAuthError` según tabla en `contracts/auth-endpoints.md` y `research.md §11`
- [X] T013 [P] [TEST] Test unitario de `SessionStorageService` con fake `Storage` en `src/app/core/auth/session-storage.service.spec.ts` (read OK, read JSON corrupto purga clave, write ante QuotaExceeded no rompe, isValid false devuelve null)

### AuthStore (signalStore)

- [X] T014 [TEST] Test unitario de `AuthStore` en `src/app/core/auth/auth.store.spec.ts`: estado inicial ANON, `setSession(FullAuthResponse)` deriva `isGuest=false` y `accessTokenExpiresAt`, `setSession(GuestAuthResponse)` deriva `isGuest=true` con `refreshToken=null`, `updateAccessToken` rota tokens, `clearSession` borra storage y vuelve a ANON, `onInit` hidrata desde fake storage válido y descarta blob inválido
- [X] T015 Implementar `src/app/core/auth/auth.store.ts` con `signalStore({ providedIn: 'root' }, withState, withMethods({ setSession, updateAccessToken, clearSession }), withHooks({ onInit hidrata desde SessionStorageService }))` cumpliendo el contrato de `contracts/auth-service.md` §AuthStore y las transiciones de `data-model.md §5`

### AuthService

- [X] T016 [TEST] Test unitario de `AuthService` en `src/app/core/auth/auth.service.spec.ts` con `HttpTestingController`: `register` y `login` POST correctos y llaman `setSession` antes de emitir; `guest` POST sin body y `setSession` con `isGuest=true`; `refresh` lee `refreshToken()` del store, llama `setSession` con respuesta rotada, emite el nuevo `accessToken`; `refresh` con `refreshToken=null` emite `EMPTY` y llama `clearSession`; `refresh` es single‑flight (dos subscribers consecutivos comparten la misma request); `logout` con `refreshToken` hace DELETE best‑effort y `clearSession`; `logout` sin `refreshToken` solo `clearSession`
- [X] T017 Implementar `src/app/core/auth/auth.service.ts` (`providedIn: 'root'`) con métodos `register`, `login`, `guest`, `refresh` (single‑flight con `shareReplay({bufferSize:1, refCount:true})`), `logout` según `contracts/auth-service.md` §AuthService; URL base desde `environment.apiUrl` + `/auth/...`

### Interceptores

- [X] T018 [TEST] Test unitario de `jwtInterceptor` en `src/app/core/auth/jwt.interceptor.spec.ts`: requests a `/api/auth/*` pasan sin header, requests protegidas con `accessToken` ganan `Authorization: Bearer <token>`, sin token no añade header
- [X] T019 [P] Implementar `src/app/core/auth/jwt.interceptor.ts` (functional `HttpInterceptorFn`) que excluye URLs de `AUTH_PUBLIC_PATHS` y añade `Authorization: Bearer ${authStore.accessToken()}`
- [X] T020 [TEST] Test unitario de `refreshInterceptor` en `src/app/core/auth/refresh.interceptor.spec.ts`: 401 en request no excluida dispara `authService.refresh()` y retry una vez con nuevo token; múltiples 401 simultáneas comparten un único refresh; refresh fallido llama `clearSession`, navega a `/login?returnUrl=...` y propaga el 401 original; 401 en `/api/auth/*` pasa sin interceptar; no‑401 pasa sin tocar
- [X] T021 Implementar `src/app/core/auth/refresh.interceptor.ts` (functional `HttpInterceptorFn`) con cola compartida (`BehaviorSubject<string | null>` + flag `refreshing`) según algoritmo de `research.md §3`

### Guards

- [X] T022 [TEST] Test unitario de `authGuard` y `publicOnlyGuard` en `src/app/core/guards/auth.guard.spec.ts` y `src/app/core/guards/public-only.guard.spec.ts`: `authGuard` permite si `isAuthenticated()`, si no devuelve `UrlTree` a `/login?returnUrl=<state.url>`; `publicOnlyGuard` permite si no autenticado, si no devuelve `UrlTree` a `/lobby`
- [X] T023 [P] Implementar `src/app/core/guards/auth.guard.ts` como `CanMatchFn` según `contracts/auth-service.md` §Guards
- [X] T024 [P] Implementar `src/app/core/guards/public-only.guard.ts` como `CanMatchFn` según `contracts/auth-service.md` §Guards

### Wiring de app (rutas + providers)

- [X] T025 Actualizar `src/app/app.config.ts`: registrar `provideHttpClient(withInterceptors([jwtInterceptor, refreshInterceptor]))` en ese orden; mantener providers de NgRx Store/Effects existentes
- [X] T026 Actualizar `src/app/app.routes.ts` con rutas top level `/login` (canMatch: `publicOnlyGuard`, lazy `LoginPageComponent`), `/register` (canMatch: `publicOnlyGuard`, lazy `RegisterPageComponent`), `/lobby` (canMatch: `authGuard`, placeholder lazy o redirect a `/login` si todavía no existe lobby), `''` → `'login'`, `**` → `'login'` según `contracts/auth-service.md` §Rutas
- [X] T027 [P] Crear `src/app/features/auth/auth.routes.ts` exportando `AUTH_ROUTES` para uso interno (si la app evoluciona hacia `loadChildren`; por ahora `loadComponent` directo es suficiente — mantener archivo aunque sólo re-exporte por simetría)

**Checkpoint**: Foundation lista — `pnpm build` y `pnpm test` pasan; rutas `/login` y `/register` resuelven a stubs vacíos (los componentes reales llegan en las historias).

---

## Phase 3: User Story 1 - Entrar como invitado para jugar al instante (Priority: P1) 🎯 MVP

**Goal**: Un visitante sin sesión pulsa "Jugar como invitado" desde `/login` y queda autenticado con `isGuest=true`, redirigido al lobby. Tras recargar, la sesión persiste mientras el `accessToken` siga vivo.

**Independent Test**: Quickstart §1 — desde pestaña incógnita, pulsar el CTA de invitado y verificar (a) `tt3.session` con `isGuest: true`, `refreshToken: null`, `playerId` UUID; (b) próxima request protegida lleva `Authorization: Bearer <jwt>`; (c) tras `F5`, la sesión sigue activa.

### Tests para User Story 1

- [X] T028 [P] [US1] Test del componente `GuestCtaComponent` en `src/app/features/auth/components/guest-cta/guest-cta.component.spec.ts`: click dispara `authService.guest()` mockeado, muestra spinner mientras está pendiente, navega a `/lobby` (o `returnUrl`) tras éxito, muestra error vía `mapApiError` ante fallo
- [X] T029 [P] [US1] Test de integración del flujo invitado en `src/app/features/auth/pages/login-page/login-page.guest.spec.ts`: la página renderiza el CTA, click → `setSession` con `isGuest=true` → `Router.navigate(['/lobby'])`

### Implementation para User Story 1

- [X] T030 [P] [US1] Crear `src/app/features/auth/components/guest-cta/guest-cta.component.ts` (standalone, Material `mat-button` + `mat-progress-spinner` inline) que inyecta `AuthService` y `Router`, expone `loading` signal, consume `returnUrl` opcional como `@Input()`
- [X] T031 [P] [US1] Crear estilos del CTA en `src/app/features/auth/components/guest-cta/guest-cta.component.scss` alineados al prototipo `public/referencias/Truco a 3 - Prototipo clickable.html` (paleta + jerarquía)
- [X] T032 [US1] Crear `src/app/features/auth/pages/login-page/login-page.component.ts` (esqueleto standalone) con `<app-guest-cta>` ya integrado y lectura de `returnUrl` desde query params; el formulario de login se completa en US2 (mismo archivo)
- [X] T033 [P] [US1] Crear `src/app/features/auth/pages/login-page/login-page.component.html` con el layout de bienvenida (título, CTA invitado, link a `/register`) según prototipo; el bloque del form de login se añade en US2
- [X] T034 [P] [US1] Crear `src/app/features/auth/pages/login-page/login-page.component.scss` con la paleta/tipografía del prototipo

**Checkpoint**: US1 completa — Quickstart §1 ejecutable manualmente; `pnpm test` verde para CTA y página.

---

## Phase 4: User Story 2 - Iniciar sesión con cuenta existente (Priority: P1)

**Goal**: Usuario registrado entra desde `/login` con identificador + contraseña, queda autenticado con `isGuest=false` y los tokens persistidos. El refresh transparente cubre tokens expirados durante la sesión.

**Independent Test**: Quickstart §2 — completar credenciales válidas, ver `tt3.session` con `isGuest: false` y `refreshToken` poblado; credenciales inválidas muestran error sin persistir tokens. Quickstart §4 — un `accessToken` truncado dispara `POST /api/auth/refresh` único y retry transparente.

> El núcleo del refresh transparente vive en Phase 2 (`refreshInterceptor` + `AuthService.refresh`); aquí solo se valida end‑to‑end con el formulario de login.

### Tests para User Story 2

- [X] T035 [P] [US2] Test del formulario de login en `src/app/features/auth/pages/login-page/login-page.login.spec.ts`: validación inline (`username` requerido, `password` requerido `minLength(5)`), botón disabled durante request, `mapApiError` en 401 → muestra "Usuario o contraseña incorrectos", éxito navega a `returnUrl` (o `/lobby`)
- [X] T036 [P] [US2] Test e2e‑lite del refresh en `src/app/core/auth/refresh.interceptor.flow.spec.ts` (si no quedó cubierto en T020): simular request real → 401 → refresh OK → retry con nuevo token; preserva orden y reanuda requests encoladas

### Implementation para User Story 2

- [X] T037 [US2] Extender `src/app/features/auth/pages/login-page/login-page.component.ts` con `FormGroup` tipada (`username`, `password`), validadores Reactive Forms según `data-model.md §6`, `submit()` que llama `authService.login()`, maneja loading y errores vía `mapApiError`, redirige a `returnUrl` post‑éxito
- [X] T038 [US2] Extender `src/app/features/auth/pages/login-page/login-page.component.html` con `<form>` Material (`mat-form-field` para usuario y password, `mat-error` inline, botón con spinner) según prototipo
- [X] T039 [US2] Ajustar `src/app/features/auth/pages/login-page/login-page.component.scss` para integrar visualmente el formulario con el CTA invitado existente

**Checkpoint**: US2 completa — Quickstart §2 y §4 ejecutables; tests verdes para formulario y refresh.

---

## Phase 5: User Story 3 - Crear una cuenta nueva (Priority: P2)

**Goal**: Visitante completa formulario en `/register` con datos válidos; tras el alta queda autenticado en la misma sesión (`isGuest=false`) sin pasar por login.

**Independent Test**: Quickstart §3 — registrar usuario nuevo con datos válidos redirige al lobby; registrar con `username` repetido muestra error inline `'username-taken'`; validación cliente (tilde, password corta) bloquea antes del backend.

### Tests para User Story 3

- [X] T040 [P] [US3] Test del formulario de registro en `src/app/features/auth/pages/register-page/register-page.component.spec.ts`: validación inline completa (`username` `[A-Za-z0-9]+`, ≥3 letras; `password` ≥5 chars, ≥1 número, ≥1 símbolo), envío exitoso → `setSession` + navegación a `/lobby`, error 422 `username-taken` se mapea a error inline en el campo `username`

### Implementation para User Story 3

- [X] T041 [P] [US3] Crear validadores custom `src/app/core/auth/validators.ts`: `minLettersValidator(n)`, `passwordStrengthValidator` (≥1 número y ≥1 símbolo) — reusables por login y register
- [X] T042 [US3] Crear `src/app/features/auth/pages/register-page/register-page.component.ts` (standalone) con `FormGroup` tipada, validadores nativos + custom de T041, `submit()` que llama `authService.register()`, manejo de loading/errores con `mapApiError`, navegación a `returnUrl` post‑éxito
- [X] T043 [P] [US3] Crear `src/app/features/auth/pages/register-page/register-page.component.html` con formulario Material según prototipo (mismo estilo que login)
- [X] T044 [P] [US3] Crear `src/app/features/auth/pages/register-page/register-page.component.scss` consistente con login-page

**Checkpoint**: US3 completa — Quickstart §3 ejecutable; los tres flujos funcionan independientemente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cierre, verificaciones de SC‑005/SC‑006/SC‑007 y limpieza final.

- [X] T045 [P] Implementar UI de logout: agregar acción "Salir" disponible en el shell autenticado (por ej. botón en `app.component.html` cuando `isAuthenticated()`); al click llama `authService.logout()` y navega a `/login`
- [X] T046 [P] Verificar SC‑005: ejecutar `pnpm exec grep -RIn "username" src/app/core/models` y confirmar que `username` solo aparece como campo de form/credenciales, no como identidad de sesión
- [X] T047 [P] Verificar SC‑006: ejecutar `pnpm exec grep -RIn "refreshToken" src/app` y confirmar que solo aparece en `core/auth/` y `core/models/auth.models.ts`
- [X] T048 [P] Verificar SC‑007: confirmar manualmente (DevTools) que tras logout no quedan claves `tt3.*` en `localStorage`
- [X] T049 [P] Verificar constraint del plan: ejecutar `pnpm exec grep -RIn "localStorage" src/app` y confirmar que solo aparece en `session-storage.service.ts`
- [X] T050 Pasar `pnpm lint` y `pnpm format` al diff completo; corregir warnings
- [X] T051 Ejecutar `pnpm build` y verificar que el bundle de `/login` no incluye el chunk de lobby (lazy loading correcto)
- [X] T052 Ejecutar checklist completo de `specs/001-auth-models-foundation/quickstart.md` (10 secciones) y marcar resultados; corregir defectos encontrados

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — empieza inmediatamente.
- **Foundational (Phase 2)**: depende de Setup. **Bloquea TODAS las historias.**
- **User Stories (Phase 3, 4, 5)**: dependen de Foundational completa.
  - **US1 (P1)** y **US3 (P2)** son independientes entre sí — pueden ir en paralelo.
  - **US2 (P1)** comparte archivo `login-page.component.ts` con **US1** → US2 va después de US1 (o el mismo developer trabaja ambas en secuencia).
- **Polish (Phase 6)**: depende de las tres historias completas.

### Dentro de Phase 2 (orden interno)

- T005‑T009 (modelos) son `[P]` entre sí.
- T010‑T013 (storage + tokens + mapper) son `[P]` entre sí; pueden ir junto con modelos.
- T014‑T015 (AuthStore) requieren modelos (T008, T009) y storage (T010, T011).
- T016‑T017 (AuthService) requieren AuthStore (T015) y modelos.
- T018‑T021 (interceptores) requieren AuthService (T017) y AuthStore.
- T022‑T024 (guards) requieren AuthStore (T015).
- T025‑T027 (wiring) requieren interceptores y guards.

### Dentro de cada historia

- Tests `[TEST]` se escriben antes (deben fallar) y luego se hace verde con la implementación.
- US1: T028‑T029 antes; luego T030‑T031 (CTA) en paralelo, después T032‑T034 (página).
- US2: T035‑T036 antes; luego T037‑T039 secuenciales (mismo archivo).
- US3: T040 antes; T041 antes que T042 (validadores son dependencia); T043‑T044 en paralelo con T042 si UI/lógica se separan, si no secuencial.

### Parallel Opportunities

- Toda Phase 2 sección "Modelos" (T005‑T008) corre en paralelo.
- T010, T011, T012, T013 corren en paralelo entre sí y con los modelos.
- T019 y T023/T024 corren en paralelo una vez listo AuthStore.
- US1 y US3 corren en paralelo (developers distintos).
- Todas las tareas `[P]` dentro de una historia corren en paralelo.
- Todo Phase 6 marcado `[P]` corre en paralelo.

---

## Parallel Example: Phase 2 (Modelos + Storage)

```bash
# Lanzar en paralelo los cimientos de tipos y storage:
Task: "Crear src/app/core/models/enums.ts"
Task: "Crear src/app/core/models/match.models.ts"
Task: "Crear src/app/core/models/ws.models.ts"
Task: "Crear src/app/core/models/auth.models.ts"
Task: "Crear src/app/core/auth/session-storage.service.ts"
Task: "Crear src/app/core/auth/auth.tokens.ts"
Task: "Crear src/app/core/auth/map-api-error.ts"
```

## Parallel Example: US1 + US3

```bash
# Developer A trabaja US1:
Task: "Crear GuestCtaComponent en src/app/features/auth/components/guest-cta/"
Task: "Esqueleto LoginPageComponent en src/app/features/auth/pages/login-page/"

# Developer B trabaja US3 simultáneamente:
Task: "Validators custom en src/app/core/auth/validators.ts"
Task: "RegisterPageComponent en src/app/features/auth/pages/register-page/"
```

---

## Implementation Strategy

### MVP First (User Story 1 únicamente)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (bloquea todo).
3. Completar Phase 3: US1 (invitado).
4. **STOP & VALIDATE**: Quickstart §1.
5. Demo: cualquier visitante puede entrar al lobby como invitado.

### Incremental Delivery

1. Phase 1 + Phase 2 → cimientos listos.
2. + US1 → primer demo (entrar como invitado).
3. + US2 → demo de login + refresh transparente verificable.
4. + US3 → registro disponible; flujo completo.
5. Polish → verificaciones SC‑005/006/007 + logout en shell.

### Parallel Team Strategy

Con dos developers:

1. Ambos colaboran en Phase 1 + Phase 2 (un dev modelos+storage+store, otro service+interceptores+guards).
2. Tras Phase 2:
   - Dev A: US1 (CTA invitado + esqueleto login-page).
   - Dev B: US3 (register-page + validators) — toca archivos distintos.
3. US2 cuando US1 termine (mismo archivo que US1) — Dev A continúa.
4. Ambos colaboran en Phase 6.

---

## Notes

- `[P]` = archivos distintos, sin dependencias en curso.
- `[Story]` mapea cada tarea a una historia (trazabilidad).
- Tests `[TEST]` deben fallar antes de implementar (TDD donde se aplica).
- El núcleo del refresh transparente (FR‑011, FR‑012, FR‑013) vive en Phase 2 — US2 sólo lo valida end‑to‑end con el form de login.
- Logout (FR‑010) vive en Phase 2 (`AuthService.logout`) y la UI se ata en Phase 6 (T045).
- `accessTokenExpiresAt` se mantiene **solo en memoria**; no se persiste (research §2).
- Cualquier acceso a `localStorage` fuera de `SessionStorageService` es violación del plan: cubierto por T049.
