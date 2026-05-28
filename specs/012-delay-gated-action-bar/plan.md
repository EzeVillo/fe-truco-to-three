# Implementation Plan: Action bar bloqueada durante delay de eventos

**Branch**: `012-delay-gated-action-bar` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-delay-gated-action-bar/spec.md`

## Summary

Esta feature deshabilita visualmente el action bar (Truco/Envido/Mazo) y las cartas del jugador mientras la cola de eventos procesa eventos remotos con delay temporal (> 0ms). El panel de acciones colapsa directamente al ActionBarComponent principal, cerrando cualquier submenú o panel de respuesta abierto. Esto previene que el jugador tome decisiones basadas en información obsoleta durante la animación de eventos del rival.

## Technical Context

**Language/Version**: TypeScript 5.8, Angular 21

**Primary Dependencies**: Angular 21 (standalone components), Angular Signals, NgRx Signals (disponible pero no usado para match state)

**Storage**: N/A (estado en memoria via signals)

**Testing**: Vitest

**Target Platform**: Web (SPA), Mobile-first (360px+), Desktop (1024px+)

**Project Type**: Web application (frontend)

**Performance Goals**: Reacción a cambios de signal < 16ms (un frame de renderizado)

**Constraints**: Sin cambios en backend, sin nuevos endpoints, sin cambios en contrato WebSocket

**Scale/Scope**: Pantalla de match (1 componente página + 3-4 componentes afectados)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Tokens CSS**: Los componentes afectados (ActionBarComponent, PlayerHandComponent, AvailableActionsPanelComponent) ya usan tokens `var(--t3-…)`. No se agregarán estilos nuevos, solo se pasará una propiedad `disabled` existente.
- [x] **Validación de contrato**: No se consumen endpoints nuevos. Solo se consume un signal existente de `MatchEventQueueService`.
- [x] **CTAs verticales**: No aplica — no se crean CTAs nuevos.
- [x] **Copy de errores**: No aplica — no hay nuevos flujos de error.
- [x] **Reglas de juego**: No aplica — no se modifican reglas de scoring ni formato.

## Project Structure

### Documentation (this feature)

```text
specs/012-delay-gated-action-bar/
├── plan.md              # Este archivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - sin cambios de contrato)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (affected files)

```text
src/app/features/match/
├── services/
│   └── match-event-queue.service.ts     # Agregar signal isProcessingDelay
├── components/
│   └── available-actions-panel/
│       ├── available-actions-panel.component.ts   # Consumir isProcessingDelay, colapsar a action bar
│       ├── available-actions-panel.component.html # Modificar template para modo deshabilitado
│       ├── action-bar/
│       │   └── action-bar.component.ts  # Aceptar input isProcessingDelay
│       └── action-bar/
│           └── action-bar.component.html # Aplicar disabled a botones
├── components/
│   └── player-hand/
│       └── player-hand.component.ts     # Consumir isProcessingDelay para deshabilitar cartas
└── pages/
    └── match-screen/
        └── match-screen.component.ts    # Pasar isProcessingDelay al GameBoard
```

**Structure Decision**: Se modifica la estructura existente de componentes Angular standalone. No se crean nuevos archivos de servicio ni nuevos componentes. El cambio se distribuye en 5-6 archivos existentes.

## Complexity Tracking

No hay violaciones de la constitución que justificar.
