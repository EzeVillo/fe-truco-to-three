---

description: "Task list para feature 019-all-achievements-profile"
---

# Tasks: Todos los logros en el perfil

**Input**: Design documents from `/specs/019-all-achievements-profile/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Se incluyen tareas de test. El proyecto tiene convención de `*.spec.ts` por unidad y
contract tests obligatorios por constitution (gate `pnpm test`); el nuevo endpoint exige un contract
test. Por eso los tests se tratan como parte integral, no opcional.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` tras cambiar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md §7.5.3` antes de tipar el DTO del catálogo.
> - **CTAs verticales**: no aplica (no se agregan CTAs nuevos); botones existentes ya usan `t3-btn`.
> - **Copy de errores**: usar `getErrorCopy('PROFILE', err)`; el fallo de catálogo degrada sin error UI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: a qué user story pertenece (US1, US2, US3)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Web app Angular standalone. Código fuente bajo `src/app/`; contract tests bajo `src/tests/contract/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificación previa, sin código nuevo de runtime.

- [X] T001 Releer `docs/CONTRATOS_API.md §7.5.3` y confirmar shape de `GET /api/achievements` (`{ achievements: [{ achievementCode }] }`) antes de tipar el DTO, según guardarraíl de contrato.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos, contrato y acceso al endpoint que TODAS las historias necesitan.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [X] T002 [P] Agregar tipos `AchievementCatalogEntry`, `AchievementsCatalogResponse` y `AchievementView` en `src/app/core/models/profile.models.ts` (campos según [data-model.md](./data-model.md)).
- [X] T003 [P] Crear contract test `src/tests/contract/achievements-catalog.contract.spec.ts`: objeto `satisfies AchievementsCatalogResponse` + parseo de `docs/CONTRATOS_API.md` verificando `GET /api/achievements` y la clave `achievementCode` (ver [contracts/achievements-catalog.md](./contracts/achievements-catalog.md)).
- [X] T004 Implementar `getAchievementsCatalog(): Observable<AchievementsCatalogResponse>` (GET `${baseUrl}/achievements`) en `src/app/features/profile/services/profile-api.service.ts` (depende de T002).
- [X] T005 [P] Agregar test en `src/app/features/profile/services/profile-api.service.spec.ts`: `getAchievementsCatalog()` hace `GET /achievements` y devuelve el body (depende de T004).

**Checkpoint**: Tipos, contrato y acceso al catálogo listos — las historias pueden comenzar.

---

## Phase 3: User Story 1 - Ver el catálogo completo con marca de desbloqueo (Priority: P1) 🎯 MVP

**Goal**: El perfil muestra TODOS los logros del juego (catálogo cruzado con desbloqueados), no sólo los desbloqueados.

**Independent Test**: Abrir un perfil con 3 de 10 logros desbloqueados y verificar que se ven los 10 (con marca de desbloqueado/bloqueado); perfil sin desbloqueos muestra los 10 bloqueados en vez del mensaje vacío.

### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] Crear `src/app/features/profile/utils/achievement-merge.spec.ts` cubriendo: unión catálogo+perfil sin duplicados (FR-011), marca `unlocked` correcta por código (FR-002), copy resuelto vía `getAchievementDisplay` incl. fallback (FR-007), y desbloqueado fuera de catálogo conservado (edge case).
- [X] T007 [US1] Agregar casos en `src/app/features/profile/pages/profile-page/profile-page.component.spec.ts`: `forkJoin` arma `achievementsView` con todos los logros; perfil sin desbloqueos → todos bloqueados; degradación cuando el catálogo falla (FR-008) muestra sólo desbloqueados; perfil que falla mantiene error (FR-009).

### Implementation for User Story 1

- [X] T008 [US1] Crear función pura `mergeAchievements(catalogCodes: string[], unlocked: UnlockedAchievement[]): AchievementView[]` en `src/app/features/profile/utils/achievement-merge.ts` (unión por `Set`, marca `unlocked`, copy vía `getAchievementDisplay`) — sin orden todavía (depende de T002).
- [X] T009 [US1] En `src/app/features/profile/pages/profile-page/profile-page.component.ts`: agregar señal `achievementsView`, reemplazar carga por `forkJoin({ catalog: getAchievementsCatalog().pipe(catchError(() => of(null))), profile: getProfile(username) })`, derivar códigos del catálogo o del perfil (degradación) y setear `achievementsView` con `mergeAchievements` (depende de T004, T008).
- [X] T010 [US1] En `src/app/features/profile/pages/profile-page/profile-page.component.html`: renderizar `achievementsView()` (en vez de `currentProfile.achievements`), mostrando nombre + descripción de cada logro; mantener mensaje vacío sólo si la lista queda vacía (depende de T009).

**Checkpoint**: US1 funcional — se ven todos los logros con su estado; degradación y error cubiertos.

---

## Phase 4: User Story 2 - Distinguir y ordenar desbloqueados vs. bloqueados (Priority: P2)

**Goal**: Desbloqueados primero (por fecha desc), bloqueados después, atenuados con candado y sin fecha.

**Independent Test**: Con logros desbloqueados en distintas fechas + bloqueados, verificar orden (desbloqueados arriba, más reciente primero) y diferenciación visual (bloqueado atenuado + candado, sin `<time>`).

### Tests for User Story 2 ⚠️

- [X] T011 [P] [US2] Ampliar `src/app/features/profile/utils/achievement-merge.spec.ts`: orden desbloqueados antes que bloqueados (FR-003), desbloqueados por `unlockedAt` descendente (FR-004), desempate estable por `code` ascendente (incluido empate de fecha).
- [X] T012 [US2] Agregar casos en `src/app/features/profile/pages/profile-page/profile-page.component.spec.ts`: el render muestra `<time>` sólo en desbloqueados, y los bloqueados llevan la clase/indicador de candado.

### Implementation for User Story 2

- [X] T013 [US2] Completar el orden en `mergeAchievements` (`src/app/features/profile/utils/achievement-merge.ts`): `unlocked` primero, luego `unlockedAt` desc, desempate por `code` asc (depende de T008).
- [X] T014 [US2] En `src/app/features/profile/pages/profile-page/profile-page.component.html`: aplicar modificador (p. ej. `profile-page__achievement--locked`), mostrar `<mat-icon>lock</mat-icon>` en bloqueados y `<time>` sólo cuando `unlocked`; importar `MatIconModule` en el componente si falta (depende de T010).
- [X] T015 [US2] En `src/app/features/profile/pages/profile-page/profile-page.component.scss`: estilo del estado bloqueado (opacidad/atenuado + candado) usando exclusivamente `var(--t3-…)`; si falta un token de atenuado, agregarlo primero en `src/styles.scss`. Correr `pnpm lint:styles` (depende de T014).

**Checkpoint**: US1 + US2 funcionando — lista completa, ordenada y visualmente diferenciada.

---

## Phase 5: User Story 3 - Reflejar un desbloqueo en tiempo real (Priority: P3)

**Goal**: Con el perfil propio abierto, un `ACHIEVEMENT_UNLOCKED` mueve el logro de bloqueado a desbloqueado sin recargar.

**Independent Test**: Con el perfil propio abierto, simular la notificación y verificar que el logro pasa a desbloqueado y se reubica; notificación de logro ya desbloqueado no duplica; perfil de otro usuario no se modifica.

### Tests for User Story 3 ⚠️

- [X] T016 [US3] Agregar casos en `src/app/features/profile/pages/profile-page/profile-page.component.spec.ts`: evento desbloquea un logro bloqueado y se reubica (FR-010); evento de logro ya desbloqueado es no-op sin duplicar (FR-011); perfil de otro usuario ignora el evento (FR-012).

### Implementation for User Story 3

- [X] T017 [US3] En `src/app/features/profile/pages/profile-page/profile-page.component.ts`: en el handler de `achievementUnlocked$` (`addUnlockedAchievement`), además de actualizar `profile`, recomputar `achievementsView` con `mergeAchievements` para reflejar el desbloqueo y reordenar; mantener el guard `authStore.username() === username()` (depende de T009, T013).

**Checkpoint**: Las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final y gates del proyecto.

- [X] T018 [P] Ejecutar `pnpm lint` y `pnpm lint:styles` y corregir hallazgos en los archivos tocados.
- [X] T019 Ejecutar `pnpm test` (incluye unit + contract `achievements-catalog.contract.spec.ts`) y `pnpm build`; resolver fallos.
- [ ] T020 Validar manualmente según [quickstart.md](./quickstart.md) en mobile (360 px) y desktop (1024 px+).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. BLOQUEA todas las historias.
- **User Stories (Phase 3-5)**: dependen de Foundational. US1 es el MVP; US2 y US3 extienden a US1.
- **Polish (Phase 6)**: depende de las historias deseadas completas.

### User Story Dependencies

- **US1 (P1)**: arranca tras Foundational. Independiente.
- **US2 (P2)**: extiende US1 (orden en el merge + estilo del render). Recomendado tras US1.
- **US3 (P3)**: usa el merge ya ordenado (T013) y la carga de US1 (T009). Recomendado tras US1/US2.

### Within Each User Story

- Tests primero (deben fallar), luego implementación.
- En US1: util de merge (T008) antes de la carga del componente (T009) antes del template (T010).

### Parallel Opportunities

- **Foundational**: T002, T003 y T005 son `[P]` (archivos distintos); T004 depende de T002.
- **US1**: T006 `[P]` (spec del util) puede escribirse mientras se prepara T007.
- **US2**: T011 `[P]` (spec del merge) en paralelo a la preparación del render.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# En paralelo (archivos distintos):
Task: "T002 tipos en src/app/core/models/profile.models.ts"
Task: "T003 contract test en src/tests/contract/achievements-catalog.contract.spec.ts"
# Luego, secuencial:
Task: "T004 getAchievementsCatalog() en profile-api.service.ts (tras T002)"
Task: "T005 test del service (tras T004)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup.
2. Phase 2: Foundational (CRÍTICO — bloquea historias).
3. Phase 3: US1 → lista completa con marca de desbloqueo.
4. **STOP y validar** US1 de forma independiente.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → todos los logros visibles (MVP).
3. US2 → orden + diferenciación visual.
4. US3 → desbloqueo en tiempo real.
5. Polish → gates verdes.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes.
- El merge se aísla en `achievement-merge.ts` (función pura) → testeable sin TestBed.
- `mergeAchievements` se implementa en dos pasos: unión+marca (T008, US1) y orden (T013, US2).
- Verificar que los tests fallan antes de implementar.
- Commit tras cada tarea o grupo lógico.
- No mostrar `ApiError.message` crudo; catálogo que falla degrada sin error UI.
