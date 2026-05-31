# Implementation Plan: Sistema de logros

**Branch**: `016-achievement-system` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-achievement-system/spec.md`

## Summary

Implementar el sistema de logros para usuarios registrados: identidad visible persistida, perfil de jugador con estadisticas y logros, y avisos de desbloqueo en tiempo real. La implementacion se apoya en los contratos actualizados de autenticacion, perfil y WebSocket documentados en `docs/CONTRATOS_API.md`, manteniendo los invitados fuera del perfil de logros y tratando las partidas contra bots como no elegibles para desbloqueos visibles.

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21

**Primary Dependencies**: Angular standalone components, Angular Router, Angular HttpClient, Angular Material, NgRx Signals, RxJS, `@stomp/stompjs`

**Storage**: `localStorage` existente via `SessionStorageService` para sesion autenticada; sin persistencia local nueva para logros

**Testing**: Vitest via `pnpm test`; ESLint via `pnpm lint`; stylelint via `pnpm lint:styles`; theme lint via `pnpm lint:themes`; build via `pnpm build`

**Target Platform**: Aplicacion web frontend responsive, mobile desde 360 px y desktop desde 1024 px

**Project Type**: Single-page web application frontend

**Performance Goals**: Perfil visible en menos de 2 segundos bajo condiciones normales de uso; notificacion de logro visible en el siguiente ciclo de UI luego del evento recibido

**Constraints**: Usar solo tokens `var(--t3-...)` en SCSS de features/shared; no usar botones Material crudos prohibidos; no mostrar `ApiError.message`; validar DTOs contra `docs/CONTRATOS_API.md`; no cambiar reglas de truco-to-three

**Scale/Scope**: Un bounded context frontend nuevo de perfil/logros, ajustes de auth para `username`, una ruta de perfil, notificaciones globales de logros y tests unitarios/contrato enfocados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: La feature agregara SCSS solo bajo `src/app/features/profile/**` y, si aplica, `src/app/shared/components/**`; todo color/espaciado/radio/sombra debe usar `var(--t3-...)`. Verificar con `pnpm lint:styles`.
> - [x] **Validacion de contrato**: DTOs de auth, perfil y profile WS verificados contra `docs/CONTRATOS_API.md` secciones 3.1-3.5, 7.5 y 9.5f antes de tipar/consumir endpoints.
> - [x] **CTAs verticales**: La feature no requiere CTAs con titulo + descripcion apilados. Si se agregan acciones de volver/reintentar, deben usar clases `t3-btn`.
> - [x] **Copy de errores**: Los errores de perfil/auth deben mapearse con copy frontend; no se mostrara `ApiError.message`.
> - [x] **Reglas de juego**: No se modifican scoring ni formatos de serie. Logros de partidas contra bots se excluyen del flujo visible.

## Project Structure

### Documentation (this feature)

```text
specs/016-achievement-system/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- auth-profile-contract.md
|   `-- profile-ws-contract.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/app/
|-- app.routes.ts
|-- app.html
|-- core/
|   |-- auth/
|   |   |-- auth.models update through core/models/auth.models.ts
|   |   |-- auth.service.ts
|   |   `-- auth.store.ts
|   |-- models/
|   |   |-- auth.models.ts
|   |   |-- profile.models.ts
|   |   `-- ws.models.ts
|   `-- services/
|       `-- websocket.service.ts
|-- features/
|   `-- profile/
|       |-- pages/
|       |   `-- profile-page/
|       |       |-- profile-page.component.ts
|       |       |-- profile-page.component.html
|       |       |-- profile-page.component.scss
|       |       `-- profile-page.component.spec.ts
|       |-- services/
|       |   |-- profile-api.service.ts
|       |   |-- profile-notification.service.ts
|       |   `-- profile-notification.service.spec.ts
|       |-- models/
|       |   `-- achievement-catalog.ts
|       `-- utils/
|           |-- achievement-display.ts
|           `-- achievement-display.spec.ts
`-- shared/
    |-- components/
    |   `-- global-header/
    `-- error-copy/
        |-- error-copy.ts
        `-- error-copy.spec.ts
```

**Structure Decision**: Se agrega `features/profile` como bounded context de perfil/logros. Los contratos compartidos viven en `core/models` porque auth, rutas y notificaciones globales los consumen. La suscripcion global de logros queda en un servicio de feature provisto en root e inicializado desde el shell de la aplicacion para no acoplarla a la pantalla de match.

## Complexity Tracking

No hay violaciones constitucionales ni complejidad excepcional que justificar.

## Phase 0: Research

Ver [research.md](./research.md). Todas las decisiones quedan resueltas sin marcadores pendientes.

## Phase 1: Design & Contracts

Artefactos generados:

- [data-model.md](./data-model.md)
- [contracts/auth-profile-contract.md](./contracts/auth-profile-contract.md)
- [contracts/profile-ws-contract.md](./contracts/profile-ws-contract.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: El diseño limita cambios visuales a componentes de perfil/header/notificacion y exige tokens `var(--t3-...)`.
> - [x] **Validacion de contrato**: Los contratos de plan reflejan `docs/CONTRATOS_API.md` para auth username, `/api/auth/me`, `/api/profile/{username}` y `/user/queue/profile`.
> - [x] **CTAs verticales**: No se introducen botones Material crudos; acciones usan `t3-btn`.
> - [x] **Copy de errores**: Se agrega scope de error de perfil al catalogo frontend.
> - [x] **Reglas de juego**: No se tocan reglas de puntos exactos ni series; bots quedan excluidos de logros visibles.
