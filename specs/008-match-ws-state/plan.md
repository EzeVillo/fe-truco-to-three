# Implementation Plan: Estado de partida en tiempo real vía WebSocket

**Branch**: `008-match-ws-state` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-match-ws-state/spec.md`

## Summary

Integrar la pantalla de partida (`/match/:matchId`) con el backend en tiempo real. El patrón elegido es **delta reducer**: al ingresar a la pantalla se suscribe al canal WS antes de consultar el estado inicial por REST, luego aplica cada evento entrante como un delta puro sobre el `MatchState` existente. Los mock switchers desaparecen de la UI de producción. El fin de partida (victoria, abandono o forfeit) muestra el `RoundWonDialogComponent` existente mapeando los datos del evento del servidor.

## Technical Context

**Language/Version**: TypeScript 5 / Angular 21 (standalone, sin NgModules)

**Primary Dependencies**:
- `@stomp/stompjs` + `SockJS` — ya configurados en `WebSocketService`
- `Angular HttpClient` — `jwtInterceptor` añade Bearer automáticamente
- `Angular Material MatDialog` — ya usado para diálogos de envido/ronda
- `NgRx Signals` (`signal`, `computed`) — para estado reactivo en el servicio

**Storage**: Sin almacenamiento persistente nuevo; estado solo en memoria durante la sesión.

**Testing**: Vitest (configuración existente)

**Target Platform**: SPA web — Mobile (360–1023 px) y Desktop (1024 px+)

**Project Type**: Web application (Angular SPA — feature dentro de `src/app/features/match/`)

**Performance Goals**:
- Estado visible en < 2 s en red local tras navegar a la partida (SC-001)
- Actualizaciones del oponente en < 500 ms desde emisión del servidor (SC-002)

**Constraints**:
- Tokens CSS `var(--t3-…)` obligatorios en SCSS
- Sin `mat-flat-button`/`mat-raised-button` en templates de feature
- Enums del backend son case-sensitive
- Gestor de paquetes: pnpm

**Scale/Scope**: Una pantalla de partida; 2 jugadores simultáneos; eventos de baja frecuencia (~1–5/s durante el juego activo).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: Todo color/espaciado/radio/sombra en SCSS de feature usa `var(--t3-…)`. No se agrega SCSS nuevo con colores hardcodeados. Verificar con `pnpm lint:styles`.
> - [x] **Validación de contrato**: El tipo `MatchWsEvent` se verifica campo a campo contra `CONTRATOS_API.md §9.4–9.6`; `MatchState` de `GET /api/matches/{matchId}` verificado contra §4.14. Discrepancia de `/user/queue/match-derived` en §9.3 documentada en `research.md`.
> - [x] **CTAs verticales**: No se agregan CTAs nuevos en esta feature (spinner de carga es un `<mat-spinner>` estándar, sin jerarquía visual interna).
> - [x] **Copy de errores**: El error de carga inicial muestra un mensaje genérico del catálogo del front; no se expone `ApiError.message`.
> - [x] **Reglas de juego**: No se modifican reglas de puntaje ni formato de serie.

**Resultado**: ✅ Sin violaciones. El plan puede avanzar.

## Project Structure

### Documentation (this feature)

```text
specs/008-match-ws-state/
├── plan.md              # Este archivo
├── research.md          # Decisiones de diseño y resolución de incógnitas
├── data-model.md        # Modelos de datos nuevos y mapeos
├── quickstart.md        # Guía de verificación manual
├── contracts/
│   └── match-ws-contract.md  # Contrato WS + REST de esta feature
└── tasks.md             # Generado por /speckit-tasks (aún no creado)
```

### Source Code

```text
src/app/features/match/
├── models/
│   └── match-ws-events.ts           # [NUEVO] Tipos de eventos WS (transaccionales + derivados)
├── reducers/
│   └── match-event.reducer.ts       # [NUEVO] Reducer puro: (MatchState, event) → MatchState
│   └── match-event.reducer.spec.ts  # [NUEVO] Tests del reducer
├── services/
│   ├── match-actions.service.ts     # [EXISTENTE, sin cambios]
│   ├── match-state.service.ts       # [NUEVO] Orquestación WS + REST + buffer + reconexión
│   └── match-state.service.spec.ts  # [NUEVO] Tests del servicio
├── pages/
│   └── match-screen/
│       ├── match-screen.component.ts    # [MODIFICADO] Conectar a service, eliminar mocks
│       ├── match-screen.component.html  # [MODIFICADO] Spinner carga, eliminar mock switchers
│       ├── match-screen.component.scss  # [EXISTENTE, sin cambios]
│       └── match-screen.component.spec.ts # [MODIFICADO] Actualizar tests
├── components/
│   ├── mock-actions-state-switcher/  # [CONSERVADO — usado en tests, eliminado de template]
│   ├── mock-envido-result-switcher/  # [CONSERVADO — usado en tests, eliminado de template]
│   └── mock-round-won-switcher/      # [CONSERVADO — usado en tests, eliminado de template]
└── mocks/                            # [CONSERVADO — para tests automatizados]

src/app/core/models/
└── match.models.ts                   # [EXISTENTE — sin cambios; stateVersion es interno al servicio]
```

**Structure Decision**: Proyecto Angular SPA — opción 1 (single project). La feature vive dentro de `src/app/features/match/`. Se agregan las subcarpetas `models/` y `reducers/` dentro de la feature; no se crea un módulo nuevo.

## Complexity Tracking

> Sin violaciones de constitución que justificar.

---

## Decisiones de Diseño

### MatchStateService — Responsabilidades

```
MatchStateService (providedIn: 'root' o provided en el componente)
│
├── init(matchId: string): void
│     1. Suscribir a /user/queue/match → buffer de transaccionales
│     2. Suscribir a /user/queue/match-derived → buffer de derivados
│     3. GET /api/matches/{matchId}
│     4. Drenar buffers (ver algoritmo en research.md §1)
│     5. Modo live
│
├── destroy(): void
│     Unsubscribe de todos los observables activos
│
├── state: Signal<MatchState | null>
├── loading: Signal<boolean>
├── error: Signal<boolean>
└── matchEnded$: Subject<MatchEndedEvent>
```

El servicio se instancia a nivel componente (providers en el decorador) para que su ciclo de vida quede atado a la pantalla de partida y se destruya al salir.

### Reducer puro

```typescript
// src/app/features/match/reducers/match-event.reducer.ts

export function applyMatchEvent(state: MatchState, event: MatchWsEvent): MatchState
export function applyMatchDerivedEvent(state: MatchState, event: MatchDerivedEvent): MatchState
```

Cada `eventType` tiene su propio case en el switch. El case devuelve un nuevo objeto `MatchState` con spread (`{ ...state, ... }`), nunca muta el estado anterior.

### Spinner de carga

Mientras `matchStateService.loading()` sea `true`, el template muestra un `<mat-progress-spinner mode="indeterminate">` centrado en pantalla. El `GameBoardComponent` solo se renderiza cuando `loading()` es `false` y `state()` es no-nulo.

### Diálogo de resultado de fin de partida

Al recibir `MATCH_FINISHED`, `MATCH_ABANDONED` o `MATCH_FORFEITED`:
1. El servicio emite por `matchEnded$`.
2. El componente suscribe en `ngOnInit` y llama a `MatDialog.open(RoundWonDialogComponent, { data: ... })`.
3. Al cerrar el diálogo, `afterClosed()` navega con `router.navigate(['/'])` (lobby).

### Reconexión

El `WebSocketService.connected` emite `false` al desconectarse y `true` al reconectarse. `MatchStateService` observa este stream: cuando detecta una reconexión (previo `false`, nuevo `true`), re-inicia el proceso de bootstrap con el mismo `matchId`.

---

## Flujo de datos de extremo a extremo

```
Usuario navega a /match/:matchId
     │
     ▼
MatchScreenComponent.ngOnInit()
     │
     ├─► MatchStateService.init(matchId)
     │         │
     │         ├─► wsService.subscribe('/user/queue/match')     ─► buffer[]
     │         ├─► wsService.subscribe('/user/queue/match-derived') ─► derivedBuffer[]
     │         └─► http.get('/api/matches/:matchId')
     │                   │
     │                   ▼
     │              snapshot (stateVersion=N)
     │                   │
     │              drenar buffer[]         → reducer puro
     │              drenar derivedBuffer[]  → reducer derivado
     │                   │
     │              state.set(finalState)
     │              loading.set(false)
     │
     ▼
Template muestra GameBoardComponent con estado real
     │
     ├─ Evento WS llega → reducer → state actualizado → view reactiva
     │
     └─ MATCH_FINISHED/ABANDONED/FORFEITED
               │
               ▼
         matchEnded$ emite
               │
               ▼
         MatDialog.open(RoundWonDialogComponent, { data: mapeo })
               │
               ▼
         afterClosed() → router.navigate(['/'])
```

---

## Gates de Calidad

| Gate | Comando | Estado esperado |
|------|---------|-----------------|
| Lint TS/HTML | `pnpm lint` | Sin errores |
| Lint estilos | `pnpm lint:styles` | Sin colores hardcodeados |
| Lint themes | `pnpm lint:themes` | Sin mat-flat-button/raised |
| Tests | `pnpm test` | Reducer + servicio + contrato ✅ |
| Build | `pnpm build` | Sin errores de compilación |
