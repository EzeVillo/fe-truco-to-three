# Research: Todos los logros en el perfil

**Feature**: 019-all-achievements-profile | **Fase 0**

No quedaron marcadores `NEEDS CLARIFICATION` en el Technical Context. Las dos decisiones de producto
(fallback de catálogo y estilo de bloqueados) se resolvieron con el usuario antes de la spec. Este
documento consolida las decisiones técnicas.

## Decisión 1: Endpoint de catálogo

- **Decisión**: Consumir `GET /api/achievements` (Bearer token), que devuelve
  `{ "achievements": [{ "achievementCode": "…" }] }` — sólo códigos, sin nombre/descripción ni estado
  de desbloqueo (§7.5.3 del contrato).
- **Rationale**: Es la fuente autoritativa de "qué logros existen", pensada explícitamente para armar
  la grilla "todos los logros con marca de desbloqueado" cruzando con `GET /api/profile/{username}`
  por `achievementCode`. Evita hardcodear la lista de códigos en el front.
- **Alternativas consideradas**:
  - *Hardcodear el set de códigos en el front (el `ACHIEVEMENT_CATALOG` actual)*: rechazada porque el
    catálogo del backend puede crecer y quedaría desincronizado. El catálogo del backend manda qué
    existe; el front sólo aporta el copy legible por código.

## Decisión 2: Combinación de requests

- **Decisión**: `forkJoin({ catalog, profile })` en el componente. Al `catalog` se le aplica
  `catchError(() => of(null))` para que su fallo no tumbe el `forkJoin`; el `profile` conserva su
  manejo de error actual (estado de error + reintento).
- **Rationale**: Cumple FR-008 (degradar a sólo-desbloqueados si el catálogo falla) y FR-009 (mantener
  error si falla el perfil) en una sola suscripción. `forkJoin` emite cuando ambas completan, ideal
  para dos GET de una sola emisión.
- **Alternativas consideradas**:
  - *Dos suscripciones independientes*: más estados intermedios y carreras; descartada por complejidad.
  - *`combineLatest`*: innecesario, no hay streams continuos.

## Decisión 3: Resolución de nombre/descripción

- **Decisión**: Reutilizar `getAchievementDisplay(code)` de `achievement-display.ts`, que mapea código
  → `{ name, description }` y ya tiene fallback `UNKNOWN_ACHIEVEMENT` para códigos no contemplados.
- **Rationale**: Cumple FR-007 sin lógica nueva. El contrato confirma que el front resuelve el copy a
  partir del código.

## Decisión 4: Modelo de merge y orden

- **Decisión**: Función pura `mergeAchievements(catalogCodes, unlocked)` → `AchievementView[]`:
  1. Unir el set de códigos del catálogo con los del perfil (FR-001, edge: desbloqueado fuera de catálogo se conserva).
  2. Para cada código, `unlocked` si está en el perfil, copiando `unlockedAt`/`matchId`/`gameNumber`.
  3. Resolver `name`/`description` vía `getAchievementDisplay`.
  4. Ordenar: desbloqueados antes que bloqueados (FR-003); dentro de desbloqueados por `unlockedAt`
     descendente (FR-004); desempate estable por `achievementCode` ascendente; bloqueados por
     `achievementCode` ascendente.
- **Rationale**: Función pura → test directo sin TestBed (FR-002/003/004/011). Orden determinista para
  `track` de Angular y para SC-002.
- **Alternativas consideradas**:
  - *Ordenar en el template con pipes*: rechazada, lógica de orden no debe vivir en la vista.

## Decisión 5: Tiempo real (WS)

- **Decisión**: En `addUnlockedAchievement`, en vez de prepend a `profile.achievements`, recomputar el
  view-model: marcar el código entrante como desbloqueado (si ya lo estaba, no-op) y reordenar con la
  misma función de merge. Mantener el guard `authStore.username() === username()` (FR-010, FR-012).
- **Rationale**: Reaprovecha `ProfileNotificationService.achievementUnlocked$` ya suscripto. Evita
  duplicados (FR-011) porque el merge dedup por código.

## Decisión 6: Estilo del estado bloqueado

- **Decisión**: Bloqueados con opacidad reducida + ícono de candado (`mat-icon` `lock`) + sin `<time>`.
  Colores/atenuado vía tokens `var(--t3-…)`. Si no existe un token de opacidad apropiado, se agrega en
  `src/styles.scss` antes de consumirlo.
- **Rationale**: Decisión de producto confirmada (FR-006, SC-003). Cumple guardarraíl de tokens CSS.
- **Alternativas consideradas**:
  - *Sólo atenuado sin candado*: descartada por el usuario; el candado refuerza la lectura de "falta".

## Verificación de guardarraíles

- **Contrato**: nuevo `achievements-catalog.contract.spec.ts` parsea `docs/CONTRATOS_API.md` y verifica
  que el shape tipado coincide con §7.5.3 (campo `achievementCode`, ruta `GET /api/achievements`).
- **Tokens**: `pnpm lint:styles` cubre el SCSS modificado.
- **Tests**: `pnpm test` corre unit + contract.
