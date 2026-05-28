# Implementation Plan: Cola serial de eventos WebSocket de match

**Branch**: `010-ws-event-queue` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-ws-event-queue/spec.md`

## Summary

Introducir una **cola FIFO serial con delays por tipo de evento** entre el `WebSocketService` y la aplicación al estado/UI dentro de la pantalla de match. Los eventos remotos visibles (carta jugada por el rival, cantos, resultados) se procesan uno a uno con una pausa configurable (≥ 500 ms) entre cada uno, mientras que las acciones locales (eco del propio jugador) y los eventos no-match (chat, lobby, social) atraviesan sin delay. En reconexión o snapshot inicial, los eventos pendientes se aplican de una sola vez. La feature es **100 % cliente**: no toca contratos ni endpoints.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Angular 21 (standalone components, signals).

**Primary Dependencies**: Angular 21, NgRx Signals, `@stomp/stompjs` + `sockjs-client`, RxJS 7, Angular Material.

**Storage**: N/A (estado en memoria via `signal`; nada se persiste).

**Testing**: Vitest (unit + servicios). Sin tests E2E para esta feature; los acceptance scenarios se validan con tests unitarios sobre la nueva queue + verificación manual en bot match.

**Target Platform**: Web (Chromium/Edge/Firefox/Safari modernos). Mobile floor 360 × 780.

**Project Type**: Frontend single-project Angular (web SPA).

**Performance Goals**:
- Delay por defecto para eventos visibles remotos: 600 ms (carta del rival, canto del rival), 800 ms (resultados de envido/mano/fin de partida). Configurable.
- Acción local: feedback < 100 ms (sin delay).
- Drain de backlog (≥ 5 eventos) en reconexión: < 1 s total.

**Constraints**:
- No introducir cambios al contrato WebSocket ni REST.
- No romper el reducer existente (`match-event.reducer.ts`) ni la versión por `stateVersion`.
- Respetar la separación entre canal transaccional (`/user/queue/match`) y canal derivado (`/user/queue/match-derived`) — ambos deben pasar por la misma cola para preservar orden causal (FR-007).
- Aislar el delay al feature `match`: no afectar `/user/queue/chat`, `/user/queue/lobby`, `/user/queue/social`, etc.

**Scale/Scope**:
- 1 servicio nuevo (`MatchEventQueueService`).
- 1 archivo de configuración (`match-event-delays.config.ts`).
- Refactor focalizado en `MatchStateService` para enrutar eventos vivos a la cola.
- 0 cambios en componentes consumidores (siguen suscribiendo `matchEvent$`, `gameWon$`, etc.).

## Constitution Check

*GATE: Pasado para Phase 0.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: La feature no introduce SCSS nuevo (sólo lógica TS). N/A para `lint:styles`.
> - [x] **Validación de contrato**: No se modifican DTOs ni endpoints; los tipos de evento existentes (`MatchWsEvent`, `MatchDerivedEvent`) ya están alineados con `docs/CONTRATOS_API.md`. No requiere nuevos contract tests.
> - [x] **CTAs verticales**: No se tocan templates de CTA.
> - [x] **Copy de errores**: La cola no produce errores nuevos visibles al usuario; en fallo silencioso (que no debería ocurrir) se loguea con `console.warn` sin tocar UI.
> - [x] **Reglas de juego**: La cola no toca `gamesToPlay`, scoring ni series.

Sin violaciones a justificar.

## Project Structure

### Documentation (this feature)

```text
specs/010-ws-event-queue/
├── plan.md              # Este archivo
├── spec.md              # Spec de la feature
├── research.md          # Phase 0: decisiones de diseño
├── data-model.md        # Phase 1: entidades en memoria (cola + ítem)
├── quickstart.md        # Phase 1: cómo verificar la feature manualmente
├── contracts/
│   └── match-event-queue.contract.md   # Contrato interno del servicio
└── checklists/          # (preexistente)
```

### Source Code (repository root)

```text
src/app/features/match/
├── config/
│   └── match-event-delays.config.ts        # NUEVO: mapa eventType → delay
├── services/
│   ├── match-event-queue.service.ts        # NUEVO: FIFO + worker con delays
│   ├── match-event-queue.service.spec.ts   # NUEVO: tests unitarios
│   ├── match-state.service.ts              # MODIFICADO: enrutar live events a la queue
│   └── match-state.service.spec.ts         # MODIFICADO: ajustar mocks/expectativas
├── models/
│   └── match-ws-events.ts                  # (sin cambios)
├── reducers/
│   └── match-event.reducer.ts              # (sin cambios)
└── pages/match-screen/
    └── match-screen.component.ts           # (sin cambios — sigue suscribiendo a los mismos $)
```

**Structure Decision**: Single-project Angular. La feature vive enteramente dentro de `src/app/features/match/`. No se crean carpetas top-level nuevas. El servicio nuevo se provee a nivel de `MatchStateService` (mismo scope, `providers: [MatchStateService]` en `MatchScreenComponent`) para que su ciclo de vida termine al salir del match (FR-011).

## Complexity Tracking

*(No hay violaciones a la constitution; sección vacía intencional.)*
