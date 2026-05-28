# Implementation Plan: ACK del usuario gobierna el avance de la cola tras eventos que disparan modales

**Branch**: `011-ack-gated-event-queue` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-ack-gated-event-queue/spec.md`

## Summary

Extender la cola serial de eventos WS de match (feature 010) con un mecanismo de **pausa por ACK**: cuando se aplica un evento cuyo procesamiento abre un modal bloqueante (resultado de envido, ronda/mano ganada, partida ganada, serie ganada), la cola deja de programar el siguiente ítem hasta que el componente que abrió el modal llame `resumeAck()` (en `afterClosed()`). El resto de los eventos sigue avanzando con los delays temporales actuales. La lista de event types "potencialmente bloqueantes" vive en un único archivo de configuración (`match-blocking-events.config.ts`); la decisión final de pausar la toma el componente porque algunos casos del mismo `eventType` no abren modal (p. ej. `ENVIDO_RESOLVED` con `response = NO_QUIERO`). La feature es 100% comportamiento de cliente: no toca contrato REST/WS ni backend.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Angular 21 (componentes standalone, NgRx Signals).

**Primary Dependencies**: Angular Material (`MatDialog`), RxJS (`Subject`), servicios existentes `MatchStateService` y `MatchEventQueueService` (feature 010).

**Storage**: N/A — estado en memoria del servicio scoped a la pantalla de match.

**Testing**: Vitest. Unit tests sobre `MatchEventQueueService` (cobertura de pausa/resume, idempotencia, encadenado, clear durante pausa) y test de integración sobre `MatchScreenComponent` (modal abierto → cola pausada → ACK → cola sigue).

**Target Platform**: Web browser (mobile ≥ 360 px y desktop ≥ 1024 px), pantalla de match exclusivamente.

**Project Type**: Frontend SPA (Angular). Single project.

**Performance Goals**: No degradar el ritmo actual del flujo no bloqueante (delays definidos en `match-event-delays.config.ts` se mantienen). En flujos bloqueantes el "delay efectivo" es el tiempo de lectura del usuario — sin cota superior.

**Constraints**:
- Idempotencia del ACK: clicks repetidos sobre "Aceptar" no procesan eventos adicionales.
- Cero pérdida de eventos durante la pausa: la cola sigue aceptando `enqueue*` mientras está pausada.
- Reconexión / abandono de pantalla: comportamiento alineado con FR-008/FR-009/FR-011 de la 010 (descarte de cola + cierre de modal + reconciliación por snapshot).
- Mobile floor 360 px; sin nuevos modales — se reutilizan los existentes (`EnvidoResultDialogComponent`, `GameWonDialogComponent`).

**Scale/Scope**: Cambios localizados en 3 archivos del feature `match` + 1 archivo de config nuevo + 2 spec files. Catálogo inicial de event types bloqueantes: `ENVIDO_RESOLVED`, `GAME_SCORE_CHANGED`, `MATCH_FINISHED`, `MATCH_ABANDONED`, `MATCH_FORFEITED` (extensible para futuros `HAND_RESOLVED` cuando exista modal de ronda ganada).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: No se introducen archivos SCSS nuevos ni colores; se reutilizan los modales existentes que ya cumplen el guardarraíl.
> - [x] **Validación de contrato**: La feature no toca DTOs ni endpoints; consume los mismos eventos WS de la 010. No requiere nuevos contract tests.
> - [x] **CTAs verticales**: Los modales bloqueantes ya tienen su CTA "Aceptar" definido por las features previas; no se altera su estructura.
> - [x] **Copy de errores**: La feature no agrega paths de error nuevos; sin impacto sobre `getErrorCopy()`.
> - [x] **Reglas de juego**: Sin impacto sobre scoring ni formatos de serie. `gamesToPlay ∈ {1,3,5}` permanece intacto.

**Principio I (design tokens)**: N/A (no se tocan estilos).
**Principio II (validación de contrato)**: N/A (no se tocan DTOs).
**Principio III (CTAs apilados)**: N/A (no se diseñan CTAs nuevos).
**Idioma español**: Aplica a todo artefacto Spec Kit de esta feature — cumplido.
**Componentes standalone**: Los servicios afectados ya son standalone-friendly (no se introducen NgModules).

Gate: **PASS** — sin desviaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/011-ack-gated-event-queue/
├── plan.md              # Este archivo
├── research.md          # Decisiones de diseño (Fase 0)
├── data-model.md        # Modelo interno: estado de la cola + catálogo (Fase 1)
├── quickstart.md        # Cómo verificar la feature manualmente (Fase 1)
└── tasks.md             # Salida de /speckit-tasks (no creado aquí)
```

> No se genera `contracts/`: la feature es puramente interna al cliente; no expone APIs nuevas ni cambia el contrato WS/REST.

### Source Code (repository root)

```text
src/app/features/match/
├── config/
│   ├── match-event-delays.config.ts          # Existente (010)
│   └── match-blocking-events.config.ts       # NUEVO — catálogo centralizado
├── services/
│   ├── match-event-queue.service.ts          # MODIFICADO — pausa/resume por ACK
│   ├── match-event-queue.service.spec.ts     # MODIFICADO — tests de pausa
│   ├── match-state.service.ts                # Sin cambios — sigue inyectando la queue
│   └── match-state.service.spec.ts           # Sin cambios funcionales
└── pages/match-screen/
    ├── match-screen.component.ts             # MODIFICADO — resumeAck en afterClosed
    └── match-screen.component.spec.ts        # MODIFICADO — test de integración
```

**Structure Decision**: Single-project Angular SPA. Cambios contenidos en `src/app/features/match/`. El catálogo de eventos bloqueantes va en `src/app/features/match/config/match-blocking-events.config.ts` siguiendo la convención de `match-event-delays.config.ts` (FR-004 — "centralizada en un único lugar configurable").

## Complexity Tracking

> Sin violaciones a la constitución. No se requieren justificaciones.
