# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, etc.) when working with code in this repository.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/027-chat-online-match/plan.md`
<!-- SPECKIT END -->

## Reglas del juego (truco-to-three)

Este proyecto es una **variante propia de truco** con una mecánica de puntaje distinta a las variantes tradicionales (criollo, argentino, uruguayo). Las reglas clave que afectan al producto:

- **Una partida individual se gana llegando a exactamente 3 puntos**. Es lo que da nombre al proyecto (`truco-to-three`).
- **Pasarse de 3 puntos hace perder** la partida (regla de "punto exacto"). Esto debe reflejarse en la UI del marcador, en validaciones de scoring y en cualquier copy que explique la modalidad.
- Las **series** (cuando se ofrecen) son **mejor de 1, 3 o 5 partidas**. "Mejor de 1" = partida única; "mejor de 3" = primero a 2 partidas ganadas; "mejor de 5" = primero a 3 partidas ganadas.
- El formato por defecto de una serie es **"mejor de 3"** cuando hay que elegir un default sensato.

Estas reglas son del dominio del producto, no preferencias visuales: cualquier feature que toque scoring, formato de partida o selectores de "a cuántas" debe respetarlas.

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

# Lint de estilos — SCSS bajo features/ y shared/components/ (verifica colores hardcodeados)
pnpm lint:styles

# Lint de templates — detecta mat-flat-button / mat-raised-button / color="primary|accent|warn"
pnpm lint:themes

# Formatear código
pnpm format
```

> El gestor de paquetes es **pnpm** (v11). No usar npm ni yarn.

## Diseño Responsivo

La aplicación soporta dos tamaños de pantalla. El ancho mínimo soportado es **360 px**.

| Nombre  | Resolución de referencia | Rango de ancho   |
|---------|--------------------------|------------------|
| Mobile  | 360 × 780                | 360 px – 1023 px |
| Desktop | 1440 × 900               | 1024 px+         |

> El modo paisaje en mobile (landscape) no es un caso de uso contemplado en este proyecto.
> No agregar media queries de `max-height` ni sub-breakpoints dentro del rango mobile;
> mobile-first con un único `@media (min-width: 1024px)` para escalar a desktop.

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

## Guardarraíles — Reglas Obligatorias

### 1. Design tokens obligatorios en SCSS de features y shared/components

**Todo** color, espaciado, radio de borde y sombra en los archivos SCSS bajo `src/app/features/**/*.scss` y `src/app/shared/components/**/*.scss` **debe** usar exclusivamente tokens CSS del proyecto (`var(--t3-…)`). Está prohibido usar:

- Colores hexadecimales (`#fff`, `#1a1a1a`, etc.)
- Funciones de color literales (`rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`) directamente como valor de propiedad
- Colores nombrados (`red`, `white`, `black`, etc.) — bloqueados por la regla `color-named: "never"` de stylelint

Los tokens están definidos en `src/styles.scss`. Si se necesita un valor nuevo, primero **agregar el token** allí y luego consumirlo.

**Verificación**: `pnpm lint:styles` falla si se introducen colores hardcodeados. El glob cubre `src/app/{features,shared/components}/**/*.scss`. Corre automáticamente en el pre-commit via lint-staged.

### 2. Validación cruzada con `docs/CONTRATOS_API.md` antes de tipar/consumir endpoints

Antes de tipar un DTO o consumir un endpoint del backend, **verificar campo a campo** contra `docs/CONTRATOS_API.md`. Esta documentación es la fuente autoritativa del contrato REST + WebSocket.

Reglas específicas:
- `gamesToPlay` en `POST /api/matches/bot` acepta **exactamente** `{1, 3, 5}` (partidas totales de la serie). Nunca `2`.
- La función `seriesFormatToGamesToPlay()` en `src/app/core/models/match.models.ts` mapea: `BEST_OF_1 → 1`, `BEST_OF_3 → 3`, `BEST_OF_5 → 5`.
- Los tests de contrato en `src/tests/contract/` verifican la paridad entre los tipos TypeScript y el doc del contrato.

**Verificación**: `pnpm test` incluye los contract tests. Si se modifica `CreateBotMatchRequest` o `CreateBotMatchResponse`, el test `src/tests/contract/create-bot-match.contract.spec.ts` falla si hay divergencia con `docs/CONTRATOS_API.md §9.2`.

### 3. CTAs tematizados — prohibición de botones Material crudos

**Nunca** usar `mat-flat-button`, `mat-raised-button`, `mat-fab`, `mat-mini-fab` ni `color="primary|accent|warn"` en templates bajo `src/app/features/**` ni `src/app/shared/components/**`. Usar siempre las variantes tematizadas del producto:

| Variante | Clase CSS | Uso |
|----------|-----------|-----|
| Primaria | `t3-btn t3-btn--primary` | CTA principal ("Crear partida") |
| Neutral | `t3-btn t3-btn--neutral` | Acción secundaria ("Volver", "Cancelar") |
| Destructiva | `t3-btn t3-btn--destructive` | Acción peligrosa ("Salir", confirmar eliminación) |

**Verificación**: `pnpm lint:themes` (script `scripts/check-themed-templates.mjs`) falla si se detecta alguno de los patrones prohibidos en templates de feature o shared. Corre automáticamente en el pre-commit via lint-staged.

Para CTAs que tienen título y descripción apilados verticalmente:

- Usar `display: flex; flex-direction: column` en el elemento CTA.
- El título va en un `<span class="*-title">` y la descripción en un `<span class="*-subtitle">`.
- Altura máxima sugerida en mobile: ≤ 96 px.

### 4. `:hover` gateado tras `@media (hover: hover)`

**Todo** selector con la pseudo-clase `:hover` en SCSS bajo `src/app/features/**` y `src/app/shared/components/**` que cambie la apariencia (background, color, border) **debe** ir anidado dentro de un bloque `@media (hover: hover) { ... }`.

**Motivo**: en pantallas táctiles el estado `:hover` queda "pegado" tras un tap hasta que el usuario toca otro lado, dejando el control visualmente "seleccionado" sin haberlo tocado. Gatearlo lo restringe a punteros reales (mouse); desktop tiene `hover: hover`, así que se preserva intacto ahí.

- Patrón: `@media (hover: hover) { &:hover { … } }`.
- **No** gatear `:active` (feedback táctil válido, se limpia al soltar) ni `:focus-visible` (accesibilidad).

**Verificación**: `pnpm lint:hover` (script `scripts/check-hover-gating.mjs`) falla si detecta un `:hover` sin gatear. Corre automáticamente en el pre-commit via lint-staged.

### 5. Nunca mostrar mensajes de error crudos del backend

Nunca mostrar al usuario el campo `message` (ni equivalente) que venga del backend en respuestas de error. Toda copia visible debe salir de un **catálogo controlado en el front**, mapeado por código HTTP y/o `errorCode` del contrato `ApiError`.

**Motivo**: los mensajes del BE pueden filtrar detalles técnicos, no están localizados, no respetan el tono del producto y cambian sin coordinación con el front. El usuario lo pidió explícitamente al clarificar la feature `003-lobby-bots`.

- En interceptores, services y componentes que manejen errores HTTP/WebSocket, ignorar `ApiError.message` para UI.
- Mantener un mapa de códigos → copy en el front (por feature o compartido) y un fallback genérico cuando el código no esté catalogado.
- El mensaje crudo del BE puede ir a `console.error`/logs/telemetría, **nunca** a snackbars, toasts, banners o diálogos.
- Aplica también a errores de red (timeouts, offline): copy controlado del front.

## Memoria del agente — aprendizajes acumulados

> **Esta sección es la fuente única de memoria del proyecto.** Cuando el usuario pida "recordá X", se escribe acá (no en el sistema de memoria separado del harness). Mantener cada ítem conciso y verificar contra el código actual antes de afirmarlo como hecho.

### Design system (detalles operativos)

- Ancho mínimo: token `--t3-min-width` (360 px) aplicado a `body { min-width: var(--t3-min-width) }` en `src/styles.scss`. Tablet (600 px) **desestimado**, no es caso de uso.
- Logos: `public/icon2.png` (emblema circular grande, ej. card de auth), `public/icon.png` (versión chica T3 para el header).
- Inputs nativos en mobile: `font-size` ≥ **16 px** para evitar el zoom automático de iOS Safari.
- Header `app-header` (en `src/app/app.html`) es **sticky** y se muestra siempre; el bloque de logout sólo aparece autenticado.
- La paleta y todos los tokens `--t3-…` viven en `src/styles.scss` (fuente autoritativa de valores; no copiar hex sueltos a otros archivos).

### Reglas de juego (matiz de implementación)

- La modalidad **lobby vs bots** (feature `003`) es **1 vs 1** (usuario + 1 bot). Los selectores de "a cuántas" exponen series (1/3/5 partidas), nunca puntos de marcador estilo truco tradicional (15/30/falta).

### Lobby público (feature 021)

- El motor de reconciliación de lobbies públicos es **genérico y reusable**:
  `PublicLobbyStore<T>` en `src/app/shared/public-lobby/`. Encapsula "bootstrap REST paginado +
  deltas WS" (Map por id, dedup, idempotencia, tombstones para no resucitar bajas durante una carga
  en vuelo). El lobby de **matches** lo instancia en `features/lobby/services/public-match-lobby.store.ts`.
  Para **copas/ligas** públicas a futuro: instanciar el mismo motor con su `loadPage`
  (`GET /api/{cups,leagues}/public`) y su topic (`/topic/public-{cup,league}-lobby`), y escribir su
  propia card; **no** reescribir el reconcile ni generalizar la UI.
- Vive dentro de **"Jugar online"** (`lobby/online`), no es un modo nuevo. El toggle de visibilidad
  por defecto es **PRIVATE** (preserva el flujo previo). Unirse reusa `joinByCode`; las públicas
  arrancan solas al entrar el 2º jugador (sin `/start`).
- Race condition al unirse → **toast no bloqueante** (`MatSnackBar`, `panelClass: public-lobby-snackbar`),
  sin refresco forzado: la baja llega por el delta `PUBLIC_MATCH_LOBBY_REMOVED`.

### Contrato `gamesToPlay` (matiz)

- La descripción en `docs/CONTRATOS_API.md §9.2` ("Partidas a ganar para terminar el match") está **mal redactada**: el valor real es "partidas totales de la serie". El BE valida `{1, 3, 5}` y devuelve `422 InvalidGamesToPlayException` con cualquier otro valor (p. ej. `2` para `BEST_OF_3` → falla en runtime). Mapear siempre `BEST_OF_1 → 1`, `BEST_OF_3 → 3`, `BEST_OF_5 → 5`.
