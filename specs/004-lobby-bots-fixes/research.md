# Research — 004-lobby-bots-fixes

Resolución de incógnitas técnicas previas a la fase de diseño. No quedan `NEEDS CLARIFICATION` después de este documento.

---

## 1. Wire-format real de `gamesToPlay` en `POST /api/matches/bot`

**Decision**: el cliente envía `gamesToPlay` como **partidas totales de la serie** con dominio cerrado `{1, 3, 5}`. Mapeo único:

| `SeriesFormat` | `gamesToPlay` |
|----------------|---------------|
| `BEST_OF_1`    | `1` |
| `BEST_OF_3`    | `3` |
| `BEST_OF_5`    | `5` |

**Rationale**:
- Evidencia runtime del backend: `InvalidGamesToPlayException — "gamesToPlay must be one of: 1, 3, 5, but was: 2"` (requestId `9aa17514-9330-4a73-9637-8ffef3f428c9`, 2026-05-24T22:51:21Z). Cualquier valor fuera del set se rechaza con `422`.
- La doc `docs/CONTRATOS_API.md §3 (creación de matches PvP)` y §9.3 (Quick Match) ya describen "Valores permitidos: 1, 3, 5" y la fórmula interna `gamesToWin = gamesToPlay / 2 + 1`, lo que confirma que la semántica del campo en todos los endpoints de creación es "partidas totales de la serie" (mejor de N), **no** "partidas a ganar".
- La descripción en `§9.2` ("Partidas a ganar para terminar el match") está desalineada con la implementación real y debe corregirse como parte de esta feature (FR-007a).

**Alternatives considered**:
- *Mantener `gamesToPlay` como "partidas a ganar" y traducir en cliente (`BEST_OF_3 → 2`)* — rechazado: contradice la implementación real del backend y produce el `422` que motiva esta feature.
- *Enviar el SeriesFormat literal y que el BE traduzca* — rechazado: requeriría cambio de contrato no acordado y la doc ya estabiliza el campo numérico.

---

## 2. Estructura visual del CTA "Jugar contra bots"

**Decision**: el CTA es un `<button mat-flat-button>` con `display: flex; flex-direction: column;` que contiene dos `<span>` apilados: `cta-title` (1rem, peso 700) y `cta-subtitle` (0.85rem, peso 500). Alto mínimo `--t3-header-height` (56 px) y máximo controlado por padding interno; en mobile el alto total se mantiene `≤ 96 px`. Se reemplaza cualquier color literal por tokens (`--t3-green-700/600` para fondo, `--t3-gold-400` para acento, `--t3-text` para tipografía). Gap entre título y subtítulo: `var(--t3-gap-xs)` mínimo; se sube a `var(--t3-gap-sm)` para mayor aire si la línea de subtítulo wrappea.

**Rationale**:
- El SCSS actual (`lobby-page.component.scss`) ya estructura el CTA con `flex-direction: column`, pero usa valores literales (`gap: 4px`, `min-height: 88px`, `padding: 16px 18px`) en lugar de tokens y los tamaños de tipografía no escalan con el sistema. El defecto reportado por el usuario ("título y descripción pegados, uno al lado del otro") ocurre porque Material colapsa el contenido del `mat-flat-button` con su estilo por defecto, ignorando el `flex-direction: column` declarado en el contenedor — hay que forzar `::ng-deep .mat-mdc-button-touch-target { … }` o, preferentemente, no usar `mat-flat-button` para CTA multilínea y reemplazarlo por un `<button class="lobby__cta">` estilizado manualmente con tokens.
- Decisión: **no usar `mat-flat-button`** para este CTA. Se usa un `<button type="button" class="lobby__cta">` puro, estilizado con tokens, manteniendo accesibilidad (`type=button`, focus visible).

**Alternatives considered**:
- *Mantener `mat-flat-button` y override agresivo con `::ng-deep`* — rechazado: frágil, propenso a regresiones cuando Angular Material cambia su DOM interno.
- *Usar `mat-card` clickable* — rechazado: rompe semántica de botón y complica navegación por teclado.

---

## 3. Verificación automática de "no literal colors" en SCSS de feature

**Decision**: añadir **stylelint** con `stylelint-config-standard-scss` y reglas explícitas:

```jsonc
{
  "files": ["src/app/features/**/*.scss"],
  "rules": {
    "color-no-hex": true,
    "declaration-property-value-disallowed-list": {
      "/.*/": ["/^rgb\\(/", "/^rgba\\(/", "/^hsl\\(/", "/^hsla\\(/"]
    }
  }
}
```

Se permite literales **solo** en `src/styles.scss` (donde se declaran los tokens) excluyéndolo por glob. Se integra a `lint-staged` para que falle en pre-commit y se añade script `pnpm lint:styles` para CI.

**Rationale**:
- ESLint no analiza SCSS; usar stylelint es el estándar de la industria.
- `stylelint-config-standard-scss` ya cubre la sintaxis SCSS.
- `color-no-hex` cubre hex; la lista de denylist cubre rgb/hsl. Para `currentColor` y palabras clave (`transparent`, `inherit`) no se penaliza.

**Alternatives considered**:
- *Regla ESLint custom analizando AST de strings* — rechazado: complejidad innecesaria y peor cobertura.
- *Script ad-hoc con `grep`* — rechazado: ruidoso (falsos positivos en comentarios), sin integración a editor.

---

## 4. Test de contrato DTO ↔ `docs/CONTRATOS_API.md`

**Decision**: implementar un test Vitest (`tests/contract/create-bot-match.contract.spec.ts`) que:

1. Lee `docs/CONTRATOS_API.md`.
2. Extrae la sección `### 9.2 Crear partida contra bot` con una regex anclada al heading.
3. Parsea la tabla de campos del request body (formato `| campo | tipo | descripción |`) y la lista de campos del response.
4. Compara contra las claves de `CreateBotMatchRequest` y `CreateBotMatchResponse` definidas en `src/app/core/models/match.models.ts` (`Object.keys` sobre un objeto de tipo, obtenido vía un *type-level helper* materializado en tiempo de test — p. ej. un objeto `const REQ_KEYS = { botId: 0, gamesToPlay: 0 } satisfies Record<keyof CreateBotMatchRequest, number>`).
5. Falla si hay campos extra, faltantes o renombrados en cualquier dirección.

**Rationale**:
- Mantiene el contrato como **fuente única**: cualquier cambio en el cliente debe acompañarse de cambio (validado) en la doc.
- Vitest ya está en el stack; no se añaden deps.
- El parseo del markdown es simple (tabla pipe) y robusto siempre que se preserve el heading `### 9.2`. El test guarda el heading literal para que un cambio accidental también fuerce revisión.

**Alternatives considered**:
- *Generación de tipos a partir de OpenAPI* — rechazado: el backend no expone OpenAPI hoy; introducir un schema duplicado contra `CONTRATOS_API.md` agrega superficie de mantenimiento.
- *Snapshot del markdown* — rechazado: snapshot frágil ante cambios de redacción que no afectan el contrato.

---

## 5. Ratificación de la constitution (FR-012)

**Decision**: reescribir `.specify/memory/constitution.md` reemplazando los placeholders por **tres principios ratificados** y referencias cruzadas:

1. **Design tokens obligatorios en SCSS de feature** — toda propiedad de color, radio, sombra, gap o tamaño en `src/app/features/**/*.scss` se expresa como `var(--t3-…)`. Sólo `src/styles.scss` define literales. Verificado por stylelint (lint:styles).
2. **Validación cruzada con `docs/CONTRATOS_API.md` antes de tipar/consumir un endpoint** — todo DTO de request/response que toque `/api/**` debe parear nombre y tipo con la sección correspondiente del contrato. Cualquier divergencia se resuelve actualizando la doc + DTO en la misma feature, jamás silenciosamente en el cliente. Cubierto por contract tests.
3. **CTAs con título + descripción se apilan verticalmente por defecto** — `flex-direction: column`, separación mínima `--t3-gap-xs`, dos líneas distintas. Excepciones requieren mockup/diseño explícito linkeado en el spec.

Adicionalmente, se actualizan `.specify/templates/plan-template.md` y `.specify/templates/tasks-template.md` para que el Constitution Check del plan y el checklist de tasks referencien estos tres principios.

**Rationale**: el spec lo exige explícitamente (FR-012, SC-006) y deja al modelo del Spec Kit con reglas internas en lugar de depender solo de memoria del CLI.

**Alternatives considered**: *dejarlo sólo en CLAUDE.md* — rechazado: SC-006 requiere referencias explícitas desde la constitution y templates.

---

## 6. Manejo de errores y catálogo de copy

**Decision**: el flujo de `onCreate()` ya invoca `getErrorCopy('CREATE_BOT_MATCH', err)` (`shared/error-copy`). Se conserva. Se añaden cobertura de tests para los códigos relevantes del backend en §9.2 (`InvalidGamesToPlayException`, `BotNotFound`, `PlayerHasActiveMatchException`, `PlayerHasOpenRematchSessionException`, `PlayerAlreadyInQueueException`) garantizando que ninguno renderiza `ApiError.message` crudo (memoria `error_messaging`).

**Rationale**: ya cumple la regla; sólo falta cobertura formal. No se introducen códigos nuevos.

---

## 7. Idempotencia del botón "Jugar"

**Decision**: la señal `creatingMatch` ya inhibe el botón vía `canCreate` mientras hay request en vuelo. Se añade una prueba que dispara dos clicks consecutivos y verifica una única llamada HTTP.

**Rationale**: FR-009 ya está implementado; sólo se formaliza la cobertura.
