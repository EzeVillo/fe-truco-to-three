# Data Model — 004-lobby-bots-fixes

Esta feature no introduce entidades nuevas. Ajusta el dominio de un campo del DTO existente y formaliza dos entidades de soporte (design tokens y catálogo de copy) que ya viven en el código pero no estaban modeladas en specs.

---

## 1. `SeriesFormat` (sin cambios)

```ts
type SeriesFormat = 'BEST_OF_1' | 'BEST_OF_3' | 'BEST_OF_5';
const DEFAULT_SERIES_FORMAT: SeriesFormat = 'BEST_OF_3';
```

- Valores permitidos: los tres literales.
- Default: `BEST_OF_3`.
- Etiquetas: `SERIES_FORMAT_LABELS` (sin cambios).

## 2. `seriesFormatToGamesToPlay` (CAMBIA — cambio de dominio)

**Antes** (incorrecto, causa `422`):
```ts
function seriesFormatToGamesToPlay(f: SeriesFormat): 1 | 2 | 3 { … }
```

**Después** (alineado con backend):
```ts
function seriesFormatToGamesToPlay(f: SeriesFormat): 1 | 3 | 5 {
  switch (f) {
    case 'BEST_OF_1': return 1;
    case 'BEST_OF_3': return 3;
    case 'BEST_OF_5': return 5;
  }
}
```

Reglas de validación:
- Tipo de retorno **debe** ser `1 | 3 | 5` (no `number`).
- Cualquier callsite que dependa del tipo de retorno se actualiza junto con el cambio.

## 3. `CreateBotMatchRequest` (CAMBIA — campo `gamesToPlay`)

**Antes**:
```ts
interface CreateBotMatchRequest {
  botId: string;
  gamesToPlay: 1 | 2 | 3;
}
```

**Después**:
```ts
interface CreateBotMatchRequest {
  /** UUID del bot seleccionado. */
  botId: string;
  /**
   * Partidas totales de la serie (mejor de N). Valores válidos: 1, 3, 5.
   * Coincide con docs/CONTRATOS_API.md §9.2.
   */
  gamesToPlay: 1 | 3 | 5;
}
```

Reglas de validación:
- `botId`: UUID v4 string. El cliente confía en el valor servido por `GET /api/bots`; no se valida formato en cliente más allá del tipado.
- `gamesToPlay`: enum cerrado `{1, 3, 5}`. Cualquier otro valor es bug del cliente.
- Sin campos extra: el contract test bloquea la adición de propiedades.

## 4. `CreateBotMatchResponse` (sin cambios)

```ts
interface CreateBotMatchResponse {
  matchId: string; // UUID
}
```

- `matchId`: UUID v4. Si la respuesta llega malformada (no UUID), el cliente lo trata como error genérico (edge case del spec; copy del catálogo `CREATE_BOT_MATCH`).

## 5. Design tokens (`--t3-…`)

**Entidad documental**, no estructura de datos en runtime. Declarados en `src/styles.scss` bajo `:root`. Familias relevantes para esta feature:

| Familia | Tokens | Uso en el CTA |
|---------|--------|---------------|
| Color verde | `--t3-green-900/800/700/600` | Fondo del CTA |
| Color dorado | `--t3-gold-500/400/300` | Acento, borde focus |
| Texto | `--t3-text`, `--t3-text-muted`, `--t3-text-dim` | Título y subtítulo |
| Radios | `--t3-radius-sm/md/lg` | Esquinas del CTA |
| Gaps | `--t3-gap-xs/sm/md/lg` | Separación título/subtítulo y padding interno |
| Sombras | `--t3-shadow-card`, `--t3-shadow-gold` | Elevación del CTA |

Regla: **ningún SCSS bajo `src/app/features/**` puede declarar valores literales para estas familias**. Verificado por stylelint.

## 6. Catálogo de copy de errores

**Entidad documental** vivente en `src/app/shared/error-copy/`. Mapea código de `ApiError` → texto localizado. Códigos relevantes para `POST /api/matches/bot` (según `docs/CONTRATOS_API.md §9.2`):

| Código backend | Categoría | Acción UI |
|----------------|-----------|-----------|
| `InvalidGamesToPlayException` | 422 | Mensaje genérico de error de entrada (no debe ocurrir si el cliente respeta el dominio). |
| `BotNotFoundException` (404) | 404 | Invalidar selección, recargar catálogo. |
| `PlayerHasActiveMatchException` | 422 | Ofrecer "Ir a partida activa". |
| `PlayerHasOpenRematchSessionException` | 422 | Mensaje accionable: "Tenés una revancha pendiente". |
| `PlayerAlreadyInQueueException` | 422 | Mensaje accionable: "Estás en Quick Match". |
| Otros 4xx | genérico | Mensaje genérico del catálogo. |
| 5xx / network | genérico | Mensaje "Algo salió mal, reintentá". |

Regla invariante: la UI **nunca** renderiza `ApiError.message`; siempre `getErrorCopy(...)`.

---

## Diagramas de estado

`BotsConfigPageComponent` mantiene estos signals (ya existentes, sin cambio de forma):

```
loadingCatalog: boolean
catalogError:   string | null
bots:           Bot[]
selectedBotId:  string | null
seriesFormat:   SeriesFormat = DEFAULT_SERIES_FORMAT
creatingMatch:  boolean
createMatchError: string | null
```

Transiciones de `creatingMatch` (idempotencia FR-009):

```
false --click "Jugar" (si canCreate)--> true
true  --HTTP 200/4xx/5xx--------------> false
true  --click (ignorado: canCreate=false)
```
