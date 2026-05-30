# Implementation Plan: Temporizador de turno en partida

**Branch**: `013-turn-timer` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-turn-timer/spec.md`

## Summary

Mostrar en la pantalla de partida una cuenta regresiva del plazo de turno que el backend ya expone
(`actionDeadline` / `turnDurationMillis` / `actionDeadlineSeat` en el snapshot REST y vía los eventos
WS `ACTION_DEADLINE_SET` / `ACTION_DEADLINE_CLEARED`). El backend sigue siendo el único árbitro del
vencimiento; el frontend sólo representa el tiempo restante como un **indicador visual de progreso
sin número**, sobre el asiento que debe actuar (propio y rival), con énfasis de urgencia en los
últimos 5 s, y deshabilita los controles del jugador al llegar a 0 mientras espera la resolución del
backend.

Enfoque técnico: extender el modelo de estado y el reducer con los campos del plazo; rutear los dos
eventos de temporizador (que llegan por `/user/queue/match` con `stateVersion: null`) por el camino
de eventos **derivados** para que no rompan la reconciliación por `stateVersion`; derivar un
"deadline efectivo" robusto al desfase de reloj usando el `timestamp` (epochMillis del servidor) de
los eventos WS; y renderizar el indicador en `MatchStatusPanelComponent` reutilizando el `turn-dot`
existente de cada asiento.

## Technical Context

**Language/Version**: TypeScript 5.x / Angular 21 (componentes standalone, signals)

**Primary Dependencies**: Angular Material, NgRx Signals (auth), `@stomp/stompjs` + SockJS (WS/STOMP),
RxJS. Sin nuevas dependencias.

**Storage**: N/A (estado en memoria vía signals; no se persiste el temporizador)

**Testing**: Vitest (unit + contract). Patrón existente: `*.spec.ts` por componente/servicio/util y
`src/tests/contract/` para paridad con `docs/CONTRATOS_API.md`.

**Target Platform**: Navegador web (mobile portrait desde 360 px y desktop desde 1024 px)

**Project Type**: Single project — frontend Angular (`src/app/`)

**Performance Goals**: Cuenta regresiva fluida (actualización visual ~4–10 fps suficiente; no requiere
60 fps). Sin trabajo en cada frame del navegador fuera del turno activo.

**Constraints**:
- El tiempo mostrado debe coincidir con el plazo del backend con diferencia ≤ 1 s (SC-002).
- No declarar derrota por timeout en el cliente (FR-007).
- Robustez ante desfase de reloj del dispositivo (FR-010): usar referencia temporal del servidor.
- SCSS de feature sólo con tokens `var(--t3-…)`; sin colores hardcodeados.
- DTOs verificados contra `docs/CONTRATOS_API.md` (§4.14, §4.15, §9.5, §9.6, §4.18).

**Scale/Scope**: 1 pantalla (match-screen), 2 asientos. Cambio acotado: ~1 modelo, 1 reducer,
1 servicio de estado, 1 util nueva, 1–2 componentes de UI, tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Tokens CSS**: El indicador y el estilo de urgencia usarán exclusivamente `var(--t3-…)`. Si
  falta un token (p. ej. color de urgencia), se agrega primero en `src/styles.scss`. ✅ (verificar
  con `pnpm lint:styles`).
- **II. Validación de contrato**: Los nuevos campos/eventos se tipan campo a campo contra
  `docs/CONTRATOS_API.md` (§4.14/§4.15 snapshot, §9.5/§9.6 eventos, §4.18 mecánica). ✅
- **III. CTAs título+descripción**: No aplica (no se agregan CTAs). ✅
- **Copy de errores**: No aplica (no se consume `ApiError.message`; "tiempo agotado" es copy del
  front en español). ✅
- **Reglas de juego**: No se toca scoring ni `gamesToPlay`. ✅
- **Mobile floor / breakpoint único**: El indicador debe entrar sin romper layout a 360 px con un
  único `@media (min-width: 1024px)`. ✅
- **Standalone components**: Todo nuevo componente es standalone. ✅

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [ ] **Tokens CSS**: indicador y urgencia con `var(--t3-…)`. `pnpm lint:styles` verde.
> - [ ] **Validación de contrato**: campos del plazo y eventos tipados contra `docs/CONTRATOS_API.md`.
> - [ ] **CTAs verticales**: N/A (no se agregan CTAs).
> - [ ] **Copy de errores**: N/A (no se muestra `ApiError.message`).
> - [ ] **Reglas de juego**: N/A (no se toca scoring/`gamesToPlay`).

**Resultado del gate**: PASS. Sin violaciones; no se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-turn-timer/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas
├── data-model.md        # Fase 1 — entidades/estado
├── quickstart.md        # Fase 1 — cómo probar/verificar
├── contracts/
│   └── timer-ui-contract.md   # Contrato de consumo (campos + eventos del plazo)
└── checklists/
    └── requirements.md  # Checklist de calidad de la spec (ya existente)
```

### Source Code (repository root)

```text
src/app/
├── core/
│   └── models/
│       └── match.models.ts            # + campos del plazo en RoundState/MatchState
├── features/match/
│   ├── models/
│   │   └── match-ws-events.ts         # + tipos ActionDeadline{Set,Cleared} + payloads
│   ├── reducers/
│   │   └── match-event.reducer.ts     # + aplicar plazo (set/clear) sobre roundGame
│   ├── services/
│   │   └── match-state.service.ts     # + ruteo de eventos del temporizador + offset reloj
│   ├── utils/
│   │   ├── derive-match-view.ts       # + exponer plazo por asiento en MatchView
│   │   └── turn-timer.ts              # NUEVA — cálculo de deadline efectivo / restante
│   └── components/
│       ├── match-status-panel/        # render del indicador sobre el turn-dot del asiento
│       └── available-actions-panel/   # deshabilitar controles del viewer al llegar a 0
└── tests/contract/
    └── action-deadline.contract.spec.ts   # NUEVO — paridad con docs/CONTRATOS_API.md §9.6
```

**Structure Decision**: Single project Angular. Se reutiliza la arquitectura existente de la feature
`match`: snapshot REST + reconciliación por `stateVersion`, reducer puro, `MatchStateService` como
orquestador de WS, `deriveMatchView` como capa de presentación y `MatchStatusPanelComponent` como
lugar de render. El temporizador no introduce módulos ni capas nuevas.

## Complexity Tracking

> No aplica — el Constitution Check pasa sin violaciones.
