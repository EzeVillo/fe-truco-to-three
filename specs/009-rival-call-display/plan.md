# Implementation Plan: Visualización de cantos del rival en panel de estado

**Branch**: `009-rival-call-display` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-rival-call-display/spec.md`

## Summary

Mostrar en el panel de estado (`MatchStatusPanel`) el texto del último canto o respuesta realizado por cada jugador, ubicado debajo de su nombre. Los textos de aceptación (`QUIERO`) se auto-limpian a los 3 segundos. Al iniciar una nueva ronda o finalizar la partida, los textos se resetean. El estado transiente de cantos vive fuera de `MatchState` (no es dominio de negocio) y se gestiona con señales en `MatchScreenComponent`, alimentadas por un nuevo `matchEvent$` expuesto desde `MatchStateService`.

## Technical Context

**Language/Version**: TypeScript 5 / Angular 21 (standalone, sin NgModules)

**Primary Dependencies**:
- `Angular Signals` (`signal`, `computed`) — estado transiente de cantos en componente
- `@stomp/stompjs` + `SockJS` — canal `/user/queue/match` ya existente; no se requiere nuevo endpoint
- `Angular Material` — no se agregan componentes nuevos de Material

**Storage**: N/A. Estado transiente solo en memoria durante la sesión de partida.

**Testing**: Vitest (configuración existente)

**Target Platform**: SPA web — Mobile (360–1023 px) y Desktop (1024 px+)

**Project Type**: Web application (Angular SPA — feature dentro de `src/app/features/match/`)

**Performance Goals**:
- Texto visible en < 1 s desde llegada del evento WS (SC-001)
- Auto-limpieza de aceptaciones entre 2.5 y 3.5 s (SC-003)

**Constraints**:
- Tokens CSS `var(--t3-…)` obligatorios en SCSS nuevo
- Sin `mat-flat-button`/`mat-raised-button` en templates de feature
- Altura máxima del panel en mobile: ≤ 96 px (ya cumplido por diseño actual)
- No modificar reglas de juego ni formato de serie

**Scale/Scope**: Un componente de panel; ~6 tipos de eventos WS; estado transiente para 2 jugadores.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: Todo color/espaciado/radio/sombra en SCSS de feature usa `var(--t3-…)`. Verificar con `pnpm lint:styles`.
> - [x] **Validación de contrato**: No se crean nuevos DTOs ni endpoints; se consumen eventos WS ya tipados en `match-ws-events.ts` y verificados contra `CONTRATOS_API.md`. Sin divergencias.
> - [x] **CTAs verticales**: No se agregan CTAs nuevos en esta feature (solo texto estilizado en panel).
> - [x] **Copy de errores**: No se agregan nuevos paths de error.
> - [x] **Reglas de juego**: No se modifican reglas de puntaje ni formato de serie.

**Resultado**: ✅ Sin violaciones. El plan puede avanzar.

## Project Structure

### Documentation (this feature)

```text
specs/009-rival-call-display/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones de diseño
├── data-model.md        # Fase 1: modelo de datos de UI
├── quickstart.md        # Fase 1: guía de verificación manual
├── contracts/
│   └── rival-call-display-contract.md  # Eventos WS consumidos
└── tasks.md             # Generado por /speckit-tasks (aún no creado)
```

### Source Code

```text
src/app/features/match/
├── services/
│   ├── match-state.service.ts           # [MODIFICADO] Exponer matchEvent$
│   └── match-state.service.spec.ts      # [NUEVO] Tests del servicio
├── pages/
│   └── match-screen/
│       ├── match-screen.component.ts    # [MODIFICADO] Lógica de cantos + timers
│       ├── match-screen.component.html  # [MODIFICADO] Pasar call-text a panel
│       └── match-screen.component.spec.ts # [MODIFICADO] Tests de timers y mapping
├── components/
│   └── match-status-panel/
│       ├── match-status-panel.component.ts    # [MODIFICADO] Nuevos inputs callText
│       ├── match-status-panel.component.html  # [MODIFICADO] Render call text
│       ├── match-status-panel.component.scss  # [MODIFICADO] Estilos call text
│       └── match-status-panel.component.spec.ts # [NUEVO] Tests de renderizado
└── utils/
    └── call-display-mapper.ts           # [NUEVO] Mapeo evento → texto legible
```

**Structure Decision**: Proyecto Angular SPA — estructura single project. La feature es una evolución UI del panel de estado existente. Se agrega un utilitario puro `call-display-mapper.ts` para desacoplar el mapeo de eventos del componente.

## Complexity Tracking

> Sin violaciones de constitución que justificar.

---

## Decisiones de Diseño

### Estado transiente fuera de MatchState

El texto del último canto **no** se almacena en `MatchState` ni pasa por el reducer. Es estado de presentación puro que depende del momento de llegada del evento WS, no del estado acumulado de la partida. Esto evita contaminar el dominio con datos que no persisten ni afectan la lógica de juego.

```
MatchScreenComponent
│
├── matchStateService.state() ──► deriveMatchView() ──► MatchView
│
└── matchStateService.matchEvent$ ──► filter(call events) ──► callText signals
                                    ├─► setTimeout(3s) para QUIERO
                                    └─► clear() en ROUND_STARTED / match end
```

### Exposición de eventos WS desde MatchStateService

`MatchStateService` procesa cada evento en `applyAndIncrement` pero no lo exponía. Se agrega un `matchEvent$ = new Subject<MatchWsEvent>()` que emite **después** de aplicar el evento al estado. Esto permite a `MatchScreenComponent` escuchar los eventos sin re-suscribirse al WebSocket.

**Alternativas rechazadas**:
- Re-suscribirse al WS desde `MatchScreenComponent` → duplicaría suscripciones y rompería el patrón de buffer/reconexión centralizado.
- Inyectar lógica de timers dentro del reducer → los reducers deben ser puros; timers violan la pureza.

### Mapeo de eventos a texto legible

Se crea `callDisplayMapper(event: MatchWsEvent): { text: string; seat: Seat; isAcceptance: boolean } | null` en `src/app/features/match/utils/call-display-mapper.ts`.

Mapeos soportados (español):

| Evento | Payload | Texto | isAcceptance |
|--------|---------|-------|--------------|
| `TRUCO_CALLED` | `call: TRUCO` | "¡Truco!" | false |
| `TRUCO_CALLED` | `call: RETRUCO` | "¡Retruco!" | false |
| `TRUCO_CALLED` | `call: VALE_CUATRO` | "¡Vale cuatro!" | false |
| `TRUCO_RESPONDED` | `response: QUIERO` | "¡Quiero!" | true |
| `TRUCO_RESPONDED` | `response: NO_QUIERO` | "¡No quiero!" | false |
| `TRUCO_RESPONDED` | `response: QUIERO_Y_ME_VOY_AL_MAZO` | "¡Quiero y me voy al mazo!" | false |
| `ENVIDO_CALLED` | `call: ENVIDO` | "¡Envido!" | false |
| `ENVIDO_CALLED` | `call: REAL_ENVIDO` | "¡Real envido!" | false |
| `ENVIDO_CALLED` | `call: FALTA_ENVIDO` | "¡Falta envido!" | false |
| `ENVIDO_RESOLVED` | `response: QUIERO` | "¡Quiero!" | true |
| `ENVIDO_RESOLVED` | `response: NO_QUIERO` | "¡No quiero!" | false |
| `FOLDED` | — | "Me voy al mazo" | false |

### Timer de auto-limpieza con DestroyRef

Los textos de aceptación (`isAcceptance: true`) se auto-limpian con `setTimeout`. Para asegurar limpieza al destruir el componente:

1. `MatchScreenComponent` usa `DestroyRef` para cancelar todos los timers pendientes en `ngOnDestroy`.
2. Si llega un nuevo evento de canto antes de que el timer anterior dispare, el timer anterior se cancela y se reemplaza por el nuevo estado (evita que un timer viejo borre texto nuevo).
3. El tracking de timers se hace con un `Map<Seat, number>` de `timeoutId`.

### Reset condiciones

Los textos de canto se borran cuando llegan estos eventos:
- `ROUND_STARTED` — nueva ronda, panel limpio
- `MATCH_FINISHED` / `MATCH_ABANDONED` / `MATCH_FORFEITED` — partida terminada
- `GAME_STARTED` — nuevo juego dentro de la serie

### Estilos visuales del texto de canto

Ubicado debajo del nombre del jugador, centrado en la columna del jugador:

- `font-size`: `0.625rem` (mobile), `0.75rem` (desktop)
- `font-weight`: `600`
- `color`: `var(--t3-gold-500)` — color dorado para destacar del resto del panel
- `text-align`: heredado del layout de columna (izquierda para self, derecha para rival)
- Sin fondo adicional; el texto ya contrasta sobre `var(--t3-card-bg)`

Se verifica que el panel no exceda 96 px de altura en mobile. Actualmente el panel usa ~70 px; agregar una línea de texto de ~16 px mantiene el límite.

---

## Flujo de datos de extremo a extremo

```
Servidor emite evento WS (ej. TRUCO_CALLED)
      │
      ▼
MatchStateService.matchEvent$.next(event)
      │
      ▼
MatchScreenComponent recibe evento
      │
      ├─► callDisplayMapper(event) → { text, seat, isAcceptance }
      │
      ├─► Actualizar signal de call text (self / opponent)
      │
      └─► Si isAcceptance → setTimeout(3000ms) → limpiar signal
      │
      ▼
Template Angular (ChangeDetection.OnPush)
      │
      ▼
MatchStatusPanelComponent recibe [selfCallText] / [opponentCallText]
      │
      ▼
Render condicional del <span class="status-panel__call-text">
```

---

## Gates de Calidad

| Gate | Comando | Estado esperado |
|------|---------|-----------------|
| Lint TS/HTML | `pnpm lint` | Sin errores |
| Lint estilos | `pnpm lint:styles` | Sin colores hardcodeados |
| Lint themes | `pnpm lint:themes` | Sin mat-flat-button/raised |
| Tests | `pnpm test` | Mapper + panel + timers ✅ |
| Build | `pnpm build` | Sin errores de compilación |
