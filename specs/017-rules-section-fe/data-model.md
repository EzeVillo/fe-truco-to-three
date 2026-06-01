# Data Model: Sección de reglas de variante

## Entidad: VariantRuleSection

Representa un grupo temático de reglas especiales visible en el lobby.

**Campos**:

- `id`: identificador estable para tests y tracking interno. Valores esperados: `objective`, `match-format`, `falta-envido`, `fold-after-quiero`, `sword-ace-close`, `hand-fold-restriction`.
- `title`: título visible del grupo.
- `summary`: explicación breve opcional.
- `items`: lista ordenada de reglas puntuales.
- `criticalTerms`: lista opcional de valores o términos que deben coincidir con `docs/REGLAS_VARIANTE.md`.

**Validaciones**:

- `id` debe ser único dentro de la colección.
- `title` no puede estar vacío.
- Cada sección debe tener `summary` o al menos un item.
- Los valores críticos `3`, "Falta envido" y "ancho de espada" deben aparecer en la colección.

## Entidad: VariantRuleItem

Representa una regla puntual dentro de un grupo temático.

**Campos**:

- `text`: texto visible de la regla.
- `emphasis`: términos opcionales a resaltar visualmente sin cambiar el texto.

**Validaciones**:

- `text` no puede estar vacío.
- El texto debe estar en español.
- No debe incluir reglas completas del truco base que no sean específicas de la variante.

## Relación

- Una `VariantRuleSection` contiene cero o más `VariantRuleItem`.
- La pantalla de lobby consume una colección ordenada de `VariantRuleSection`.
- No hay persistencia ni sincronización remota.

## Estados

La colección es estática y de solo lectura:

```text
Definida en código -> Renderizada en lobby -> Verificada contra docs/REGLAS_VARIANTE.md
```

No existen estados de carga, error o edición para esta feature.
