# Tasks: Corrección de Lobby vs Bots y Guardarraíles de Consistencia

**Input**: Design documents from `/specs/004-lobby-bots-fixes/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/POST_api_matches_bot.md ✅ · quickstart.md ✅

**Nota**: Esta feature incluye tests porque el plan.md los exige explícitamente (contract test, unit tests actualizados).

**Organización**: Tareas agrupadas por historia de usuario para implementación y validación independiente.

## Formato: `[ID] [P?] [Story] Descripción con ruta`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)
- Se incluyen rutas exactas de archivo en cada descripción

---

## Phase 1: Setup — Infraestructura de Tooling (Stylelint)

**Propósito**: Configurar stylelint como dependencia del proyecto y habilitar el script `lint:styles` antes de cualquier otro trabajo, ya que la US1 lo necesita para verificar sus cambios y la US3 lo entrega como guardarraíl.

- [X] T001 Instalar `stylelint` y `stylelint-config-standard-scss` como devDependencies con `pnpm add -D stylelint stylelint-config-standard-scss` y añadir el script `"lint:styles": "stylelint 'src/app/features/**/*.scss'"` en `package.json`
- [X] T002 Crear `.stylelintrc.json` en la raíz del proyecto con `extends: stylelint-config-standard-scss`, reglas `color-no-hex: true` y `declaration-property-value-disallowed-list` para patrones `rgb(`, `rgba(`, `hsl(`, `hsla(` literales, limitado a `src/app/features/**/*.scss` (excluyendo `src/styles.scss`)
- [X] T003 Integrar `pnpm lint:styles` en `lint-staged` dentro de `package.json` (o `.lintstagedrc`) para que falle en pre-commit ante colores hardcodeados en SCSS de feature

**Checkpoint**: `pnpm lint:styles` corre sin errores sobre el código actual. Setup listo.

---

## Phase 2: Foundational — Modelo base corregido

**Propósito**: Corrección del DTO `CreateBotMatchRequest` y la función `seriesFormatToGamesToPlay` en `src/app/core/models/match.models.ts`. Este cambio es prerequisito para US2 (el contrato correcto) y para US3 (el contract test verifica estos tipos). **NINGUNA historia de usuario puede completarse sin este cambio.**

**⚠️ CRÍTICO**: No iniciar implementación de historias de usuario hasta completar esta fase.

- [X] T004 Corregir `seriesFormatToGamesToPlay` para retornar `1 | 3 | 5` (mapeo `BEST_OF_1→1`, `BEST_OF_3→3`, `BEST_OF_5→5`) y actualizar `CreateBotMatchRequest.gamesToPlay` a tipo literal `1 | 3 | 5` (eliminando el `2`) en `src/app/core/models/match.models.ts`

**Checkpoint**: Foundation lista. Las historias de usuario pueden comenzar.

---

## Phase 3: User Story 1 — CTA "Jugar contra bots" fiel al diseño del producto (P1) 🎯 MVP

**Goal**: El CTA en `/lobby` usa exclusivamente design tokens `--t3-…`, muestra título y descripción en dos líneas apiladas verticalmente con separación visible, altura ≤ 96 px en mobile y proporciones equilibradas en desktop.

**Independent Test**: Abrir `/lobby` en DevTools a 360×780 y 1440×900; verificar que el CTA ocupa ≤ 96 px de alto, título y descripción están en líneas separadas con espacio visible, y `pnpm lint:styles` no reporta errores en `src/app/features/lobby/**/*.scss`.

### Tests para User Story 1

> **NOTA: Escribir estos tests PRIMERO y verificar que FALLAN antes de la implementación**

- [X] T005 [P] [US1] Añadir tests de inspección visual (alto del CTA, jerarquía vertical título/descripción, ausencia de `mat-flat-button`) y de tokens en `src/app/features/lobby/pages/lobby-page/lobby-page.component.spec.ts`

### Implementación de User Story 1

- [X] T006 [US1] Reemplazar el `<button mat-flat-button>` actual por `<button type="button" class="lobby__cta">` con dos `<span>` internos (`cta-title` y `cta-subtitle`) apilados verticalmente en `src/app/features/lobby/pages/lobby-page/lobby-page.component.html`
- [X] T007 [US1] Reescribir los estilos del selector `.lobby__cta` en `src/app/features/lobby/pages/lobby-page/lobby-page.component.scss` usando exclusivamente tokens: `--t3-green-700/600` (fondo), `--t3-gold-400` (acento/focus), `--t3-text`/`--t3-text-muted` (tipografía), `--t3-radius-md`, `--t3-gap-xs/sm` (separación título/subtítulo y padding), `--t3-shadow-card`; asegurando `display: flex; flex-direction: column`, altura máxima ≤ 96 px en mobile y `max-width: 640px` en desktop
- [X] T008 [US1] Verificar que `pnpm lint:styles` pasa sin errores sobre `src/app/features/lobby/**/*.scss` después de los cambios de T006 y T007 (validación local del guardarraíl)

**Checkpoint**: User Story 1 funcional y testeable de forma independiente. El lobby muestra el CTA con paleta correcta y jerarquía visual.

---

## Phase 4: User Story 2 — Crear partida vs bot end-to-end respetando el contrato (P1)

**Goal**: La request `POST /api/matches/bot` desde `/lobby/bots` envía el payload exacto `{ botId, gamesToPlay: 1|3|5 }`, recibe `200 { matchId }` y navega a `/match/:matchId`. Los errores 4xx muestran el copy del catálogo del front, nunca `ApiError.message` crudo. El botón "Jugar" queda inhabilitado durante la solicitud (idempotencia).

**Independent Test**: Desde `/lobby/bots`, seleccionar bot, mantener "Mejor de 3", presionar "Jugar". Verificar en Network que el payload tiene `gamesToPlay: 3` (no `2`), la respuesta es `200` y la UI navega a `/match/<uuid>`.

### Tests para User Story 2

> **NOTA: Actualizar estos tests para que FALLEN antes de ajustar la implementación (el cambio foundational T004 ya rompe los tests previos)**

- [X] T009 [P] [US2] Actualizar `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.spec.ts`: corregir assertions del mapeo `BEST_OF_3 → gamesToPlay: 3`, añadir cobertura de errores (`InvalidGamesToPlayException`, `BotNotFoundException`, `PlayerHasActiveMatchException`, `PlayerHasOpenRematchSessionException`, `PlayerAlreadyInQueueException`) verificando que ninguno renderiza `ApiError.message` crudo, y añadir test de doble-click (solo una request HTTP sale)
- [X] T010 [P] [US2] Actualizar `src/app/features/lobby/services/bots-api.service.spec.ts`: corregir assertions para payloads `gamesToPlay: 1`, `3` y `5`, eliminando el caso `2`

### Implementación de User Story 2

- [X] T011 [US2] Revisar `src/app/features/lobby/pages/bots-config-page/bots-config-page.component.ts` para confirmar que llama `seriesFormatToGamesToPlay` (ya corregido en T004) y que `getErrorCopy('CREATE_BOT_MATCH', err)` cubre todos los códigos listados en el contrato (`§9.2`); no debe renderizarse `ApiError.message` crudo en ningún path de error

**Checkpoint**: User Stories 1 Y 2 funcionan de forma independiente. `POST /api/matches/bot` con "Mejor de 3" ya no produce `422 InvalidGamesToPlayException`.

---

## Phase 5: User Story 3 — Guardarraíles anti-regresión (P1)

**Goal**: El proyecto cuenta con (a) stylelint que detecta colores hardcodeados en SCSS de feature, (b) un contract test que verifica paridad de `CreateBotMatchRequest`/`CreateBotMatchResponse` con `docs/CONTRATOS_API.md §9.2`, y (c) la corrección documental de `§9.2` que describe `gamesToPlay` correctamente.

**Independent Test**: (a) Introducir `color: #ffffff` en un SCSS de feature → `pnpm lint:styles` falla; (b) Añadir un campo extra a `CreateBotMatchRequest` → el contract test falla; (c) `docs/CONTRATOS_API.md §9.2` dice "Partidas totales de la serie (mejor de N). Valores válidos: 1, 3, 5".

### Implementación de User Story 3

- [X] T012 [P] [US3] Crear `src/tests/contract/create-bot-match.contract.spec.ts`: test Vitest que (1) lee `docs/CONTRATOS_API.md`, (2) extrae la sección `### 9.2 Crear partida contra bot`, (3) parsea la tabla de campos request/response, (4) compara contra `CreateBotMatchRequest` y `CreateBotMatchResponse` vía `satisfies`, (5) verifica que `seriesFormatToGamesToPlay('BEST_OF_3') === 3` y análogos, (6) falla ante campos extra, faltantes o renombrados en cualquier dirección
- [X] T013 [US3] Corregir `docs/CONTRATOS_API.md §9.2`: actualizar la descripción del campo `gamesToPlay` de "Partidas a ganar para terminar el match" a "Partidas totales de la serie (mejor de N). Valores válidos: 1, 3, 5" (FR-007a)

**Checkpoint**: Las tres historias de usuario son funcionales y los guardarraíles operativos. `pnpm lint:styles` y `pnpm test` pasan en verde.

---

## Phase 6: Polish — Guardarraíles Documentales y Reglas del Proyecto

**Propósito**: Actualizar los artefactos de guía del proyecto para que los defectos corregidos no reaparezcan en futuras features (FR-012, SC-006).

- [X] T014 [P] Actualizar `CLAUDE.md`: añadir secciones explícitas sobre (a) consumo obligatorio de tokens `--t3-…` en SCSS de feature, (b) validación cruzada campo a campo contra `docs/CONTRATOS_API.md` antes de tipar/consumir un endpoint, y (c) CTAs con título + descripción apilados verticalmente por defecto
- [X] T015 [P] Ratificar `.specify/memory/constitution.md`: reemplazar los placeholders `[PRINCIPLE_X_NAME]` con los tres principios: (1) Design tokens obligatorios en SCSS de feature (verificado por `lint:styles`), (2) Validación cruzada con `docs/CONTRATOS_API.md` antes de tipar/consumir endpoints (cubierto por contract tests), (3) CTAs con título + descripción apilados verticalmente por defecto con `--t3-gap-xs` mínimo
- [X] T016 [P] Actualizar `.specify/templates/plan-template.md`: añadir en el Constitution Check del template los tres principios ratificados como ítems obligatorios del checklist de gates
- [X] T017 [P] Actualizar `.specify/templates/tasks-template.md`: añadir en los comentarios de instrucciones y en la sección de notas referencias explícitas a los guardarraíles de tokens, contrato y CTAs verticales
- [X] T018 Ejecutar la suite completa del quickstart (`pnpm lint`, `pnpm lint:styles`, `pnpm test`, `pnpm build`) y confirmar que todo pasa en verde antes del cierre

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Setup (Phase 1)**: Sin dependencias. Puede comenzar de inmediato.
- **Foundational (Phase 2)**: Depende de que Phase 1 esté completa. **Bloquea todas las historias de usuario.**
- **User Stories (Phase 3, 4, 5)**: Todas dependen de la finalización de Phase 2.
  - US1 (Phase 3) y US2 (Phase 4) pueden ejecutarse en paralelo si hay capacidad.
  - US3 (Phase 5) depende lógicamente de T004 (T012 verifica los tipos de US2) pero el test puede escribirse en paralelo.
- **Polish (Phase 6)**: Depende de que las tres historias de usuario estén completas.

### Dependencias entre historias de usuario

- **US1 (P1)**: Puede comenzar después de Phase 2. Sin dependencias en otras historias.
- **US2 (P1)**: Puede comenzar después de Phase 2 (T004 es el prerequisito clave). Sin dependencias en US1.
- **US3 (P1)**: Puede comenzar en paralelo con US1/US2. T012 depende de T004 (para tipar las keys). T013 (docs) es independiente.

### Dentro de cada historia

- Tests escritos **antes** de la implementación correspondiente (TDD).
- T006 (HTML) antes de T007 (SCSS) en US1.
- T009 y T010 son paralelos entre sí en US2.
- T014–T017 son paralelos entre sí en Phase 6.

### Oportunidades de paralelismo

- T001, T002, T003 (Phase 1) en paralelo.
- T005 (escribir test US1) en paralelo con preparar el entorno.
- T009 y T010 (tests US2) en paralelo.
- T012 (contract test US3) en paralelo con T009/T010.
- T014, T015, T016, T017 (Phase 6) en paralelo.

---

## Ejemplo de ejecución en paralelo: US2 + US3 (tests)

```bash
# Lanzar en paralelo una vez completado T004:
Tarea: "T009 — actualizar bots-config-page.component.spec.ts (US2)"
Tarea: "T010 — actualizar bots-api.service.spec.ts (US2)"
Tarea: "T012 — crear create-bot-match.contract.spec.ts (US3)"
```

---

## Implementation Strategy

### MVP (US1 + US2 únicamente)

1. Completar Phase 1: Setup (T001–T003)
2. Completar Phase 2: Foundational (T004) — **CRÍTICO**
3. Completar Phase 3: US1 (T005–T008)
4. Completar Phase 4: US2 (T009–T011)
5. **PARAR Y VALIDAR**: Verificar US1 y US2 de forma independiente con el quickstart
6. Entregar si el lobby está visualmente correcto y `POST /api/matches/bot` responde `200`

### Entrega incremental completa

1. Setup + Foundational → base lista
2. US1 → CTA visual fiel al diseño → validar → demo
3. US2 → Partida vs bot funciona end-to-end → validar → demo
4. US3 → Guardarraíles operativos → validar con pruebas deliberadas
5. Phase 6 → Reglas documentadas → cierre formal de la feature

### Estrategia con un solo desarrollador

1. Completar Phases 1 y 2 secuencialmente (base imprescindible)
2. US1, US2 y US3 secuencialmente en ese orden de prioridad
3. Phase 6 al final como trabajo documental paralizable

---

## Notes

- `[P]` = archivos distintos, sin dependencias; pueden correr en paralelo
- Etiqueta `[USn]` = trazabilidad a historia de usuario específica
- Cada historia de usuario es completable y testeable de forma independiente
- Verificar que los tests **fallan** antes de implementar (aplica especialmente a T005, T009, T010, T012)
- Hacer commit después de cada tarea o grupo lógico
- Detenerse en cualquier checkpoint para validar la historia de forma independiente
- **Guardarraíl crítico**: `pnpm lint:styles` debe ejecutarse después de T007 (US1) para confirmar que no quedan literales de color
- **Guardarraíl crítico**: `pnpm test -- tests/contract/` debe ejecutarse después de T004 para confirmar el contract test pasa con el modelo corregido
