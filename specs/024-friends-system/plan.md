# Implementation Plan: Sistema de amigos (MVP solo amistades)

**Branch**: `024-friends-system` | **Date**: 2026-06-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/024-friends-system/spec.md`

## Summary

Construir una sección de amigos dedicada en `/friends` (protegida por `authGuard`) con tres
vistas — Amigos, Solicitudes recibidas y Solicitudes enviadas — que permita enviar/aceptar/
rechazar/cancelar solicitudes y listar/eliminar amigos, todo identificando al otro jugador por
`username`. El estado se bootstrapea por REST (`/api/social/...`) y se reconcilia en tiempo real
con los eventos del canal WebSocket `/user/queue/social`, sin recargar la página. La capa social
del backend ya está completa; el front solo consume el contrato (`docs/CONTRATOS_API.md §7.5`,
`§8.2`, `§9.5e`) sin modificarlo. Solo para usuarios registrados (guests excluidos).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Angular 21 (componentes standalone, sin NgModules)

**Primary Dependencies**: Angular Material (tabs, icon, dialog, snackbar), `@stomp/stompjs` +
SockJS vía `WebSocketService`, NgRx Signals (`signalStore`) para el estado social reactivo,
RxJS para los flujos HTTP/WS.

**Storage**: N/A en el front (no se persiste estado social en `localStorage`). La fuente de verdad
es el backend; el front mantiene estado en memoria reconciliado por REST + WS.

**Testing**: Vitest (unit + component) y, si corresponde, contract test que verifique paridad de
los DTOs sociales con `docs/CONTRATOS_API.md` en `src/tests/contract/`.

**Target Platform**: Web (mobile-first 360 px+ y desktop 1024 px+), navegadores modernos.

**Project Type**: Single project — frontend Angular standalone bajo `src/app/`.

**Performance Goals**: Reflejar una aceptación remota en la lista en < 3 s (SC-002) reusando el
push WS existente; bootstrap de las tres listas en una sola tanda de requests al entrar a `/friends`.

**Constraints**: Copy de errores siempre desde catálogo del front (`getErrorCopy`), nunca
`ApiError.message`. SCSS solo con tokens `var(--t3-…)`. Botones `t3-btn` (no Material crudos).
`:hover` gateado tras `@media (hover: hover)`. Único breakpoint `@media (min-width: 1024px)`.

**Scale/Scope**: 1 ruta nueva, 1 feature (`features/social/`), ~3 servicios (api + store/notif),
1 página con tabs, ~3–4 componentes de lista/fila, tipos de modelo + extensión de `ws.models.ts`,
catálogo de copy social.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: Todo el SCSS de la feature usará `var(--t3-…)`; si falta un token (ej. estado
>   "online"/badge), se agrega primero en `src/styles.scss`. Verificación: `pnpm lint:styles`.
> - [x] **Validación de contrato**: Los DTOs sociales (`FriendSummaryResponse`,
>   `IncomingFriendshipRequestResponse`, `OutgoingFriendshipRequestResponse`) y los payloads WS
>   (`§9.5e`/`§9.6`) se tipan campo a campo contra `docs/CONTRATOS_API.md §7.5/§8.2/§9`. Se evalúa
>   un contract test de paridad en `src/tests/contract/`.
> - [x] **CTAs verticales**: No aplican CTAs título+subtítulo en esta feature (las acciones son
>   botones simples por fila: Aceptar/Rechazar/Cancelar/Eliminar). Se usan variantes `t3-btn`.
> - [x] **Copy de errores**: Se añade scope `SOCIAL` a `getErrorCopy()`; ningún path muestra
>   `ApiError.message` crudo.
> - [x] **Reglas de juego**: No se toca scoring ni `gamesToPlay` (feature puramente social).

**Resultado**: PASS — sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/024-friends-system/
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Phase 0 — decisiones técnicas
├── data-model.md        # Phase 1 — entidades, DTOs, eventos, transiciones
├── quickstart.md        # Phase 1 — cómo correr/probar la feature
├── contracts/
│   └── social-api.md     # Phase 1 — contrato REST + WS social consumido por el front
├── checklists/
│   └── requirements.md  # Checklist de calidad del spec (ya generado)
└── tasks.md             # Phase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src/app/
├── core/
│   └── models/
│       ├── social.models.ts          # NUEVO: DTOs REST + tipos de dominio social
│       └── ws.models.ts              # EDITAR: definir SocialWsEvent y sumarlo a WsEvent
├── features/
│   └── social/                       # NUEVA feature
│       ├── social.routes.ts          # (opcional) o ruta directa en app.routes.ts
│       ├── models/
│       │   └── social-view.models.ts # ViewModels de UI si hacen falta
│       ├── services/
│       │   ├── social-api.service.ts        # REST: requests/friendships
│       │   ├── social-api.service.spec.ts
│       │   ├── social.store.ts              # signalStore: 3 listas + reconciliación
│       │   └── social.store.spec.ts
│       ├── pages/
│       │   └── friends-page/
│       │       ├── friends-page.component.{ts,html,scss,spec.ts}
│       └── components/
│           ├── add-friend-form/      # input username + enviar solicitud
│           ├── friend-row/           # fila de amigo con acción Eliminar
│           ├── incoming-request-row/ # fila con Aceptar / Rechazar
│           └── outgoing-request-row/ # fila con Cancelar
├── shared/
│   └── error-copy/
│       └── error-copy.ts             # EDITAR: agregar scope 'SOCIAL'
└── app.routes.ts                     # EDITAR: ruta /friends con authGuard
```

**Structure Decision**: Single project Angular. Se crea una feature autónoma `features/social/`
siguiendo el mismo layout que `features/profile/` y `features/lobby/` (carpetas `services/`,
`pages/`, `components/`, `models/`). El estado vivo se centraliza en un `social.store.ts`
(`signalStore`) que combina bootstrap REST + reconciliación WS, evitando dispersar la lógica en la
página. La suscripción WS reutiliza el patrón gateado de `ProfileNotificationService`
(suscribir solo si `isAuthenticated && !isGuest`).

## Phase 0 — Research

Ver [research.md](./research.md). Resuelve: ubicación del estado (store vs servicio), estrategia de
reconciliación idempotente de las tres listas, manejo de eventos WS que afectan a varias listas
(p. ej. `FRIEND_REQUEST_ACCEPTED` mueve de "enviadas" a "amigos"), gateo de guests, punto de
entrada en la navegación y scope de copy de errores.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): entidades de dominio, DTOs REST tipados, unión
  `SocialWsEvent`, y la tabla de transición evento → mutación de listas.
- [contracts/social-api.md](./contracts/social-api.md): endpoints REST consumidos y eventos WS,
  con métodos/paths/códigos de error mapeados al catálogo de copy.
- [quickstart.md](./quickstart.md): cómo levantar y verificar la feature manualmente y con tests.
- Actualización del contexto del agente: `CLAUDE.md` (bloque SPECKIT) apunta a este plan.

## Complexity Tracking

> No aplica — Constitution Check PASS sin violaciones.
