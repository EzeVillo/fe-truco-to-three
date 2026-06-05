# Tasks: Presencia y reconexion de usuario

**Input**: Design documents from `/specs/022-presence-reconnect/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/presence.md](./contracts/presence.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. El plan requiere Vitest unitario y contract tests para DTOs de presencia.

**Organization**: Tareas agrupadas por user story para permitir implementacion y validacion incremental.

> **Guardarrailes del proyecto**:
> - Verificar DTOs campo a campo contra `docs/CONTRATOS_API.md` antes de consumir presencia.
> - No mostrar `ApiError.message` crudo.
> - No navegar a ligas/copas en esta feature.
> - No agregar npm/yarn; usar pnpm.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar estructura y contratos base para presencia.

- [x] T001 Crear el archivo de modelos de presencia en `src/app/core/models/presence.models.ts` con exports tipados minimos
- [x] T002 Crear el archivo del servicio REST de presencia en `src/app/core/services/presence-api.service.ts`
- [x] T003 Crear el archivo del coordinador global en `src/app/core/services/presence-coordinator.service.ts`
- [x] T004 [P] Crear el archivo de contract test en `src/tests/contract/presence.contract.spec.ts`
- [x] T005 [P] Crear el archivo de unit tests del coordinador en `src/app/core/services/presence-coordinator.service.spec.ts`
- [x] T006 [P] Crear el archivo de unit tests del servicio REST en `src/app/core/services/presence-api.service.spec.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Definir DTOs, helpers y contrato compartido que bloquean todas las historias.

**CRITICAL**: Ninguna historia debe empezar hasta completar esta fase.

- [x] T007 Implementar `PresenceMatch`, `PresenceRematch`, `PresenceTournament`, `UserPresenceResponse` y `PresenceWsEvent` en `src/app/core/models/presence.models.ts`
- [x] T008 Implementar el tipo `PresenceDestination` y el helper puro `derivePresenceDestination()` en `src/app/core/models/presence.models.ts`
- [x] T009 Implementar reglas de prioridad en `derivePresenceDestination()` en `src/app/core/models/presence.models.ts`: `match` primero, `rematch` despues, `league` y `cup` ignorados
- [x] T010 [P] Implementar `presence.contract.spec.ts` para verificar en `docs/CONTRATOS_API.md` la existencia de `GET /api/me/presence`, `/user/queue/presence`, `PRESENCE_UPDATED` y campos del DTO en `src/tests/contract/presence.contract.spec.ts`
- [x] T011 Agregar ejemplos `satisfies UserPresenceResponse` y `satisfies PresenceWsEvent` en `src/tests/contract/presence.contract.spec.ts`

**Checkpoint**: Modelos y contrato listos; historias pueden implementarse.

---

## Phase 3: User Story 1 - Volver a la partida ocupada al abrir la app (Priority: P1) MVP

**Goal**: Al abrir/refrescar con una partida no finalizada, el usuario termina en `/match/:matchId`.

**Independent Test**: Con un usuario autenticado y `GET /api/me/presence` devolviendo `match.id`, iniciar la app desde `/lobby` y verificar navegacion a `/match/:matchId`; si ya esta en esa ruta, no se navega de nuevo.

### Tests for User Story 1

- [x] T012 [P] [US1] Agregar tests de `derivePresenceDestination()` para `match`, usuario libre y torneos ignorados en `src/tests/contract/presence.contract.spec.ts`
- [x] T013 [P] [US1] Agregar tests de `PresenceApiService.getPresence()` para `GET /api/me/presence` en `src/app/core/services/presence-api.service.spec.ts`
- [x] T014 [P] [US1] Agregar tests del coordinador para bootstrap autenticado, navegacion a `/match/:id` y no-navegacion si ya esta en destino en `src/app/core/services/presence-coordinator.service.spec.ts`

### Implementation for User Story 1

- [x] T015 [US1] Implementar `PresenceApiService.getPresence()` usando `HttpClient` y `environment.apiUrl` en `src/app/core/services/presence-api.service.ts`
- [x] T016 [US1] Implementar `PresenceCoordinatorService.start()` con proteccion de inicializacion unica y lectura de `AuthStore.isAuthenticated()` en `src/app/core/services/presence-coordinator.service.ts`
- [x] T017 [US1] Implementar bootstrap REST de presencia y manejo silencioso de errores no 401 en `src/app/core/services/presence-coordinator.service.ts`
- [x] T018 [US1] Implementar navegacion idempotente a `/match/:matchId` desde destino `match` en `src/app/core/services/presence-coordinator.service.ts`
- [x] T019 [US1] Inyectar e iniciar `PresenceCoordinatorService` desde el constructor de `App` en `src/app/app.ts`

**Checkpoint**: US1 funciona de forma independiente como MVP.

---

## Phase 4: User Story 2 - Sincronizar sesiones abiertas en varios lugares (Priority: P2)

**Goal**: Todas las sesiones abiertas del mismo usuario procesan cambios de presencia en tiempo real.

**Independent Test**: Con dos sesiones del mismo usuario, simular `PRESENCE_UPDATED` en una sesion ociosa y verificar que navega al mismo match activo sin refrescar.

### Tests for User Story 2

- [x] T020 [P] [US2] Agregar tests del coordinador para suscripcion a `/user/queue/presence` y procesamiento de `PRESENCE_UPDATED` en `src/app/core/services/presence-coordinator.service.spec.ts`
- [x] T021 [US2] Agregar test de desconexion logica al pasar a usuario no autenticado o logout en `src/app/core/services/presence-coordinator.service.spec.ts`

### Implementation for User Story 2

- [x] T022 [US2] Integrar `WebSocketService.connect()` y `subscribe<PresenceWsEvent>('/user/queue/presence')` en `src/app/core/services/presence-coordinator.service.ts`
- [x] T023 [US2] Procesar `PRESENCE_UPDATED.payload` reutilizando `derivePresenceDestination()` en `src/app/core/services/presence-coordinator.service.ts`
- [x] T024 [US2] Guardar la ultima clave de destino procesada para evitar navegaciones duplicadas ante snapshots repetidos en `src/app/core/services/presence-coordinator.service.ts`
- [x] T025 [US2] Cancelar suscripciones internas cuando el usuario deja de estar autenticado o el servicio se destruye en `src/app/core/services/presence-coordinator.service.ts`

**Checkpoint**: US1 y US2 funcionan sin depender de refresco manual.

---

## Phase 5: User Story 3 - Recuperar revancha abierta (Priority: P3)

**Goal**: Si no hay partida activa y existe una revancha abierta, el usuario vuelve al match de origen para resolverla.

**Independent Test**: Con `GET /api/me/presence` o `PRESENCE_UPDATED` devolviendo `rematch.originMatchId` y `match: null`, iniciar desde `/lobby` y verificar navegacion a `/match/:originMatchId`.

### Tests for User Story 3

- [x] T026 [P] [US3] Agregar tests de `derivePresenceDestination()` para `rematch` sin match y prioridad de match sobre rematch en `src/tests/contract/presence.contract.spec.ts`
- [x] T027 [P] [US3] Agregar tests del coordinador para navegar al origin match de revancha y no navegar si ya esta alli en `src/app/core/services/presence-coordinator.service.spec.ts`

### Implementation for User Story 3

- [x] T028 [US3] Implementar navegacion a `/match/:originMatchId` para destino `rematch` en `src/app/core/services/presence-coordinator.service.ts`
- [x] T029 [US3] Asegurar que `league` y `cup` no generan destino cuando `match` y `rematch` son `null` en `src/app/core/models/presence.models.ts`
- [x] T030 [US3] Verificar que `MatchScreenComponent` conserva el flujo existente de revancha al entrar por `/match/:originMatchId` sin cambios innecesarios en `src/app/features/match/pages/match-screen/match-screen.component.ts`

**Checkpoint**: Todas las historias estan funcionales dentro del alcance actual.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validacion final, limpieza y documentacion minima.

- [x] T031 [P] Revisar que ningun flujo de presencia muestre `ApiError.message` crudo en `src/app/core/services/presence-coordinator.service.ts`
- [x] T032 [P] Actualizar notas de quickstart si cambia algun paso manual en `specs/022-presence-reconnect/quickstart.md`
- [x] T033 Ejecutar `pnpm test` definido en `package.json` y corregir fallos relacionados con presencia
- [x] T034 Ejecutar `pnpm lint` definido en `package.json` y corregir fallos relacionados con presencia
- [x] T035 Ejecutar `pnpm build` definido en `package.json` y corregir fallos de compilacion relacionados con presencia
- [x] T036 Si se agrego SCSS o template durante la implementacion, ejecutar scripts `lint:styles`, `lint:themes` y `lint:hover` definidos en `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias.
- **Foundational (Phase 2)**: Depende de Phase 1; bloquea todas las historias.
- **US1 (Phase 3)**: Depende de Phase 2. Es el MVP.
- **US2 (Phase 4)**: Depende de Phase 2 y puede implementarse luego de US1 para reutilizar el coordinador ya integrado.
- **US3 (Phase 5)**: Depende de Phase 2 y puede implementarse en paralelo con US2 si el helper de destino ya existe.
- **Polish (Phase 6)**: Depende de las historias elegidas para entregar.

### User Story Dependencies

- **US1 (P1)**: No depende de otras historias; entrega recuperacion por arranque en frio.
- **US2 (P2)**: Integra con el coordinador de US1 para cambios push.
- **US3 (P3)**: Usa el mismo helper de destino y extiende el caso de revancha.

### Within Each User Story

- Tests antes de implementacion.
- Helper/modelos antes de servicios.
- Servicio REST/WebSocket antes de integracion en `App`.
- Validar checkpoint antes de avanzar a la siguiente historia.

---

## Parallel Opportunities

- T004, T005 y T006 pueden ejecutarse en paralelo tras crear estructura base.
- T010 puede ejecutarse en paralelo con T007-T009 si ya existe `presence.models.ts`; T011 depende de T010 porque modifica el mismo archivo.
- T012, T013 y T014 pueden ejecutarse en paralelo.
- T020 y T021 deben hacerse secuencialmente porque modifican el mismo archivo de spec del coordinador.
- T026 y T027 pueden ejecutarse en paralelo.
- T031 y T032 pueden ejecutarse en paralelo durante polish.

---

## Parallel Example: User Story 1

```text
Task: "T012 [P] [US1] Agregar tests de derivePresenceDestination() en src/tests/contract/presence.contract.spec.ts"
Task: "T013 [P] [US1] Agregar tests de PresenceApiService.getPresence() en src/app/core/services/presence-api.service.spec.ts"
Task: "T014 [P] [US1] Agregar tests del coordinador para bootstrap y navegacion en src/app/core/services/presence-coordinator.service.spec.ts"
```

## Parallel Example: User Story 2

```text
Task: "T020 [P] [US2] Agregar tests de suscripcion a /user/queue/presence en src/app/core/services/presence-coordinator.service.spec.ts"
Task: "T021 [P] [US2] Agregar test de desconexion logica en src/app/core/services/presence-coordinator.service.spec.ts"
```

## Parallel Example: User Story 3

```text
Task: "T026 [P] [US3] Agregar tests de destino rematch en src/tests/contract/presence.contract.spec.ts"
Task: "T027 [P] [US3] Agregar tests del coordinador para originMatchId en src/app/core/services/presence-coordinator.service.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Completar Phase 1 y Phase 2.
2. Completar US1.
3. Validar que un usuario ocupado en match vuelve a `/match/:matchId` tras refresh.
4. Ejecutar `pnpm test` para los tests de presencia.

### Incremental Delivery

1. US1: arranque en frio hacia match activo.
2. US2: sincronizacion multi-sesion por push.
3. US3: recuperacion de revancha abierta.
4. Polish: suite completa y validacion manual del quickstart.

### Scope Guard

- No implementar rutas, UI ni navegacion a ligas/copas.
- No modificar scoring ni reglas de series.
- No introducir UI global salvo que aparezca un requerimiento nuevo.
