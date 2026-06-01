# Tasks: Audio sincronizado de cantos

**Input**: Design documents from `/specs/018-call-audio-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/audio-call-contract.md, quickstart.md

**Tests**: Incluidos. La spec y quickstart piden cubrir mapeo de eventos a audio, reproduccion desde el inicio, fallos no bloqueantes e integracion con el punto exacto donde aparece el mensaje visual.

**Organization**: Tareas agrupadas por user story para permitir implementacion y verificacion incremental.

> **Guardarrailes del proyecto** - verificar en cada tarea relevante:
> - **Tokens CSS**: No se esperan cambios SCSS. Si aparecen, usar solo `var(--t3-...)` y correr `pnpm lint:styles`.
> - **Contrato de endpoints**: No se agregan DTOs/endpoints. Si se toca contrato, verificar contra `docs/CONTRATOS_API.md`.
> - **CTAs verticales**: No se agregan CTAs.
> - **Copy de errores**: No mostrar errores de audio en UI ni `ApiError.message`.
> - **Tests**: No ejecutar tests por clase; usar `pnpm test` cuando corresponda validar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo si toca archivos distintos y no depende de tareas incompletas.
- **[Story]**: Etiqueta de user story para fases de historia.
- Todas las tareas incluyen rutas concretas.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar insumos y dejar el terreno listo sin tocar comportamiento.

- [x] T001 Verificar que existan los 10 assets requeridos en `public/audio/calls/` segun `specs/018-call-audio-sync/contracts/audio-call-contract.md`
- [x] T002 Revisar el flujo visible actual de cantos en `src/app/features/match/pages/match-screen/match-screen.component.ts` y confirmar que el punto de integracion sigue siendo cuando se setean `selfCallText` y `opponentCallText`
- [x] T003 Revisar la paridad de eventos/enums usados contra `docs/CONTRATOS_API.md` y confirmar que no hace falta modificar `docs/CONTRATOS_API.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Crear el contrato interno testeable de audio antes de integrar historias.

**CRITICAL**: Completar esta fase antes de implementar las user stories.

- [x] T004 [P] Crear tests de mapeo completo evento-audio en `src/app/features/match/services/match-call-audio.service.spec.ts`
- [x] T005 [P] Crear tests de reproduccion desde cero y fallo no bloqueante de `play()` en `src/app/features/match/services/match-call-audio.service.spec.ts`
- [x] T006 Implementar `MatchCallAudioService` con mapeo de eventos visibles a assets en `src/app/features/match/services/match-call-audio.service.ts`
- [x] T007 Verificar que `MatchCallAudioService` ignore eventos/valores desconocidos sin lanzar errores en `src/app/features/match/services/match-call-audio.service.ts`

**Checkpoint**: Servicio de audio listo y testeable; las historias pueden integrarlo.

---

## Phase 3: User Story 1 - Escuchar cantos al aparecer el mensaje (Priority: P1) MVP

**Goal**: El audio empieza en el mismo momento en que aparece el mensaje visual del canto, respetando los delays existentes.

**Independent Test**: Emitir eventos ya aplicados en la pantalla de partida y verificar que el audio se pide justo despues de actualizar el texto visible, no al click ni antes del evento procesado.

### Tests for User Story 1

- [x] T008 [US1] Agregar tests de integracion para `TRUCO_CALLED`, `TRUCO_RESPONDED`, `ENVIDO_CALLED` y `FOLDED` en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`
- [x] T009 [US1] Agregar tests de integracion para `ENVIDO_RESOLVED` con `QUIERO` y `NO_QUIERO` en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`

### Implementation for User Story 1

- [x] T010 [US1] Inyectar `MatchCallAudioService` en `src/app/features/match/pages/match-screen/match-screen.component.ts`
- [x] T011 [US1] Reproducir audio en el branch general de `callDisplayMapper(event)` inmediatamente despues de setear el signal visible en `src/app/features/match/pages/match-screen/match-screen.component.ts`
- [x] T012 [US1] Reproducir audio en el branch especial de `ENVIDO_RESOLVED` inmediatamente despues de setear `selfCallText` u `opponentCallText` en `src/app/features/match/pages/match-screen/match-screen.component.ts`
- [x] T013 [US1] Confirmar que no se llama a audio desde `src/app/features/match/services/match-actions.service.ts` ni desde clicks de `src/app/features/match/components/available-actions-panel/available-actions-panel.component.ts`

**Checkpoint**: MVP funcional; los cantos visibles reproducen audio sincronizado con el mensaje.

---

## Phase 4: User Story 2 - Usar audios grabados por el propietario del juego (Priority: P2)

**Goal**: El propietario puede reemplazar grabaciones manteniendo nombres y ubicacion sin tocar reglas ni contrato.

**Independent Test**: Identificar la lista completa de archivos requeridos y reemplazar un audio manteniendo el nombre; la app sigue usando ese asset para el canto correspondiente.

### Tests for User Story 2

- [x] T014 [P] [US2] Agregar test de paridad entre el mapeo de `MatchCallAudioService` y los 10 archivos esperados en `src/app/features/match/services/match-call-audio.service.spec.ts`

### Implementation for User Story 2

- [x] T015 [US2] Exponer una lista canonica de audios soportados desde `src/app/features/match/services/match-call-audio.service.ts` para que los tests verifiquen paridad
- [x] T016 [US2] Documentar ubicacion, nombres y recomendacion de grabacion/reemplazo de audios en `README.md`
- [x] T017 [US2] Confirmar que `docs/CONTRATOS_API.md` queda sin cambios porque los audios son assets del frontend y no contrato backend

**Checkpoint**: La convencion de assets queda documentada y testeada.

---

## Phase 5: User Story 3 - Mantener la partida usable si falta o falla un audio (Priority: P3)

**Goal**: La partida sigue funcionando si falta un audio, falla la carga o el navegador bloquea `play()`.

**Independent Test**: Simular `play()` rechazado o asset inexistente; el texto visible se muestra y no se propaga error al usuario.

### Tests for User Story 3

- [x] T018 [US3] Agregar test de `play()` rechazado sin propagacion de error en `src/app/features/match/services/match-call-audio.service.spec.ts`
- [x] T019 [US3] Agregar test de pantalla donde `MatchCallAudioService` falla y el call text igual queda visible en `src/app/features/match/pages/match-screen/match-screen.component.spec.ts`

### Implementation for User Story 3

- [x] T020 [US3] Encapsular rechazos de `HTMLAudioElement.play()` sin lanzar error visible en `src/app/features/match/services/match-call-audio.service.ts`
- [x] T021 [US3] Asegurar que reset/navegacion de `MatchScreenComponent` no deja timers de UI pendientes ni llama audio para eventos futuros en `src/app/features/match/pages/match-screen/match-screen.component.ts`

**Checkpoint**: El audio es una mejora no bloqueante y no afecta la jugabilidad.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validacion final, limpieza y documentacion transversal.

- [ ] T022 Ejecutar `pnpm test` para validar todos los tests del proyecto
- [x] T023 Ejecutar `pnpm lint` para validar TypeScript/templates
- [x] T024 Ejecutar `pnpm build` para validar compilacion
- [x] T025 Revisar `README.md`, `specs/018-call-audio-sync/quickstart.md` y `specs/018-call-audio-sync/contracts/audio-call-contract.md` para confirmar que la lista de audios coincide con `public/audio/calls/`
- [ ] T026 Validar manualmente con `pnpm start` que los audios suenan junto al mensaje visual en una partida real o mockeada

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias.
- **Foundational (Phase 2)**: Depende de Setup; bloquea las user stories.
- **US1 (Phase 3)**: Depende de Foundational; es el MVP.
- **US2 (Phase 4)**: Depende de Foundational; puede correr en paralelo con US1 salvo tareas que reutilicen el mismo spec del servicio.
- **US3 (Phase 5)**: Depende de Foundational; puede correr en paralelo con US1/US2 si se coordinan cambios sobre los mismos archivos.
- **Polish (Phase 6)**: Depende de las historias implementadas.

### User Story Dependencies

- **User Story 1 (P1)**: No depende de US2/US3. Entrega audio sincronizado.
- **User Story 2 (P2)**: No depende de US1 para documentacion, pero la paridad del servicio depende de T006.
- **User Story 3 (P3)**: No depende de US1/US2, pero comparte `MatchCallAudioService` y `MatchScreenComponent`.

### Within Each User Story

- Tests antes de implementacion.
- Servicio antes de integracion en pantalla.
- Integracion en pantalla antes de validacion manual.
- No ejecutar tests por clase; usar `pnpm test`.

### Parallel Opportunities

- T004 y T005 pueden redactarse en paralelo porque cubren aspectos distintos del mismo spec, pero deben coordinarse antes de guardar el archivo final.
- T014 puede avanzar en paralelo con documentacion T016 si T006 ya expone el mapeo base.
- T018 puede avanzar en paralelo con T019 si se coordinan mocks del servicio.
- T022, T023 y T024 son validaciones separadas, pero conviene correrlas secuencialmente para diagnosticar fallos con claridad.

---

## Parallel Example: User Story 1

```text
Task: "Agregar tests de integracion para eventos generales en src/app/features/match/pages/match-screen/match-screen.component.spec.ts"
Task: "Agregar tests de integracion para ENVIDO_RESOLVED en src/app/features/match/pages/match-screen/match-screen.component.spec.ts"
```

Nota: ambas tareas tocan el mismo archivo; si las toma una sola persona, hacerlas secuencialmente. Si se trabaja en paralelo, coordinar el merge del spec.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 y Phase 2.
2. Completar US1.
3. Ejecutar `pnpm test`.
4. Validar manualmente que el audio suena cuando aparece el mensaje.

### Incremental Delivery

1. US1 entrega sincronizacion real con mensajes visibles.
2. US2 deja mantenible el set completo de grabaciones.
3. US3 endurece fallos de audio sin afectar partida.
4. Polish ejecuta validaciones completas y confirma documentacion.

### DDD / Boundaries

- No poner reglas de audio en reducers de estado ni en servicios REST de acciones.
- No modificar reglas de truco-to-three, puntaje, series ni contrato backend.
- Mantener el audio como adaptador de experiencia dentro de la feature `match`.
