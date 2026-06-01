# Tasks: Sección de reglas de variante

**Input**: Design documents from `/specs/017-rules-section-fe/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rules-section-ui-contract.md](./contracts/rules-section-ui-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Se incluyen tests porque el plan y el contrato UI exigen verificar contenido crítico, ubicación exclusiva en lobby y responsividad básica.

**Organization**: Las tareas están agrupadas por user story para permitir implementación y validación incremental.

> **Guardarraíles del proyecto**:
> - SCSS bajo `src/app/features/lobby/**` debe usar solo `var(--t3-...)`.
> - No agregar endpoints, servicios HTTP ni dependencias de backend.
> - No usar botones Material crudos ni `color="primary|accent|warn"`.
> - Mantener copy visible en español.
> - Preservar reglas de juego: punto exacto a `3`, pasarse pierde, series mejor de `1`, `3` o `5`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo porque toca archivos distintos o no depende de tareas incompletas.
- **[Story]**: Mapea a las historias de usuario del spec (`US1`, `US2`, `US3`).
- Todas las tareas incluyen rutas exactas.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar estructura de archivos de la feature dentro del bounded context de lobby.

- [X] T001 Crear directorio `src/app/features/lobby/components/rules-section/`
- [X] T002 Crear directorio `src/app/features/lobby/models/`
- [X] T003 [P] Crear archivos base vacíos del componente en `src/app/features/lobby/components/rules-section/rules-section.component.ts`, `src/app/features/lobby/components/rules-section/rules-section.component.html`, `src/app/features/lobby/components/rules-section/rules-section.component.scss` y `src/app/features/lobby/components/rules-section/rules-section.component.spec.ts`
- [X] T004 [P] Crear archivo base del modelo local en `src/app/features/lobby/models/variant-rules.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Definir el modelo local de reglas que bloquea la implementación de todas las historias.

**CRITICAL**: Ninguna historia debe implementarse antes de completar esta fase.

- [X] T005 Definir tipos `VariantRuleSection` y `VariantRuleItem` en `src/app/features/lobby/models/variant-rules.ts`
- [X] T006 Cargar la colección `VARIANT_RULE_SECTIONS` en `src/app/features/lobby/models/variant-rules.ts` con los IDs `objective`, `match-format`, `falta-envido`, `fold-after-quiero`, `sword-ace-close` y `hand-fold-restriction`
- [X] T007 Verificar manualmente que `VARIANT_RULE_SECTIONS` cubre todos los bloques obligatorios de `docs/REGLAS_VARIANTE.md` y `specs/017-rules-section-fe/contracts/rules-section-ui-contract.md`

**Checkpoint**: El contenido local existe, está ordenado por tema y puede ser consumido por el componente.

---

## Phase 3: User Story 1 - Consultar reglas de la variante (Priority: P1) MVP

**Goal**: El usuario encuentra desde el lobby una página de reglas que explica el punto exacto sin información redundante.

**Independent Test**: Acceder desde el lobby a la página de reglas y verificar que muestra punto exacto a `3` sin formato de match.

### Tests for User Story 1

- [X] T008 [P] [US1] Agregar test de contenido MVP para punto exacto y formato de match en `src/app/features/lobby/components/rules-section/rules-section.component.spec.ts`
- [X] T009 [P] [US1] Agregar test de integración del lobby que verifica el CTA hacia reglas en `src/app/features/lobby/pages/lobby-page/lobby-page.component.spec.ts`

### Implementation for User Story 1

- [X] T010 [US1] Implementar `RulesSectionComponent` standalone importando `VARIANT_RULE_SECTIONS` en `src/app/features/lobby/components/rules-section/rules-section.component.ts`
- [X] T011 [US1] Renderizar título, introducción y grupos `objective` y `match-format` en `src/app/features/lobby/components/rules-section/rules-section.component.html`
- [X] T012 [US1] Estilizar la sección MVP con tokens `var(--t3-...)` en `src/app/features/lobby/components/rules-section/rules-section.component.scss`
- [X] T013 [US1] Agregar navegación `goToRules()` hacia `/lobby/reglas` en `src/app/features/lobby/pages/lobby-page/lobby-page.component.ts`
- [X] T014 [US1] Insertar el CTA de reglas debajo de los CTAs actuales en `src/app/features/lobby/pages/lobby-page/lobby-page.component.html`
- [X] T015 [US1] Ajustar espaciado del layout del lobby para alojar la sección sin romper los CTAs en `src/app/features/lobby/pages/lobby-page/lobby-page.component.scss`

**Checkpoint**: US1 está funcional y testable como MVP desde el lobby.

---

## Phase 4: User Story 2 - Entender situaciones especiales de puntuación (Priority: P2)

**Goal**: El usuario encuentra en la página de reglas Falta envido, "quiero y me voy al mazo", ancho de espada y restricción del mano para irse al mazo.

**Independent Test**: Abrir la sección del lobby y verificar que los cuatro grupos especiales aparecen con los valores y condiciones definidos por el contrato UI.

### Tests for User Story 2

- [X] T016 [P] [US2] Agregar test de contenido para Falta envido, "quiero y me voy al mazo", ancho de espada y restricción del mano en `src/app/features/lobby/components/rules-section/rules-section.component.spec.ts`
- [X] T017 [P] [US2] Agregar test de cobertura de IDs únicos y valores críticos de `VARIANT_RULE_SECTIONS` en `src/app/features/lobby/components/rules-section/rules-section.component.spec.ts`

### Implementation for User Story 2

- [X] T018 [US2] Extender el template para renderizar todos los grupos de `VARIANT_RULE_SECTIONS` sin hardcodear cada bloque en `src/app/features/lobby/components/rules-section/rules-section.component.html`
- [X] T019 [US2] Incorporar tratamiento visual consistente para valores críticos y términos de dominio en `src/app/features/lobby/components/rules-section/rules-section.component.html`
- [X] T020 [US2] Completar estilos de listas, bloques y términos críticos usando solo tokens en `src/app/features/lobby/components/rules-section/rules-section.component.scss`

**Checkpoint**: US2 está funcional y cubre el 100% de `docs/REGLAS_VARIANTE.md` como sección de lobby.

---

## Phase 5: User Story 3 - Acceder a reglas en mobile y desktop (Priority: P3)

**Goal**: La página de reglas es legible y navegable en mobile desde `360 px` y desktop desde `1024 px`, entrando desde el lobby.

**Independent Test**: Revisar la página de reglas en `360 px` y `1024 px+`, confirmar que no hay solapamientos y que la ruta queda bajo lobby.

### Tests for User Story 3

- [X] T021 [P] [US3] Agregar test que confirme que existe navegación dedicada a reglas bajo `/lobby/reglas` en `src/app/app.routes.ts` mediante revisión del routing en `src/app/features/lobby/pages/lobby-page/lobby-page.component.spec.ts`
- [X] T022 [P] [US3] Agregar expectativas de clases/estructura responsive principal en `src/app/features/lobby/components/rules-section/rules-section.component.spec.ts`

### Implementation for User Story 3

- [X] T023 [US3] Ajustar estilos mobile-first de `RulesSectionComponent` para lectura en `360 px` en `src/app/features/lobby/components/rules-section/rules-section.component.scss`
- [X] T024 [US3] Agregar único breakpoint `@media (min-width: 1024px)` para composición desktop en `src/app/features/lobby/components/rules-section/rules-section.component.scss`
- [X] T025 [US3] Revisar que `RulesSectionComponent` solo se importe desde `src/app/features/lobby/pages/lobby-page/lobby-page.component.ts`

**Checkpoint**: US3 queda validada en tamaños soportados y con ubicación exclusiva en lobby.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Validación final, documentación y consistencia con guardarraíles.

- [X] T026 [P] Revisar si `README.md` necesita mencionar que las reglas de variante visibles viven en el lobby
- [X] T027 [P] Revisar si `docs/CONTRATOS_API.md` necesita una nota cruzada hacia `docs/REGLAS_VARIANTE.md` sin cambiar contratos
- [X] T028 Ejecutar script `pnpm lint` definido en `package.json` y corregir problemas reportados
- [X] T029 Ejecutar script `pnpm lint:styles` definido en `package.json` y corregir cualquier uso de valores no tokenizados
- [X] T030 Ejecutar script `pnpm lint:themes` definido en `package.json` y corregir cualquier uso de botones Material prohibidos
- [X] T031 Ejecutar script `pnpm test` completo definido en `package.json` y corregir fallos
- [X] T032 Ejecutar script `pnpm build` definido en `package.json` y corregir errores de compilación
- [ ] T033 Validar manualmente `specs/017-rules-section-fe/quickstart.md` en lobby y página de reglas mobile/desktop

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias.
- **Foundational (Phase 2)**: Depende de Setup; bloquea todas las historias.
- **US1 (Phase 3)**: Depende de Foundational; entrega el MVP.
- **US2 (Phase 4)**: Depende de US1 porque completa el componente ya integrado.
- **US3 (Phase 5)**: Depende de US1 y puede avanzar en paralelo parcial con US2 después de que el componente exista.
- **Polish**: Depende de las historias implementadas.

### User Story Dependencies

- **US1 (P1)**: Sin dependencias de otras historias después de Foundation.
- **US2 (P2)**: Depende del componente e integración creados por US1.
- **US3 (P3)**: Depende del componente creado por US1; no depende del contenido completo de US2 para revisar ubicación exclusiva.

### Within Each User Story

- Escribir tests antes de implementación cuando la tarea de test exista.
- Modelo local antes de template.
- Template antes de estilos finales.
- Integración en lobby después de que el componente compile.
- Validar checkpoint antes de pasar a la siguiente historia.

### Parallel Opportunities

- T003 y T004 pueden ejecutarse en paralelo.
- T008 y T009 pueden ejecutarse en paralelo.
- T016 y T017 pueden ejecutarse en paralelo.
- T021 y T022 pueden ejecutarse en paralelo.
- T026 y T027 pueden ejecutarse en paralelo.

---

## Parallel Example: User Story 1

```bash
# Tests en paralelo conceptualmente, porque tocan archivos distintos:
Task: "T008 [US1] Agregar test de contenido MVP en rules-section.component.spec.ts"
Task: "T009 [US1] Agregar test de integración del CTA de reglas en lobby-page.component.spec.ts"
```

## Parallel Example: User Story 2

```bash
# Tests del componente que pueden diseñarse juntos antes de implementar:
Task: "T016 [US2] Agregar test de contenido para reglas especiales"
Task: "T017 [US2] Agregar test de cobertura de IDs únicos y valores críticos"
```

## Parallel Example: Polish

```bash
# Revisión documental independiente de la implementación:
Task: "T026 Revisar README.md"
Task: "T027 Revisar docs/CONTRATOS_API.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 y Phase 2.
2. Implementar US1 con punto exacto y formato de match.
3. Validar que el lobby muestra la sección y que los CTAs existentes siguen funcionando.
4. Detenerse y revisar el MVP antes de completar reglas especiales.

### Incremental Delivery

1. US1: sección visible en lobby con reglas centrales.
2. US2: contenido completo de condiciones especiales.
3. US3: responsividad y navegación desde lobby.
4. Polish: lint, tests, build y revisión documental.

### Validation Strategy

1. Ejecutar todos los tests con `pnpm test`, nunca por clase.
2. Ejecutar `pnpm lint`, `pnpm lint:styles`, `pnpm lint:themes` y `pnpm build`.
3. Validar manualmente el quickstart en mobile `360 px` y desktop `1024 px+`.

---

## Notes

- No crear servicios ni endpoints para esta feature.
- No mover la sección a `shared` porque el contenido pertenece al contexto de lobby.
- La ruta dedicada de reglas debe quedar bajo `/lobby/reglas`.
- Si cambia `docs/REGLAS_VARIANTE.md`, actualizar `VARIANT_RULE_SECTIONS` y los tests de valores críticos.
