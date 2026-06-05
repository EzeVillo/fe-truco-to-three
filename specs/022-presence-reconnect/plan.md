# Implementation Plan: Presencia y reconexion de usuario

**Branch**: `023-presence-reconnect` | **Date**: 2026-06-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-presence-reconnect/spec.md`

## Summary

Agregar una coordinacion global de presencia para usuarios autenticados: al arrancar o refrescar la
SPA se consulta la ocupacion actual y, mientras la sesion siga abierta, se escuchan cambios push por
WebSocket. Si el usuario esta ocupado en una partida no finalizada, se lo deriva a `/match/:matchId`;
si tiene una revancha abierta y no hay partida activa con mayor prioridad, se lo deriva al contexto
del match de origen para resolver la revancha. Ligas/copas quedan explicitamente fuera de alcance en
esta iteracion aunque el contrato las exponga, porque hoy no hay pantallas de torneos implementadas.

## Technical Context

**Language/Version**: TypeScript 5.x / Angular 21 con componentes standalone y signals.

**Primary Dependencies**: Angular Router, HttpClient, RxJS, NgRx Signals (`AuthStore`), `@stomp/stompjs`
via `WebSocketService`. No se agregan dependencias nuevas.

**Storage**: N/A. La presencia vive en memoria; la sesion autenticada sigue persistida por el
`AuthStore` existente.

**Testing**: Vitest. Tests unitarios para el coordinador de presencia, servicio REST, mapeo de destino
y contrato de DTOs contra `docs/CONTRATOS_API.md`.

**Target Platform**: Web SPA responsive, mobile desde 360 px y desktop desde 1024 px.

**Project Type**: Frontend Angular single project bajo `src/app/`.

**Performance Goals**: Usuario ocupado redirigido en menos de 2 s desde que la app queda autenticada;
cambios push reflejados en menos de 3 s, limitado por latencia WebSocket.

**Constraints**: No UI nueva salvo copy controlado si hace falta; no mostrar `ApiError.message`; no
navegar a torneos; evitar loops de navegacion; mantener quick match en busqueda fuera de presencia.

**Scale/Scope**: 1 servicio REST de presencia, 1 coordinador global, modelos DTO, tests unitarios y
contract tests. Alcance funcional: partida no finalizada + revancha abierta.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: No se planea SCSS nuevo. Si aparece UI de error, usara tokens `var(--t3-...)` y se verificara con `pnpm lint:styles`.
> - [x] **Validacion de contrato**: DTOs `UserPresenceResponse` y `PresenceWsEvent` se tipan campo a campo contra `docs/CONTRATOS_API.md` seccion 7.6 y cola `/user/queue/presence`.
> - [x] **CTAs verticales**: No se agregan CTAs ni templates nuevos.
> - [x] **Copy de errores**: Errores de presencia no mostraran `ApiError.message`; si se informa al usuario, se agregara scope controlado en `getErrorCopy()`.
> - [x] **Reglas de juego**: La feature no cambia scoring ni series. Respeta que una ocupacion activa bloquea crear/unirse a otro recurso.

**Resultado**: PASS. No hay violaciones ni deuda de complejidad.

## Project Structure

### Documentation (this feature)

```text
specs/022-presence-reconnect/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- presence.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md                 # Lo genera /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
src/app/
|-- app.ts                                      # EXTENDER: iniciar coordinador global
|-- core/
|   |-- models/
|   |   `-- presence.models.ts                 # NUEVO: DTOs REST/WS de presencia
|   `-- services/
|       |-- presence-api.service.ts            # NUEVO: GET /api/me/presence
|       `-- presence-coordinator.service.ts    # NUEVO: arranque, push, navegacion
`-- tests/
    `-- contract/
        `-- presence.contract.spec.ts          # NUEVO: paridad doc <-> DTOs
```

**Structure Decision**: La presencia es una preocupacion transversal de sesion, no de una pantalla.
Por eso vive en `core/` y se inicia una vez desde `App`, igual que las notificaciones de perfil.
`MatchScreenComponent` sigue siendo responsable de cargar el match y de resolver revancha mediante
los servicios existentes; el coordinador solo decide el destino.

## Complexity Tracking

No aplica: la Constitution Check pasa sin violaciones.

## Phase 0: Research

Ver [research.md](./research.md).

## Phase 1: Design & Contracts

- Modelo de datos: [data-model.md](./data-model.md)
- Contrato FE: [contracts/presence.md](./contracts/presence.md)
- Guia de validacion manual: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: El diseno no requiere SCSS nuevo.
> - [x] **Validacion de contrato**: El contrato FE referencia `docs/CONTRATOS_API.md` seccion 7.6 y define tests de paridad.
> - [x] **CTAs verticales**: No aplica; no hay CTAs nuevos.
> - [x] **Copy de errores**: Se mantiene catalogo del front para cualquier copy visible.
> - [x] **Reglas de juego**: Sin cambios a scoring ni formato de series.

**Resultado**: PASS.
