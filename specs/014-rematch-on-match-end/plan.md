# Implementation Plan: Revancha al terminar una partida

**Branch**: `014-rematch-on-match-end` | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-rematch-on-match-end/spec.md`

## Summary

Al terminar un match casual el backend abre una sesión de revancha y lo señala con eventos en
tiempo real (`REMATCH_AVAILABLE`, `REMATCH_OPPONENT_WANTS`, `REMATCH_CONFIRMED`,
`REMATCH_CLOSED_BY_LEAVE`, `REMATCH_EXPIRED`) sobre `/user/queue/match` con el `matchId` de la
partida **original**. Hoy, al recibir `MATCH_FINISHED/ABANDONED/FORFEITED`, el frontend abre el
modal de resultado (`GameWonDialogComponent`) y, al cerrarlo, navega al lobby — **descartando** los
eventos de revancha.

Esta feature integra la oferta de revancha **secuencialmente después** del modal de resultado: el
jugador primero cierra el resultado y **recién entonces** aparece la oferta (nunca simultánea), con
el **tiempo restante real** de la ventana (que puede haber empezado a correr antes). La oferta
muestra aceptar/salir, refleja en tiempo real la decisión del rival (quiere / rechazó-abandonó /
expiró) y, cuando ambos aceptan (`REMATCH_CONFIRMED`), navega automáticamente a la nueva partida
(`newMatchId`, ya `IN_PROGRESS`).

El frontend es **puramente reactivo**: no aplica reglas de negocio (no chequea liga/copa, no infiere
el motivo de fin, no agrega lógica de bot). Solo refleja los eventos que llegan y consulta el
snapshot de la sesión (`GET /api/matches/{matchId}/rematch`) para reconciliar y para decidir, al
cerrar el modal de resultado, si abrir la oferta o ir al lobby.

Enfoque técnico: tipar los payloads de los 5 eventos `REMATCH_*` y el DTO de la sesión contra el
contrato; **rutear los eventos `REMATCH_*` por un canal dedicado** en `MatchStateService` (fuera de
la cola ack-gated y de la reconciliación por `stateVersion`, research D1); concentrar el estado en
un `RematchStateService` (signal `session`); disparar las acciones REST en un `RematchApiService`
fino; renderizar la oferta como un **`RematchDialogComponent`** que se abre en el `afterClosed` del
modal de resultado (research D3); y re-inicializar la pantalla de partida ante el cambio de `matchId`
para la navegación a la revancha confirmada (research D4).

## Technical Context

**Language/Version**: TypeScript 5.x / Angular 21 (componentes standalone, signals)

**Primary Dependencies**: Angular Material (`MatDialog`), NgRx Signals (auth), `@stomp/stompjs` +
SockJS (WS/STOMP), RxJS. Sin nuevas dependencias.

**Storage**: N/A (estado de sesión en memoria vía signals; no se persiste)

**Testing**: Vitest (unit + contract). Patrón existente: `*.spec.ts` por componente/servicio/util y
`src/tests/contract/` para paridad con `docs/CONTRATOS_API.md`.

**Target Platform**: Navegador web (mobile portrait desde 360 px y desktop desde 1024 px)

**Project Type**: Single project — frontend Angular (`src/app/`)

**Performance Goals**: Reflejo de eventos percibido como inmediato (SC-003). Countdown de expiración
con tick de baja frecuencia (~200–250 ms), activo solo mientras la oferta está visible.

**Constraints**:
- La oferta aparece **después** de cerrar el modal de resultado, nunca simultánea (FR-001a); el
  countdown muestra el restante real (FR-009).
- Reflejo en tiempo real del estado del rival (SC-003); navegación automática a la nueva partida sin
  pasos manuales (SC-002).
- El backend es el árbitro: el FE no aplica reglas de negocio ni lógica de bot (FR-001, FR-002,
  FR-012); solo reacciona a eventos.
- `expiresAt` llega en **epochMillis** por WS (`REMATCH_AVAILABLE`) y en **ISO-8601** por REST
  (`GET …/rematch`, §4.17.3): normalizar a epochMillis en el cliente.
- Copy de errores del catálogo del front (`getErrorCopy`), nunca `ApiError.message` (FR-013).
- SCSS de feature solo con tokens `var(--t3-…)`; CTAs con `t3-btn` (no `mat-*-button`).
- DTOs verificados contra `docs/CONTRATOS_API.md` (§4.17, §9.5, §9.6, §8.2).

**Scale/Scope**: 1 momento de UI (fin de partida en `match-screen`), 2 jugadores. Cambio acotado:
~1 modelo nuevo, 2 servicios nuevos (API + estado), 1 diálogo nuevo, ajustes en `MatchStateService`
y `MatchScreenComponent`, 1 scope de copy de errores, tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Tokens CSS**: El `RematchDialogComponent` usa exclusivamente `var(--t3-…)`. Si falta un
  token, se agrega primero en `src/styles.scss`. ✅ (verificar con `pnpm lint:styles`).
- **II. Validación de contrato**: Los 5 eventos `REMATCH_*` (payloads §9.6), el DTO de sesión
  (§4.17.3) y los enums de `status`/choice (§8.2) se tipan campo a campo contra
  `docs/CONTRATOS_API.md`; nuevo contract test. Se documenta el dual-format de `expiresAt`
  (epochMillis WS vs ISO-8601 REST). ✅
- **III. CTAs título+descripción**: No aplica (botones de revancha son acciones simples). Se usan
  variantes `t3-btn t3-btn--primary` / `t3-btn--neutral`, nunca `mat-flat-button`. ✅
  (`pnpm lint:themes`).
- **Copy de errores**: Se agrega scope `REMATCH` a `getErrorCopy()`; ningún path muestra
  `ApiError.message`. ✅
- **Reglas de juego**: No se toca scoring ni `gamesToPlay`; la nueva partida hereda el formato del
  backend (el FE no lo calcula). ✅
- **Mobile floor / breakpoint único**: La oferta entra sin romper layout a 360 px con un único
  `@media (min-width: 1024px)`. ✅
- **Standalone components**: `RematchDialogComponent` es standalone. ✅

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [ ] **Tokens CSS**: oferta de revancha con `var(--t3-…)`. `pnpm lint:styles` verde.
> - [ ] **Validación de contrato**: eventos `REMATCH_*`, DTO de sesión y enums tipados contra
>   `docs/CONTRATOS_API.md` §4.17/§9.6/§8.2; contract test verde.
> - [ ] **CTAs tematizados**: botones con `t3-btn`; `pnpm lint:themes` verde (no `mat-*-button`).
> - [ ] **Copy de errores**: errores de revancha vía `getErrorCopy('REMATCH', …)`, sin
>   `ApiError.message`.
> - [ ] **Reglas de juego**: N/A (no se toca scoring/`gamesToPlay`).

**Resultado del gate**: PASS. Sin violaciones; no se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/014-rematch-on-match-end/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas
├── data-model.md        # Fase 1 — entidades/estado
├── quickstart.md        # Fase 1 — cómo probar/verificar
├── contracts/
│   └── rematch-ui-contract.md   # Contrato de consumo (REST + eventos de revancha)
└── checklists/
    └── requirements.md  # Checklist de calidad de la spec (ya existente)
```

### Source Code (repository root)

```text
src/app/
├── features/match/
│   ├── models/
│   │   ├── match-ws-events.ts        # + payloads RematchAvailable/OpponentWants/Confirmed/
│   │   │                             #   ClosedByLeave/Expired (los eventType ya existen)
│   │   └── rematch.models.ts         # NUEVO — RematchSession (vista cliente) + RematchSessionResponse (REST)
│   ├── services/
│   │   ├── match-state.service.ts    # + canal `rematch$` (rutea REMATCH_* fuera de cola/stateVersion)
│   │   ├── rematch-api.service.ts    # NUEVO — choose/leave/getSession (§4.17.1–3)
│   │   └── rematch-state.service.ts  # NUEVO — signal `session`, init por snapshot, accept()/leave(), vista
│   ├── utils/
│   │   └── rematch-view.ts           # NUEVO — derivar opponentChoice/expiry/flags + normalizar expiresAt
│   ├── components/
│   │   └── rematch-dialog/           # NUEVO — diálogo reactivo de la oferta (standalone)
│   └── pages/match-screen/           # afterClosed del modal de resultado: decidir oferta-vs-lobby;
│                                     # proveer servicios; viewContainerRef; navegación a newMatchId;
│                                     # re-init por cambio de matchId (paramMap)
├── shared/error-copy/
│   └── error-copy.ts                 # + scope 'REMATCH'
└── tests/contract/
    └── rematch.contract.spec.ts      # NUEVO — paridad con docs/CONTRATOS_API.md §4.17/§9.6
```

> `GameWonDialogComponent` **no** se modifica: la oferta es un diálogo aparte que `match-screen`
> abre en el `afterClosed` del modal de resultado (research D3).

**Structure Decision**: Single project Angular. Se reutiliza la arquitectura de la feature `match`:
`MatchStateService` como orquestador de WS (donde se añade el ruteo dedicado de `REMATCH_*`),
servicios REST finos al estilo `MatchActionsService`/`BotsApiService`, y `MatchScreenComponent` como
host que decide, al cerrar el modal de resultado, abrir el `RematchDialogComponent` o navegar al
lobby. La revancha agrega un servicio de estado acotado (`RematchStateService`) y un diálogo de
presentación; no introduce módulos ni rutas nuevas (reusa `match/:matchId`).

## Complexity Tracking

> No aplica — el Constitution Check pasa sin violaciones.
