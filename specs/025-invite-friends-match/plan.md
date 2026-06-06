# Implementation Plan: Invitar a partida a los amigos

**Branch**: `025-invite-friends-match` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-invite-friends-match/spec.md`

## Summary

Permitir que un jugador registrado invite a amigos confirmados a su partida privada, desde
dos entradas (la pantalla de espera de la partida y la página de amigos), aprovechando los
nuevos campos de disponibilidad de amigos (`availability` / `busyReason` / `online`) y los
eventos de reconciliación en vivo del canal social. El destinatario recibe la invitación
como toast en vivo y, al aceptar, el backend lo une a la partida y la redirección la maneja
la presencia ya existente. Spectate queda fuera de alcance.

Enfoque técnico: **extender la feature social existente (024)** en lugar de crear una vertical
nueva. La misma suscripción `/user/queue/social` ya está montada en `SocialStore`; se le
agregan los eventos `RESOURCE_INVITATION_*` y `FRIEND_AVAILABILITY_*`, el estado de
disponibilidad sobre la lista de amigos, la lista de invitaciones enviadas, y la señal de
toast de invitación recibida. La capa REST se amplía con los endpoints de invitaciones a
recurso. La UI agrega un selector de amigo-a-invitar reutilizable por ambas entradas, y un
host de toast de invitación a nivel app.

## Technical Context

**Language/Version**: TypeScript 5.x / Angular 21 (componentes standalone, sin NgModules)

**Primary Dependencies**: NgRx Signals (`signalStore`), Angular Material, `@stomp/stompjs` +
SockJS (WebSocket/STOMP), RxJS

**Storage**: N/A en cliente (estado en memoria vía signals; `localStorage` sólo para auth y
`joinCode` ya existentes). El backend es la autoridad de invitaciones/disponibilidad.

**Testing**: Vitest (unit + contract). Contract tests en `src/tests/contract/` parsean
`docs/CONTRATOS_API.md` y verifican paridad de DTOs vía `satisfies`.

**Target Platform**: Web (mobile portrait 360–599px y desktop 1024px+; un único breakpoint
`@media (min-width: 1024px)`). Landscape mobile fuera de scope.

**Project Type**: Single web app (Angular SPA). Estructura `src/app/{core,shared,features}`.

**Performance Goals**: Reflejar invitaciones recibidas y cambios de disponibilidad en ≤2s
sin recarga (SC-002, SC-006); envío de invitación en ≤3 toques (SC-001).

**Constraints**: Copy de error siempre del catálogo del front (`getErrorCopy`), nunca
`ApiError.message`. SCSS de feature sólo con tokens `var(--t3-…)`. CTAs tematizados
(`t3-btn`), nada de `mat-flat-button`. `:hover` gateado tras `@media (hover: hover)`.

**Scale/Scope**: Feature acotada; 1 store extendido, ~6 endpoints REST nuevos, 7 eventos WS
nuevos, 2–3 componentes UI nuevos + 2 puntos de entrada. Solo `targetType: MATCH`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: Los SCSS nuevos (selector de invitar, chips de disponibilidad, toast)
>   usan exclusivamente `var(--t3-…)`. Se verifica con `pnpm lint:styles`.
> - [x] **Validación de contrato**: Los DTOs de invitaciones y disponibilidad se tipan campo
>   a campo contra `docs/CONTRATOS_API.md §7.4.5/§7.4.7–7.4.13/§8.1–8.2/§9.5e/§9.6`. Se agrega
>   un contract test que valida la paridad de `CreateResourceInvitationPayload` /
>   `*ResourceInvitationResponse` / enums de disponibilidad.
> - [x] **CTAs verticales**: La acción "Invitar a partida" usa variantes `t3-btn`; si necesita
>   título + descripción, se apila con `flex-direction: column` y `var(--t3-gap-xs)`. No se usa
>   `mat-flat-button`.
> - [x] **Copy de errores**: Todo error de invitar/aceptar/cancelar pasa por `getErrorCopy`
>   (scope social) + el mapa de `busyReason` → copy del front. Nunca se muestra el mensaje BE.
> - [x] **Reglas de juego**: La feature no toca scoring ni `gamesToPlay`; la creación de
>   partida reusa el flujo existente (`BEST_OF_1/3/5 → 1/3/5`). Sin cambios de reglas.

**Resultado**: PASS. No hay violaciones; la sección Complexity Tracking queda vacía.

## Project Structure

### Documentation (this feature)

```text
specs/025-invite-friends-match/
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Fase 0 (/speckit-plan)
├── data-model.md        # Fase 1 (/speckit-plan)
├── quickstart.md        # Fase 1 (/speckit-plan)
├── contracts/           # Fase 1 (/speckit-plan)
│   └── social-invitations.md
├── checklists/
│   └── requirements.md  # (/speckit-specify)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src/app/
├── core/
│   ├── models/
│   │   ├── social.models.ts          # EXT: availability en FriendSummary + DTOs de invitación
│   │   └── ws.models.ts              # EXT: RESOURCE_INVITATION_* + FRIEND_AVAILABILITY_* en SocialWsEvent
│   └── services/
│       └── presence-coordinator.service.ts   # REUSO: presence() para target propio + navegación al aceptar
├── shared/
│   └── error-copy/
│       └── error-copy.ts             # EXT: copy de busyReason + casos de invitación (scope social)
└── features/
    ├── social/
    │   ├── services/
    │   │   ├── social-api.service.ts # EXT: create/accept/decline/cancel/list invitaciones
    │   │   └── social.store.ts       # EXT: disponibilidad + invitaciones enviadas + toast recibido
    │   ├── components/
    │   │   ├── invite-friend-picker/ # NUEVO: lista de amigos con disponibilidad + acción invitar
    │   │   ├── friend-row/           # EXT: indicador online + acción "Invitar a partida"
    │   │   └── invitation-toast/     # NUEVO: toast de invitación recibida (aceptar/rechazar)
    │   └── pages/
    │       └── friends-page/         # EXT: entrada "Invitar a partida" (US1b)
    ├── match/
    │   └── components/
    │       └── waiting-room/         # EXT: entrada "Invitar amigo" en la sala de espera (US1)
    └── lobby/
        └── pages/online-match-page/  # REUSO: destino de "crear partida" cuando no hay target (US1b)

src/tests/contract/
└── social-invitations.contract.spec.ts   # NUEVO: paridad DTOs/enums vs docs/CONTRATOS_API.md
```

**Structure Decision**: App Angular única (`src/app`). La feature se implementa extendiendo
la vertical `features/social` (mismo canal WS, la disponibilidad pertenece a los amigos) y
tocando puntos de entrada en `features/match/components/waiting-room` y
`features/social/pages/friends-page`. El toast de invitación recibida se monta como host a
nivel app (junto a la suscripción social ya iniciada) para que aparezca esté donde esté el
usuario.

## Complexity Tracking

> Sin violaciones de constitución. No aplica.
