# Implementation Plan: Cimientos de Autenticación y Modelos de Dominio

**Branch**: `001-auth-models-foundation` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-auth-models-foundation/spec.md`

## Summary

Reescribir la capa de modelos para alinearla al contrato real del backend (`docs/CONTRATOS_API.md`), reemplazar el `AuthStore` actual (basado en `token`/`username`) por uno que persista la sesión completa (`playerId`, `accessToken`, `refreshToken`, `accessTokenExpiresIn`, `isGuest`), y entregar la feature de Auth end‑to‑end: `AuthService` (register/login/guest/refresh/logout), pantallas `/login` y `/register` con CTA invitado, guard de rutas protegidas y refresh transparente de tokens (con cola para no disparar refreshes paralelos). El enfoque sigue las prácticas idiomáticas de Angular 21: componentes **standalone**, **signals** + `signalStore` para el estado, **interceptores funcionales** con `inject()`, **reactive forms tipadas**, rutas con `loadComponent` y `CanMatchFn` para lazy auth, y `Vitest` como runner.

## Technical Context

**Language/Version**: TypeScript ~5.9.2 (strict), targeting ES2022

**Primary Dependencies**: Angular 21.2 (standalone APIs), Angular Material 21, `@ngrx/signals` 21 (`signalStore`, `withState`, `withMethods`, `withHooks`), `@angular/common/http` con interceptores funcionales, Reactive Forms tipadas, RxJS 7.8

**Storage**: `localStorage` del navegador (per‑origin), encapsulado en un `SessionStorageService` para aislarlo del resto de la app (testabilidad + protección frente a corrupción/JSON inválido). No se contempla SSR en esta feature.

**Testing**: Vitest 4 + `@analogjs/vitest-angular` (configurado en el repo). Cobertura mínima por capa: pruebas unitarias para `AuthStore`, `AuthService`, `refreshInterceptor` y `authGuard`/`publicOnlyGuard`; pruebas de integración ligeras para los componentes de Login/Register usando `TestBed` y `HttpTestingController`.

**Target Platform**: SPA web (desktop + mobile) servida por `ng serve` en dev (`http://localhost:4200`) contra backend local en `http://localhost:8080/api`.

**Project Type**: Single‑project Angular SPA (sin backend en este repo). Estructura `src/app/` con `core/` (singletons), `features/` (lazy) y `shared/` (UI reusable).

**Performance Goals**: First Contentful Paint del bundle de `/login` ≤ 1.5 s sobre conexión 4G simulada en dev. El refresh transparente debe completarse en ≤ 500 ms p95 cuando el backend responde dentro de SLA.

**Constraints**:
- Estricta separación entre `core` (singletons) y `features` (lazy). Ningún componente fuera de `core/auth*` puede referenciar `refreshToken`.
- Los enums se exportan como `const`/`as const` (no `enum` de TypeScript) para mantener literales **case‑sensitive** que matcheen el contrato JSON sin transformación.
- Cero acceso directo a `localStorage` fuera de `SessionStorageService`.
- Las llamadas a `/api/auth/{register,login,guest,refresh}` NO deben pasar por la lógica de Bearer/refresh (ruta excluida en interceptores).

**Scale/Scope**: Esta feature es el cimiento; vive en un único módulo de feature lazy (`features/auth`). Volumen estimado: ~12–15 archivos nuevos/modificados, ≤ ~1.5 kLOC entre código y tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

El archivo `.specify/memory/constitution.md` está en estado plantilla (sin principios ratificados). Por lo tanto no existen "gates" formales que evaluar. Se aplican **default gates** prudentes para una feature de cimientos:

| Gate (default) | Estado | Notas |
|---|---|---|
| Single source of truth para modelos de dominio | ✅ | `core/models/` es el único barrel exportable. |
| Sin duplicación de estado de sesión | ✅ | `AuthStore` (signalStore) es el único; no hay NgRx classic `feature` paralelo. |
| Test‑first donde el riesgo lo amerita | ✅ | El `refreshInterceptor` y `AuthStore` se cubren con tests unitarios antes/junto al código. |
| Tipos estrictos del contrato | ✅ | Enums como union literal types tipados desde un único lugar. |
| Sin abstracciones prematuras | ✅ | No se introduce repository pattern, factories ni capa "domain‑service" extra; solo lo necesario. |

**Resultado**: pasa. No hay desviaciones que justificar; la sección **Complexity Tracking** se elimina.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-models-foundation/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — decisiones técnicas y alternativas
├── data-model.md        # Phase 1 — entidades, formas y validaciones
├── quickstart.md        # Phase 1 — cómo verificar la feature manualmente
├── contracts/
│   ├── auth-endpoints.md   # Contrato consumido (subset relevante de docs/CONTRATOS_API.md §3)
│   └── auth-service.md     # Contrato expuesto por AuthService al resto de la app
├── checklists/
│   └── requirements.md
└── tasks.md             # (lo generará /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── app.config.ts              # añade refreshInterceptor + APP_INITIALIZER de hidratación
│   ├── app.routes.ts              # /login, /register, redirects, lazy features
│   ├── core/
│   │   ├── auth/
│   │   │   ├── auth.service.ts            # register/login/guest/refresh/logout
│   │   │   ├── auth.store.ts              # signalStore (reemplaza al actual)
│   │   │   ├── auth.tokens.ts             # InjectionToken (rutas excluidas, etc.)
│   │   │   └── session-storage.service.ts # única puerta a localStorage
│   │   ├── guards/
│   │   │   ├── auth.guard.ts              # CanMatchFn (reemplaza CanActivateFn)
│   │   │   └── public-only.guard.ts       # bloquea /login y /register si hay sesión
│   │   ├── interceptors/
│   │   │   ├── jwt.interceptor.ts         # adapta a accessToken; skip de /api/auth/*
│   │   │   └── refresh.interceptor.ts     # 401 → refresh con cola, retry x1
│   │   ├── models/
│   │   │   ├── auth.models.ts             # AuthResponse, AuthSession, requests, errores
│   │   │   ├── match.models.ts            # MatchState, RoundState, Hand, Card, Seat
│   │   │   ├── ws.models.ts               # WsEvent<TPayload>, uniones por canal
│   │   │   ├── enums.ts                   # Suit, TrucoCall, EnvidoCall, ResponseEnums, MatchStatus, RoundStatus, AvailableActionType...
│   │   │   └── index.ts                   # barrel
│   │   ├── services/
│   │   │   └── websocket.service.ts       # (existente; sólo ajustes menores de tipos)
│   │   └── stores/                        # ← carpeta eliminada (movida a core/auth/)
│   ├── features/
│   │   └── auth/
│   │       ├── auth.routes.ts             # lazy routes de login/register
│   │       ├── pages/
│   │       │   ├── login-page/
│   │       │   │   ├── login-page.component.ts
│   │       │   │   ├── login-page.component.html
│   │       │   │   └── login-page.component.scss
│   │       │   └── register-page/
│   │       │       ├── register-page.component.ts
│   │       │       ├── register-page.component.html
│   │       │       └── register-page.component.scss
│   │       └── components/
│   │           └── guest-cta/             # botón "Jugar como invitado"
│   └── shared/                            # (sin cambios significativos)
└── environments/                          # (sin cambios)
```

Archivos a **eliminar/migrar**:
- `src/app/core/stores/auth.store.ts` → reemplazado por `src/app/core/auth/auth.store.ts`.
- `src/app/core/guards/auth.guard.ts` y `src/app/core/interceptors/jwt.interceptor.ts` → reescritos in‑place (mantienen path solo si ayuda al diff; las rutas finales son las del árbol nuevo).
- `src/app/core/models/index.ts` (legacy: `AuthResponse {token, username}`, `Player`, `Room`) → reemplazado por los módulos en `core/models/*` + barrel.

**Structure Decision**: SPA Angular single‑project. La capa de auth vive parcialmente en `core/auth/` (singletons providedIn: 'root') y parcialmente en `features/auth/` (UI lazy). Este split es la convención idiomática en Angular para evitar bundlear formularios en el shell inicial y para mantener el `AuthStore` como singleton accesible desde guards e interceptores.
