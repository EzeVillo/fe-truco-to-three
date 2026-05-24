# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-auth-models-foundation/plan.md`
<!-- SPECKIT END -->

## Idioma de Trabajo (Spec Kit)

Todo artefacto generado por los skills de Spec Kit DEBE estar escrito en **español**: specs,
planes, tareas, checklists, research, data-model, contratos y cualquier otro documento generado.
Los títulos y descripciones de tests propuestos también en español.

El código fuente (clases, métodos, variables) puede permanecer en inglés según la convención
existente del proyecto.

## Comandos esenciales

```bash
# Instalar dependencias
pnpm install

# Servidor de desarrollo (http://localhost:4200)
pnpm start

# Build de producción
pnpm build

# Tests con Vitest
pnpm test

# Lint
pnpm lint
pnpm lint:fix

# Formatear código
pnpm format
```

> El gestor de paquetes es **pnpm** (v11). No usar npm ni yarn.

## Stack tecnológico

- **Angular 21** con componentes standalone (sin NgModules)
- **NgRx Signals** (`signalStore`) para estado reactivo de auth
- **NgRx Store + Effects** disponibles en `appConfig` para estado global futuro
- **Angular Material** para UI
- **@stomp/stompjs + SockJS** para WebSocket/STOMP en tiempo real
- **Vitest** como test runner (no Karma)
- **ESLint + Prettier** con Husky en pre-commit (via lint-staged)

## Arquitectura

### Estructura `src/app/`

```
core/
  guards/       # authGuard: redirige a /auth/login si no autenticado
  interceptors/ # jwtInterceptor: añade Bearer token a cada request HTTP
  models/       # Interfaces de dominio (Player, Room, AuthResponse, ApiError)
  services/     # WebSocketService: singleton para STOMP
  stores/       # AuthStore (NgRx Signals): token + username en localStorage
shared/         # Barrel exports para componentes/pipes/directivas reutilizables
environments/   # environment.ts (dev) / environment.prod.ts
```

### Estado de autenticación

`AuthStore` (`src/app/core/stores/auth.store.ts`) es el único store de auth. Persiste `auth_token` y `auth_username` en `localStorage`. Los componentes lo inyectan con `inject(AuthStore)` y leen señales (`store.token()`, `store.isAuthenticated()`).

El `jwtInterceptor` lee `AuthStore.token()` y añade `Authorization: Bearer <jwt>` a todas las requests HTTP automáticamente.

### WebSocket / STOMP

`WebSocketService` (`src/app/core/services/websocket.service.ts`) gestiona la conexión STOMP a `environment.wsUrl` via SockJS. La autenticación se pasa en el frame `CONNECT` como header `Authorization: Bearer <jwt>`.

Método clave: `subscribe<T>(destination: string): Observable<T>` — funciona tanto si ya está conectado como si no (espera la conexión internamente).

Suscripciones disponibles en el backend:
- `/user/queue/match` — eventos de partida
- `/user/queue/league` — eventos de liga
- `/user/queue/cup` — eventos de copa
- `/user/queue/chat` — mensajes de chat en tiempo real
- `/user/queue/social` — amistades e invitaciones
- `/user/queue/profile` — logros (`ACHIEVEMENT_UNLOCKED`)
- `/user/queue/match-spectate` — espectador (requiere header `matchId` en la `SUBSCRIBE`)
- `/topic/public-match-lobby`, `/topic/public-cup-lobby`, `/topic/public-league-lobby` — lobby público

### Backend

Base URL: `http://localhost:8080/api`

Todos los endpoints bajo `/api/**` (excepto auth y refresh) requieren `Bearer <jwt>`.

El contrato completo (REST + WebSocket + enums) está documentado en `docs/CONTRATOS_API.md`. Es la referencia autoritativa para tipos de payload, `eventType`, enums permitidos y flujos de reconexión.

Puntos críticos del contrato:
- Los enums son **case-sensitive** (ej. `ESPADA`, `QUIERO`, `FALTA_ENVIDO`)
- Las acciones de juego responden `204 No Content` (sin body)
- El lobby público se bootstrapea por REST y se reconcilia con deltas WebSocket
- Spectate se activa **solo por WebSocket** (no hay endpoint REST de alta)
- `expiresAt` en WS de revancha llega en `epochMillis`; en REST en ISO-8601

### Imágenes de cartas

Las cartas españolas están en `public/cards/` con formato `{número}_{palo}.png` (ej. `1_espada.png`, `7_oro.png`). El dorso es `dorso.png`. Palos válidos: `copa`, `espada`, `basto`, `oro`.
