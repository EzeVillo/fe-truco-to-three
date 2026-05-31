# Implementation Plan: MVP de partida privada por código

**Branch**: `015-private-match-code` | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-private-match-code/spec.md`

## Summary

Habilitar el primer modo jugador-vs-jugador humano mediante **partidas privadas por código**. Un
anfitrión crea una partida privada (`POST /api/matches` con `visibility: PRIVATE`), recibe un
`joinCode` y queda en una **sala de espera**. Un segundo jugador se une con ese código
(`POST /api/join/{joinCode}`), la partida pasa a `READY`, y el anfitrión la inicia
(`POST /api/matches/{id}/start`), tras lo cual ambos transicionan al tablero ya existente.

El motor de juego (tablero, acciones, reducer de eventos, temporizador, fin de partida y revancha)
**se reutiliza tal cual**: `MatchStateService` ya es agnóstico al rival (solo necesita un `matchId`).
El trabajo nuevo se concentra en (a) la capa REST de matchmaking privado, (b) una **sala de espera**
para los estados previos a `IN_PROGRESS`, y (c) los puntos de entrada de UI para crear/unirse.

Enfoque técnico: tipar los DTOs de creación/join/start/leave contra el contrato; un
`MatchesApiService` fino (al estilo `BotsApiService`); reutilizar `MatchStateService` para los
estados `WAITING_FOR_PLAYERS`/`READY` (con un refresh de snapshot ante eventos de roster y la
transición reactiva a `IN_PROGRESS` vía `GAME_STARTED`); un `WaitingRoomComponent` presentacional que
`MatchScreenComponent` muestra cuando la partida aún no está en curso; una `OnlineMatchPageComponent`
en el lobby con las acciones de crear y unirse; y un nuevo scope de copy de errores.

El frontend es reactivo: no aplica reglas de negocio del backend (autostart, validez de código,
ocupación del jugador); solo refleja respuestas REST y eventos WS.

## Technical Context

**Language/Version**: TypeScript 5.x / Angular 21 (componentes standalone, signals)

**Primary Dependencies**: Angular Material (`MatDialog`/diálogos para avisos), NgRx Signals (auth),
`@stomp/stompjs` + SockJS (WS/STOMP), RxJS. Sin nuevas dependencias.

**Storage**: `sessionStorage` solo como mitigación del `joinCode` ante recarga (el snapshot REST no
lo devuelve, ver research D5). El estado de partida vive en memoria vía signals.

**Testing**: Vitest (unit + contract). Patrón existente: `*.spec.ts` por componente/servicio/util y
`src/tests/contract/` para paridad con `docs/CONTRATOS_API.md`.

**Target Platform**: Navegador web (mobile portrait desde 360 px y desktop desde 1024 px)

**Project Type**: Single project — frontend Angular (`src/app/`)

**Performance Goals**: Llegada del rival reflejada en la sala del anfitrión en < 3 s sin recarga
(SC-003). Crear y obtener el código en < 30 s (SC-002).

**Constraints**:
- Alcance **solo privado por código**: sin lobby público, sin invitaciones sociales, sin quick match.
- En privado **no hay autostart**: el anfitrión inicia explícitamente (`/start`) sobre estado
  `READY` (FR-006, §4.2/§4.5).
- Copy de errores del catálogo del front (`getErrorCopy`), nunca `ApiError.message` (FR-011).
- SCSS de feature solo con tokens `var(--t3-…)`; CTAs con `t3-btn` (no `mat-*-button`).
- `gamesToPlay ∈ {1,3,5}` (partidas totales de la serie); default `BEST_OF_3` (reusa
  `seriesFormatToGamesToPlay`).
- DTOs verificados contra `docs/CONTRATOS_API.md` (§4.1, §4.2, §4.5, §4.13, §4.14, §9.5/§9.6, §8.2).

**Scale/Scope**: 2 jugadores. Cambio acotado: ~1 servicio REST nuevo, ~3 modelos/DTOs nuevos, 1
página de lobby online, 1 componente de sala de espera, ajustes en `MatchStateService`/reducer/
`MatchScreenComponent`/`derive-match-view`, 1 scope de copy, rutas nuevas, tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Tokens CSS**: `OnlineMatchPageComponent` y `WaitingRoomComponent` usan exclusivamente
  `var(--t3-…)`. Si falta un token, se agrega primero en `src/styles.scss`. ✅ (`pnpm lint:styles`).
- **II. Validación de contrato**: DTOs de `POST /matches` (§4.1), `POST /join/{joinCode}` (§4.2),
  `/start` (§4.5), `/leave` (§4.13), campos de `MatchStateResponse` (§4.14) y eventos pre-juego
  (`PLAYER_JOINED`, `PLAYER_READY`, `MATCH_CANCELLED`, `MATCH_PLAYER_LEFT` §9.6) verificados campo a
  campo; nuevo contract test. **Divergencias detectadas** (resueltas en research): estado `READY`
  ausente del enum y de §8.2 (D1); `playerTwoUsername` nullable no reflejado en el tipo (D2). ✅
- **III. CTAs título+descripción**: Los CTAs del lobby ("Crear partida online", "Unirme con código")
  pueden llevar título+subtítulo apilados → `display:flex; flex-direction:column`, `var(--t3-gap-xs)`,
  sin `mat-flat-button`. Acciones simples (Iniciar, Salir, Copiar) usan `t3-btn`. ✅
  (`pnpm lint:themes`).
- **Copy de errores**: Se agregan scopes `CREATE_MATCH` y `JOIN_MATCH` a `getErrorCopy()`; ningún
  path muestra `ApiError.message`. ✅
- **Reglas de juego**: No se toca scoring; `gamesToPlay ∈ {1,3,5}` reusando
  `seriesFormatToGamesToPlay`. ✅
- **Mobile floor / breakpoint único**: Lobby online y sala de espera entran a 360 px con un único
  `@media (min-width: 1024px)`. ✅
- **Standalone components**: Todos los componentes nuevos son standalone. ✅

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [ ] **Tokens CSS**: lobby online + sala de espera con `var(--t3-…)`. `pnpm lint:styles` verde.
> - [ ] **Validación de contrato**: DTOs y eventos pre-juego tipados contra `docs/CONTRATOS_API.md`
>   §4.1/§4.2/§4.5/§4.13/§4.14/§9.6; contract test verde. Divergencias de §8.2 documentadas en el
>   propio contrato.
> - [ ] **CTAs tematizados**: botones con `t3-btn`; CTAs título+subtítulo apilados; `pnpm lint:themes`
>   verde (no `mat-*-button`).
> - [ ] **Copy de errores**: errores de crear/unirse vía `getErrorCopy('CREATE_MATCH'|'JOIN_MATCH', …)`,
>   sin `ApiError.message`.
> - [ ] **Reglas de juego**: `gamesToPlay ∈ {1,3,5}`; default `BEST_OF_3`; no se toca scoring.

**Resultado del gate**: PASS. Las divergencias de contrato se resuelven actualizando primero
`docs/CONTRATOS_API.md` (Principio II) y luego el cliente. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/015-private-match-code/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas (D1–D8)
├── data-model.md        # Fase 1 — entidades/DTOs/estado y transiciones
├── quickstart.md        # Fase 1 — cómo probar el flujo de punta a punta
├── contracts/
│   └── private-match-ui-contract.md   # Contrato de consumo (REST + eventos pre-juego)
└── checklists/
    └── requirements.md  # Checklist de calidad de la spec (ya existente)
```

### Source Code (repository root)

```text
src/app/
├── core/models/
│   ├── enums.ts                        # + 'READY' en MATCH_STATUS (tras verificar runtime, D1)
│   └── match.models.ts                 # + CreateMatchRequest/Response, JoinResponse;
│                                        #   playerTwoUsername: string | null (D2)
├── features/lobby/
│   ├── pages/
│   │   ├── lobby-page/                  # + CTAs "Crear partida online" / "Unirme con código"
│   │   └── online-match-page/           # NUEVO — crear privada (formato) + unirse por código
│   └── services/
│       └── matches-api.service.ts       # NUEVO — create/join/start/leave (§4.1/4.2/4.5/4.13)
├── features/match/
│   ├── models/
│   │   └── match-ws-events.ts          # + payloads PlayerReady/MatchPlayerLeft (eventType ya existen)
│   ├── services/
│   │   └── match-state.service.ts      # + refresh() snapshot ante roster pre-juego;
│   │                                    #   + preGameClosed$ (MATCH_CANCELLED)
│   ├── reducers/
│   │   └── match-event.reducer.ts      # GAME_STARTED ⇒ status 'IN_PROGRESS' (D6);
│   │                                    #   MATCH_PLAYER_LEFT/MATCH_CANCELLED → status pre-juego (D7)
│   ├── utils/
│   │   └── derive-match-view.ts        # tolerar playerTwoUsername null (sala de espera)
│   ├── components/
│   │   └── waiting-room/                # NUEVO — código+copiar (host), roster, iniciar/salir
│   └── pages/match-screen/             # render sala de espera si status ∉ {IN_PROGRESS, FINISHED};
│                                        # acciones start/leave; reacción a preGameClosed$ → lobby
├── shared/error-copy/
│   └── error-copy.ts                   # + scopes 'CREATE_MATCH', 'JOIN_MATCH'
├── app.routes.ts                       # + /lobby/online
└── tests/contract/
    └── private-match.contract.spec.ts  # NUEVO — paridad con §4.1/4.2/4.5/4.13/4.14/9.6
```

> El tablero (`GameBoardComponent`) y los servicios de acción de juego **no se modifican**: la sala de
> espera es una vista hermana que `MatchScreenComponent` muestra mientras la partida no esté
> `IN_PROGRESS`.

**Structure Decision**: Single project Angular. Se reutiliza la arquitectura existente: servicios
REST finos al estilo `BotsApiService` (`MatchesApiService`), `MatchStateService` como orquestador WS
(que ya soporta un `matchId` cualquiera y solo se extiende para el refresh de roster pre-juego y la
notificación de cancelación), y `MatchScreenComponent` como host que decide entre sala de espera y
tablero según `status`. El matchmaking de creación/unión vive en `features/lobby` (donde ya está el
flujo de bots); la sala de espera vive en `features/match` (donde vive la partida). No se introducen
NgModules.

## Complexity Tracking

> No aplica — el Constitution Check pasa sin violaciones. Las divergencias de contrato no son
> complejidad de diseño: se corrigen alineando `docs/CONTRATOS_API.md` y los tipos.
