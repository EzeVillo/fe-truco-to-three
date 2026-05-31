# Tasks: Sistema de logros

**Input**: Design documents from `/specs/016-achievement-system/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. La feature toca contratos, auth persistida, perfil, errores y WebSocket; los tests deben escribirse antes de la implementacion de cada bloque y validarse ejecutando siempre `pnpm test` completo, nunca tests por clase.

**Organization**: Tareas agrupadas por historia de usuario para permitir entregas incrementales e independientes.

> **Guardarrailes del proyecto**:
> - **Tokens CSS**: SCSS de feature/shared solo con `var(--t3-...)`; verificar con `pnpm lint:styles`.
> - **Contrato de endpoints**: validar DTOs campo a campo contra `docs/CONTRATOS_API.md` antes de tipar o consumir endpoints.
> - **CTAs tematizados**: no usar `mat-flat-button`, `mat-raised-button`, `mat-fab`, `mat-mini-fab` ni `color="primary|accent|warn"` en templates de feature/shared.
> - **Copy de errores**: usar `getErrorCopy()`, nunca `ApiError.message` crudo en UI.
> - **Reglas de juego**: no tocar scoring ni series; bots no generan logros visibles.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Crear la estructura base de la feature y preparar los archivos compartidos.

- [x] T001 Crear estructura de carpetas `src/app/features/profile/pages/profile-page/`, `src/app/features/profile/services/`, `src/app/features/profile/models/` y `src/app/features/profile/utils/`
- [x] T002 [P] Crear archivo de modelos de perfil vacio en `src/app/core/models/profile.models.ts`
- [x] T003 [P] Crear archivo de catalogo de logros vacio en `src/app/features/profile/models/achievement-catalog.ts`
- [x] T004 [P] Crear archivo de utilidades de display de logros vacio en `src/app/features/profile/utils/achievement-display.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Alinear contratos compartidos, auth y copy de errores antes de implementar historias.

**CRITICAL**: No empezar historias de usuario hasta completar esta fase.

- [x] T005 [P] Agregar tests de contrato para `username` en auth y perfil en `src/tests/contract/auth-profile.contract.spec.ts`
- [x] T006 [P] Agregar tests de contrato para evento `ACHIEVEMENT_UNLOCKED` en `src/tests/contract/profile-ws.contract.spec.ts`
- [x] T007 Actualizar `FullAuthResponse`, `AuthResponse`, `AuthSession` y agregar `CurrentIdentityResponse` en `src/app/core/models/auth.models.ts`
- [x] T008 Actualizar `AuthState`, `PersistedSession`, `deriveSession()` e hidratacion legacy con `username` en `src/app/core/auth/auth.store.ts`
- [x] T009 Agregar metodo de reemplazo de sesion post-refresh y metodo de identidad actual en `src/app/core/auth/auth.store.ts`
- [x] T010 Actualizar `AuthService.refresh()` para aplicar la respuesta completa con `playerId`, `username`, `accessToken` y `refreshToken` en `src/app/core/auth/auth.service.ts`
- [x] T011 Agregar `AuthService.me()` para `GET /api/auth/me` en `src/app/core/auth/auth.service.ts`
- [x] T012 Actualizar `AUTH_PUBLIC_PATHS` para mantener `/api/auth/me` protegido en `src/app/core/auth/auth.tokens.ts`
- [x] T013 Agregar tipos `PlayerProfile`, `PlayerStats`, `UnlockedAchievement`, `AchievementDefinition` y `ProfileWsEvent` en `src/app/core/models/profile.models.ts`
- [x] T014 Exportar modelos de perfil desde `src/app/core/models/index.ts`
- [x] T015 Agregar scope `PROFILE` a `ErrorCopyScope` con copies para 401, 404, 0 y 5xx en `src/app/shared/error-copy/error-copy.ts`
- [x] T016 [P] Agregar tests de auth store para username registrado, invitado y sesion legacy en `src/app/core/auth/auth.store.spec.ts`
- [x] T017 [P] Agregar tests de refresh con username y refresh token rotado en `src/app/core/auth/refresh.interceptor.flow.spec.ts`
- [x] T018 [P] Agregar tests de copy de errores de perfil en `src/app/shared/error-copy/error-copy.spec.ts`

**Checkpoint**: Contratos, identidad y errores listos para construir historias.

---

## Phase 3: User Story 1 - Ver perfil con estadisticas y logros (Priority: P1) MVP

**Goal**: Un jugador registrado puede abrir un perfil existente y ver estadisticas, logros o estado vacio.

**Independent Test**: Ingresar con usuario registrado, abrir `/profile/<username>` y verificar stats, logros y estado vacio sin depender de notificaciones en tiempo real.

### Tests for User Story 1

- [x] T019 [P] [US1] Agregar tests de catalogo y fallback de logros en `src/app/features/profile/utils/achievement-display.spec.ts`
- [x] T020 [P] [US1] Agregar tests de `ProfileApiService.getProfile()` en `src/app/features/profile/services/profile-api.service.spec.ts`
- [x] T021 [P] [US1] Agregar tests de render de perfil con logros y sin logros en `src/app/features/profile/pages/profile-page/profile-page.component.spec.ts`

### Implementation for User Story 1

- [x] T022 [P] [US1] Implementar catalogo inicial con `WIN_RETRUCO_FROM_0_0_TO_3` y fallback en `src/app/features/profile/models/achievement-catalog.ts`
- [x] T023 [US1] Implementar `getAchievementDisplay()` y formateo de contexto de logro en `src/app/features/profile/utils/achievement-display.ts`
- [x] T024 [US1] Implementar `ProfileApiService.getProfile(username)` en `src/app/features/profile/services/profile-api.service.ts`
- [x] T025 [US1] Crear `ProfilePageComponent` con carga por parametro `username` en `src/app/features/profile/pages/profile-page/profile-page.component.ts`
- [x] T026 [US1] Crear template de perfil con stats, lista de logros y estado vacio en `src/app/features/profile/pages/profile-page/profile-page.component.html`
- [x] T027 [US1] Crear estilos responsive con tokens `var(--t3-...)` en `src/app/features/profile/pages/profile-page/profile-page.component.scss`
- [x] T028 [US1] Registrar ruta `/profile/:username` protegida por auth en `src/app/app.routes.ts`

**Checkpoint**: US1 completa y testeable de forma independiente.

---

## Phase 4: User Story 3 - Identidad persistente para acceder al perfil propio (Priority: P2)

**Goal**: Usuarios registrados conservan identidad visible y acceden a su perfil desde la navegacion principal; invitados no ven ese acceso.

**Independent Test**: Login registrado, recarga de aplicacion y verificacion de username + link a perfil; login invitado y verificacion de ausencia de perfil propio.

### Tests for User Story 3

- [x] T029 [P] [US3] Agregar tests de rehidratacion de identidad incompleta en `src/app/core/auth/auth.service.spec.ts`
- [x] T030 [P] [US3] Agregar tests de header con username registrado, invitado y link de perfil en `src/app/shared/components/global-header/global-header.component.spec.ts`

### Implementation for User Story 3

- [x] T031 [US3] Implementar flujo de rehidratacion de sesion legacy con `GET /api/auth/me` en `src/app/core/auth/auth.service.ts`
- [x] T032 [US3] Inicializar rehidratacion de identidad desde el shell sin bloquear rutas existentes en `src/app/app.ts`
- [x] T033 [US3] Actualizar `GlobalHeaderComponent.userLabel()` y helpers de perfil propio en `src/app/shared/components/global-header/global-header.component.ts`
- [x] T034 [US3] Actualizar template del header para mostrar username y link a perfil solo en usuarios registrados en `src/app/shared/components/global-header/global-header.component.html`
- [x] T035 [US3] Ajustar estilos del header con tokens y layout responsive en `src/app/shared/components/global-header/global-header.component.scss`

**Checkpoint**: US3 completa y testeable de forma independiente.

---

## Phase 5: User Story 2 - Recibir aviso al desbloquear un logro (Priority: P2)

**Goal**: Un usuario registrado recibe una notificacion visible y deduplicada cuando llega un logro desbloqueado.

**Independent Test**: Simular `ACHIEVEMENT_UNLOCKED` en `/user/queue/profile` y verificar aviso con nombre/descripcion; repetir evento y verificar que no duplica.

### Tests for User Story 2

- [x] T036 [P] [US2] Agregar tests de suscripcion, exclusion de invitados y deduplicacion en `src/app/features/profile/services/profile-notification.service.spec.ts`
- [x] T037 [P] [US2] Agregar tests de inicializacion global de notificaciones en `src/app/app.spec.ts`

### Implementation for User Story 2

- [x] T038 [US2] Implementar `ProfileNotificationService` con suscripcion a `/user/queue/profile` solo para usuarios registrados en `src/app/features/profile/services/profile-notification.service.ts`
- [x] T039 [US2] Integrar display de logros y fallback en notificaciones dentro de `src/app/features/profile/services/profile-notification.service.ts`
- [x] T040 [US2] Inicializar `ProfileNotificationService` desde el shell de aplicacion en `src/app/app.ts`
- [x] T041 [US2] Reflejar logro nuevo en perfil propio abierto sin duplicarlo en `src/app/features/profile/pages/profile-page/profile-page.component.ts`

**Checkpoint**: US2 completa y testeable de forma independiente.

---

## Phase 6: User Story 4 - Manejar perfiles no disponibles (Priority: P3)

**Goal**: Perfiles inexistentes, invitados o errores de sesion muestran salidas claras.

**Independent Test**: Abrir `/profile/<usuario-inexistente>`, simular 401 y verificar copies frontend y navegacion de salida.

### Tests for User Story 4

- [x] T042 [P] [US4] Agregar tests de errores 404, 401 y red en `src/app/features/profile/pages/profile-page/profile-page.component.spec.ts`

### Implementation for User Story 4

- [x] T043 [US4] Agregar estados de error de perfil no encontrado, sesion invalida y red en `src/app/features/profile/pages/profile-page/profile-page.component.ts`
- [x] T044 [US4] Agregar mensajes de error y acciones de volver/reintentar con clases `t3-btn` en `src/app/features/profile/pages/profile-page/profile-page.component.html`
- [x] T045 [US4] Ajustar estilos de estados de error con tokens `var(--t3-...)` en `src/app/features/profile/pages/profile-page/profile-page.component.scss`

**Checkpoint**: US4 completa y testeable de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de calidad, documentacion y validacion completa.

- [x] T046 [P] Actualizar `docs/CONTRATOS_API.md` si durante la implementacion se detecta divergencia en auth, perfil o eventos de logros
- [x] T047 [P] Actualizar `README.md` con acceso a perfil/logros y aclaracion de que invitados y bots no generan logros
- [x] T048 Ejecutar `pnpm test` completo y corregir fallas sin ejecutar tests por clase
- [x] T049 Ejecutar `pnpm lint` y corregir hallazgos en los archivos modificados
- [x] T050 Ejecutar `pnpm lint:styles` y corregir cualquier uso de estilos fuera de tokens
- [x] T051 Ejecutar `pnpm lint:themes` y corregir cualquier boton Material crudo prohibido
- [x] T052 Ejecutar `pnpm build` y corregir errores de compilacion
- [x] T053 Validar manualmente el flujo de [quickstart.md](./quickstart.md) contra backend local

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias.
- **Foundational (Phase 2)**: Depende de Setup y bloquea todas las historias.
- **US1 Perfil (Phase 3)**: Depende de Foundational; entrega el MVP.
- **US3 Identidad (Phase 4)**: Depende de Foundational; puede avanzar en paralelo con US1 si se coordinan cambios en auth/header.
- **US2 Notificaciones (Phase 5)**: Depende de Foundational y usa catalogo/display de US1; puede arrancar luego de T022-T023.
- **US4 Errores (Phase 6)**: Depende de US1 porque extiende la pagina de perfil.
- **Polish (Phase 7)**: Depende de las historias deseadas para el corte.

### User Story Dependencies

- **User Story 1 (P1)**: MVP, sin dependencia de otras historias luego de Foundational.
- **User Story 3 (P2)**: Independiente de US1 para identidad, pero el link del header apunta a la ruta de US1.
- **User Story 2 (P2)**: Requiere catalogo/display de logros de US1 para avisos consistentes.
- **User Story 4 (P3)**: Extiende la pagina de perfil creada por US1.

### Within Each User Story

- Tests antes de implementacion.
- Modelos/catalogos antes de servicios.
- Servicios antes de componentes.
- Componentes TypeScript antes de HTML/SCSS cuando dependan de estado.
- Validar cada checkpoint antes de continuar a la siguiente prioridad.

### Parallel Opportunities

- T002, T003 y T004 pueden ejecutarse en paralelo.
- T005, T006, T016, T017 y T018 pueden ejecutarse en paralelo tras crear archivos base.
- T019, T020 y T021 pueden ejecutarse en paralelo.
- T029 y T030 pueden ejecutarse en paralelo.
- T036 y T037 pueden ejecutarse en paralelo.
- T046 y T047 pueden ejecutarse en paralelo durante el cierre si no hay cambios contractuales pendientes.

---

## Parallel Example: User Story 1

```text
Task: "T019 [P] [US1] Agregar tests de catalogo y fallback de logros en src/app/features/profile/utils/achievement-display.spec.ts"
Task: "T020 [P] [US1] Agregar tests de ProfileApiService.getProfile() en src/app/features/profile/services/profile-api.service.spec.ts"
Task: "T021 [P] [US1] Agregar tests de render de perfil con logros y sin logros en src/app/features/profile/pages/profile-page/profile-page.component.spec.ts"
```

## Parallel Example: User Story 2

```text
Task: "T036 [P] [US2] Agregar tests de suscripcion, exclusion de invitados y deduplicacion en src/app/features/profile/services/profile-notification.service.spec.ts"
Task: "T037 [P] [US2] Agregar tests de inicializacion global de notificaciones en src/app/app.spec.ts"
```

## Parallel Example: User Story 3

```text
Task: "T029 [P] [US3] Agregar tests de rehidratacion de identidad incompleta en src/app/core/auth/auth.service.spec.ts"
Task: "T030 [P] [US3] Agregar tests de header con username registrado, invitado y link de perfil en src/app/shared/components/global-header/global-header.component.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 y Phase 2.
2. Completar Phase 3: perfil consultable por username.
3. Ejecutar `pnpm test`, `pnpm lint`, `pnpm lint:styles`, `pnpm lint:themes` y `pnpm build`.
4. Validar manualmente perfil con logros, sin logros y usuario inexistente si US4 ya esta incluido.

### Incremental Delivery

1. Foundation: contratos, auth username, modelos y errores.
2. US1: pagina de perfil como MVP.
3. US3: identidad visible y acceso desde header.
4. US2: notificaciones globales de logros.
5. US4: estados de error completos.
6. Polish: docs, validacion completa y quickstart.

### Notes

- Todas las tareas incluyen rutas exactas y formato checklist.
- Las tareas marcadas `[P]` no deben tocar el mismo archivo que otra tarea paralela.
- No ejecutar tests por clase; usar siempre `pnpm test` completo cuando toque verificar.
- Si una tarea descubre divergencia de backend, actualizar primero `docs/CONTRATOS_API.md` y luego ajustar tipos/implementacion.
