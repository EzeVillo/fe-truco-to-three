---
description: "Task list — Sistema de amigos (MVP solo amistades)"
---

# Tasks: Sistema de amigos (MVP solo amistades)

**Input**: Design documents from `specs/024-friends-system/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/social-api.md

**Tests**: SÍ se incluyen. El repo exige tests por convención (cada artefacto tiene `.spec.ts`,
contract tests en `src/tests/contract/`, y `pnpm test` es gate de la constitución). Se acotan a la
lógica de mayor riesgo: reconciliación del store, paridad de contrato y componentes con interacción.

**Organization**: Tareas agrupadas por user story para implementación y testeo independientes.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` tras cambiar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md §7.5/§8.2/§9` antes de tipar DTOs.
> - **Copy de errores**: usar `getErrorCopy('SOCIAL', err)`, nunca `ApiError.message` crudo en la UI.
> - **Botones**: `t3-btn t3-btn--primary|--neutral|--destructive` (no Material crudos). `:hover` gateado tras `@media (hover: hover)`.
> - **Solo registrados**: la suscripción WS y la ruta no deben habilitarse para guests.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: A qué user story pertenece (US1, US2, US3, US4)
- Rutas de archivo exactas en cada descripción

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estructura base de la feature `social/`.

- [x] T001 Crear la estructura de carpetas de la feature en `src/app/features/social/` con subcarpetas `models/`, `services/`, `pages/friends-page/`, `components/` (vacías, listas para los archivos posteriores)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura compartida que TODAS las user stories necesitan: tipos, contrato WS,
catálogo de errores, capa REST, store (bootstrap + reconciliación + gating WS), ruta, shell de
página con tabs y acceso desde el header.

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

- [x] T002 [P] Crear DTOs REST y tipos de dominio social en `src/app/core/models/social.models.ts` (`FriendSummary`, `IncomingFriendshipRequest`, `OutgoingFriendshipRequest`, `CreateFriendshipRequestPayload`) verificados campo a campo contra `docs/CONTRATOS_API.md §8.2`
- [x] T003 [P] Definir `SocialWsEvent` (unión de los 5 eventos de amistad) en `src/app/core/models/ws.models.ts` y sumarlo a la unión `WsEvent`, contra `docs/CONTRATOS_API.md §9.5e/§9.6`
- [x] T004 [P] Agregar el scope `'SOCIAL'` a `ErrorCopyScope` y su mapeo por status en `src/app/shared/error-copy/error-copy.ts` (404 / 409·422 / 0·5xx / fallback; 401 → `''`) según `data-model.md §6`
- [x] T005 [P] Test de contrato de paridad de DTOs y `SocialWsEvent` vs `docs/CONTRATOS_API.md` en `src/tests/contract/social.contract.spec.ts` (patrón `satisfies` como el resto de `src/tests/contract/`)
- [x] T006 [P] Test del scope `'SOCIAL'` en `src/app/shared/error-copy/error-copy.spec.ts` (status → copy esperado, nunca el message del backend)
- [x] T007 Implementar `SocialApiService` con los métodos REST en `src/app/features/social/services/social-api.service.ts`: `listFriends()`, `listIncoming()`, `listOutgoing()`, `sendRequest(username)`, `acceptRequest(username)`, `declineRequest(username)`, `cancelRequest(username)`, `removeFriend(username)` (paths de `contracts/social-api.md`, `encodeURIComponent` en `username`) — depende de T002
- [x] T008 [P] Test de `SocialApiService` en `src/app/features/social/services/social-api.service.spec.ts` (verbo, URL y body de cada método con `HttpTestingController`) — depende de T007
- [x] T009 Implementar `social.store.ts` (`signalStore` root) en `src/app/features/social/services/social.store.ts` con señales `friends`/`incoming`/`outgoing`/`loading`/`error`, helpers `upsert`/`remove` por `username`, `bootstrap()` (forkJoin de las 3 listas con `getErrorCopy('SOCIAL', err)`), `start()` que gatea la suscripción a `/user/queue/social` solo si `isAuthenticated && !isGuest && username` (patrón `ProfileNotificationService`), `handleEvent()` con la tabla de transición de `data-model.md §4`, y re-bootstrap al reconectar (`WebSocketService.connected`) — depende de T002, T003, T007
- [x] T010 [P] Test de reconciliación del store en `src/app/features/social/services/social.store.spec.ts`: cada `SocialWsEvent` produce la mutación correcta, idempotencia (evento repetido = no-op), `FRIENDSHIP_REMOVED` resuelve "el otro" por `self`, eventos `RESOURCE_INVITATION_*` ignorados, y gating para guests — depende de T009
- [x] T011 Registrar la ruta `/friends` con `canMatch: [authGuard]` (loadComponent de `FriendsPageComponent`) en `src/app/app.routes.ts`
- [x] T012 Crear el shell de `FriendsPageComponent` en `src/app/features/social/pages/friends-page/friends-page.component.{ts,html,scss}`: 3 tabs (Amigos / Recibidas / Enviadas), estados `loading`/`error`/vacío, `BackButtonComponent`, dispara `store.start()` + `store.bootstrap()` en init; SCSS mobile-first 360px con único `@media (min-width: 1024px)`, tokens `--t3-…` — depende de T009, T011
- [x] T013 [P] Agregar el acceso a `/friends` en `src/app/shared/components/global-header/global-header.component.{ts,html}`, visible solo cuando `isAuthenticated && !isGuest` (espejo de `profileLink()`)

**Checkpoint**: Estado social vivo, página con tabs vacías navegable, contrato y errores tipados. Listo para las user stories.

---

## Phase 3: User Story 1 - Agregar a un amigo por username (Priority: P1) 🎯 MVP

**Goal**: Una jugadora registrada puede enviar una solicitud de amistad por username; la solicitud
aparece en "Enviadas" y la otra persona la recibe.

**Independent Test**: Enviar a un username válido → aparece en "Enviadas" como pendiente; un segundo
usuario la ve en "Recibidas". Auto-solicitud y username inexistente → error de copy, sin duplicado.

### Implementation for User Story 1

- [x] T014 [US1] Agregar al `social.store` el método `sendRequest(username)` que valida `username` no vacío y `!== self` (FR-003), llama `SocialApiService.sendRequest`, y en éxito hace `upsert` en `outgoing`; errores vía `getErrorCopy('SOCIAL', err)` en `src/app/features/social/services/social.store.ts`
- [x] T015 [P] [US1] Crear `AddFriendFormComponent` (input username + botón enviar `t3-btn--primary`, deshabilitado si vacío, muestra error/feedback inline) en `src/app/features/social/components/add-friend-form/add-friend-form.component.{ts,html,scss}`
- [x] T016 [P] [US1] Crear `OutgoingRequestRowComponent` (muestra `addresseeUsername`, marca "pendiente") en `src/app/features/social/components/outgoing-request-row/outgoing-request-row.component.{ts,html,scss}` (la acción Cancelar llega en US4)
- [x] T017 [US1] Cablear en `FriendsPageComponent`: el `AddFriendFormComponent` (en la tab Enviadas o cabecera) y la lista de `outgoing` con `OutgoingRequestRowComponent` + estado vacío, en `src/app/features/social/pages/friends-page/friends-page.component.{ts,html}` — depende de T014, T015, T016
- [x] T018 [P] [US1] Test de `AddFriendFormComponent` en `add-friend-form.component.spec.ts`: bloquea vacío y self, emite/llama el envío, muestra error de copy
- [x] T019 [P] [US1] Test del envío en `social.store.spec.ts`: éxito → upsert outgoing; self/vacío → no llama API; error → setea copy

**Checkpoint**: US1 funcional — se puede enviar una solicitud y verla en Enviadas; la reconciliación WS de la recepción ya la cubre el store (T009/T010).

---

## Phase 4: User Story 2 - Responder solicitudes recibidas (Priority: P1)

**Goal**: La jugadora ve solicitudes recibidas y puede aceptarlas (crea amistad) o rechazarlas.

**Independent Test**: Con una solicitud entrante, aceptarla → desaparece de Recibidas y aparece en
Amigos; o rechazarla → desaparece sin crear amistad. Al aceptar, el remitente ve la amistad sin recargar.

### Implementation for User Story 2

- [x] T020 [US2] Agregar al `social.store` los métodos `acceptRequest(username)` y `declineRequest(username)`: llaman al API, y en éxito `remove` de `incoming` y (accept) `upsert` en `friends`; errores con `getErrorCopy('SOCIAL', err)` en `src/app/features/social/services/social.store.ts`
- [x] T021 [P] [US2] Crear `IncomingRequestRowComponent` (muestra `requesterUsername`, botón Aceptar `t3-btn--primary` y Rechazar `t3-btn--destructive`) en `src/app/features/social/components/incoming-request-row/incoming-request-row.component.{ts,html,scss}`
- [x] T022 [US2] Cablear la tab "Recibidas" en `FriendsPageComponent`: lista de `incoming` con `IncomingRequestRowComponent` + estado vacío, conectando Aceptar/Rechazar al store — depende de T020, T021
- [x] T023 [P] [US2] Test de `IncomingRequestRowComponent` en `incoming-request-row.component.spec.ts`: emite aceptar/rechazar con el username
- [x] T024 [P] [US2] Test de accept/decline en `social.store.spec.ts`: accept → incoming remove + friends upsert; decline → incoming remove; errores setean copy

**Checkpoint**: Bucle MVP completo (enviar → recibir → aceptar = primer amigo) funcional con tiempo real.

---

## Phase 5: User Story 3 - Ver y gestionar la lista de amigos (Priority: P2)

**Goal**: La jugadora ve su lista de amigos y puede eliminar a cualquiera; la baja se refleja en
ambas partes.

**Independent Test**: Con una amistad, verla en "Amigos", eliminarla (con confirmación) → desaparece;
en la otra sesión también desaparece sin recargar.

### Implementation for User Story 3

- [x] T025 [US3] Agregar al `social.store` el método `removeFriend(username)`: quita optimista de `friends` con rollback si el API falla; error con `getErrorCopy('SOCIAL', err)` en `src/app/features/social/services/social.store.ts`
- [x] T026 [P] [US3] Crear `FriendRowComponent` (muestra `friendUsername`, botón Eliminar `t3-btn--destructive`) en `src/app/features/social/components/friend-row/friend-row.component.{ts,html,scss}`
- [x] T027 [US3] Cablear la tab "Amigos" en `FriendsPageComponent`: lista de `friends` con `FriendRowComponent` + estado vacío; Eliminar abre `ConfirmDialogComponent` (`shared/components/confirm-dialog`) antes de llamar al store — depende de T025, T026
- [x] T028 [P] [US3] Test de `FriendRowComponent` en `friend-row.component.spec.ts`: emite eliminar con el username
- [x] T029 [P] [US3] Test de removeFriend en `social.store.spec.ts`: éxito → friends remove; fallo → rollback + copy

**Checkpoint**: Ciclo de vida de la amistad completo (alta, consulta, baja).

---

## Phase 6: User Story 4 - Cancelar una solicitud enviada (Priority: P3)

**Goal**: La jugadora puede cancelar una solicitud saliente pendiente.

**Independent Test**: Con una solicitud saliente, cancelarla → desaparece de Enviadas; la destinataria
deja de verla en Recibidas sin recargar.

### Implementation for User Story 4

- [x] T030 [US4] Agregar al `social.store` el método `cancelRequest(username)`: llama al API y en éxito `remove` de `outgoing`; error con `getErrorCopy('SOCIAL', err)` en `src/app/features/social/services/social.store.ts`
- [x] T031 [US4] Agregar el botón Cancelar (`t3-btn--neutral`) a `OutgoingRequestRowComponent` en `src/app/features/social/components/outgoing-request-row/outgoing-request-row.component.{ts,html,scss}` y conectarlo al store desde la tab Enviadas de `FriendsPageComponent` — depende de T030
- [x] T032 [P] [US4] Test de cancelar en `outgoing-request-row.component.spec.ts` y `social.store.spec.ts`: emite/llama con username; éxito → outgoing remove

**Checkpoint**: Las cuatro user stories operativas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Pulido transversal y verificación de guardarraíles.

- [x] T033 [P] Test de `FriendsPageComponent` en `friends-page.component.spec.ts`: render de tabs, estados loading/error/vacío, gating de guest
- [x] T034 [P] Revisar accesibilidad/responsive a 360px de la página y filas (SC-005): sin desbordes, controles accesibles, `:hover` gateado
- [x] T035 Correr los gates completos: `pnpm lint`, `pnpm lint:styles`, `pnpm lint:themes`, `pnpm lint:hover`, `pnpm test`, `pnpm build` y corregir lo que falle
- [ ] T036 Validar el flujo manual de `quickstart.md` con dos cuentas registradas (incluye verificación de tiempo real < 3s, SC-002, y que guests no acceden, SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. BLOQUEA todas las user stories.
- **User Stories (Phase 3–6)**: dependen de Foundational. Una vez completa, pueden ir en paralelo o
  en orden de prioridad (P1 → P1 → P2 → P3).
- **Polish (Phase 7)**: depende de las user stories deseadas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Independiente.
- **US2 (P1)**: tras Foundational. Independiente (comparte store, archivos distintos salvo el método del store).
- **US3 (P2)**: tras Foundational. Independiente.
- **US4 (P3)**: extiende `OutgoingRequestRowComponent` creado en US1 (T016) — conviene hacer US1 antes.

### Within Each User Story

- Método del store → componente de fila/form → cableado en la página → tests.
- Los tests marcados [P] corren en paralelo (archivos distintos).

### Parallel Opportunities

- Foundational: T002, T003, T004, T005, T006 en paralelo; luego T007→T008, T009→T010; T011/T013 en paralelo con la página.
- Dentro de cada US: los componentes [P] y sus tests [P] en paralelo; el método del store y el cableado son secuenciales.
- US1, US2 y US3 pueden encararse en paralelo por distintas personas tras Foundational.

---

## Parallel Example: Foundational

```bash
# Tipos, contrato, errores y sus tests en paralelo:
Task: "social.models.ts (T002)"
Task: "SocialWsEvent en ws.models.ts (T003)"
Task: "scope SOCIAL en error-copy.ts (T004)"
Task: "social.contract.spec.ts (T005)"
Task: "error-copy.spec.ts scope SOCIAL (T006)"
```

## Parallel Example: User Story 2

```bash
Task: "IncomingRequestRowComponent (T021)"
Task: "incoming-request-row.component.spec.ts (T023)"
Task: "tests accept/decline en social.store.spec.ts (T024)"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1: Setup.
2. Phase 2: Foundational (CRÍTICO — bloquea todo).
3. Phase 3: US1 (enviar) → **validar**.
4. Phase 4: US2 (aceptar/rechazar) → **validar**: ya hay un amigo real con tiempo real. Demo del MVP.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → test → demo.
3. US2 → test → demo (MVP de valor completo).
4. US3 → test → demo (gestión de amigos).
5. US4 → test → demo (cancelar).
6. Polish.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- El store (`social.store.ts`) es tocado por T009, T014, T020, T025, T030: esas ediciones del mismo
  archivo NO son [P] entre sí.
- La reconciliación WS de la recepción/aceptación remota ya queda cubierta por el handler del store
  (T009/T010); las user stories agregan solo las acciones locales y su UI.
- Commit tras cada tarea o grupo lógico. Detenerse en cada checkpoint para validar la story.
- Nunca mostrar `ApiError.message`; siempre `getErrorCopy('SOCIAL', err)`.
