# Data Model: Lobby post-login y creación de partida contra bots

**Branch**: `003-lobby-bots` | **Date**: 2026-05-24

Modelos de dominio del front. Source of truth del contrato BE: `docs/CONTRATOS_API.md` §9.

---

## Bot

Oponente controlado por IA. Se renderiza como tarjeta seleccionable en
`BotsConfigPage`.

```ts
// src/app/core/models/bot.models.ts
export interface BotPersonality {
  /** 1–100. Tendencia a bluffear (cantar truco/envido con mano débil). */
  mentiroso: number;
  /** 1–100. Espera que el rival cante envido primero. */
  pescador: number;
  /** 1–100. Velocidad para escalar apuestas (retruco, vale cuatro). */
  temerario: number;
  /** 1–100. Agresividad al cantar envido. */
  envidoso: number;
  /** 1–100. Reserva cartas fuertes para manos posteriores. */
  aguantador: number;
}

export interface Bot {
  /** UUID provisto por el BE. Único en el catálogo. */
  botId: string;
  /** Nombre legible para mostrar en la tarjeta. */
  name: string;
  /** Vector de personalidad. Opcional para futuras UI; en esta feature no se renderiza. */
  personality?: BotPersonality;
}
```

**Reglas de validación**:
- `botId` no vacío, formato UUID v4 (el FE asume bien-formado; no se valida en runtime).
- `name` no vacío. Si el BE devolviera un nombre vacío, se renderiza fallback "Bot anónimo".

**Origen**: `GET /api/bots` (response body).

**Identificador visual en UI**: en esta feature las tarjetas muestran iniciales del `name`
sobre un círculo de color derivado por hash determinístico del `botId` (para que cada bot
tenga siempre el mismo color sin pedir un asset al BE). Cualquier `avatarUrl` futuro sería
una propiedad adicional opcional.

---

## SeriesFormat

Formato de la serie de partidas. Enum nominal del front (la traducción a `gamesToPlay`
vive en un helper — ver D-001 en research).

```ts
// src/app/core/models/match.models.ts (extensión)
export type SeriesFormat = 'BEST_OF_1' | 'BEST_OF_3' | 'BEST_OF_5';

export const DEFAULT_SERIES_FORMAT: SeriesFormat = 'BEST_OF_3';

export const SERIES_FORMAT_LABELS: Record<SeriesFormat, string> = {
  BEST_OF_1: 'Mejor de 1',
  BEST_OF_3: 'Mejor de 3',
  BEST_OF_5: 'Mejor de 5',
};

export function seriesFormatToGamesToPlay(f: SeriesFormat): 1 | 2 | 3 {
  switch (f) {
    case 'BEST_OF_1': return 1;
    case 'BEST_OF_3': return 2;
    case 'BEST_OF_5': return 3;
  }
}
```

**Regla de dominio** ([[game-rules]]): cada partida individual se gana llegando a **3 puntos
exactos** (pasarse pierde). Esa regla NO se configura desde esta pantalla — vive en la
pantalla de partida.

---

## CreateBotMatchRequest

Cuerpo del POST que crea la partida.

```ts
// src/app/core/models/match.models.ts (extensión)
export interface CreateBotMatchRequest {
  /** UUID del bot seleccionado. */
  botId: string;
  /** Partidas a ganar para terminar el match. 1 | 2 | 3 (mapeado desde SeriesFormat). */
  gamesToPlay: 1 | 2 | 3;
}
```

**Regla**: el componente nunca construye este objeto a mano — siempre vía un constructor
que recibe `Bot` + `SeriesFormat` y llama a `seriesFormatToGamesToPlay`.

---

## CreateBotMatchResponse

Respuesta `200 OK` del BE.

```ts
// src/app/core/models/match.models.ts (extensión)
export interface CreateBotMatchResponse {
  /** UUID del match recién creado. Usado para navegar a /match/:matchId. */
  matchId: string;
}
```

---

## Estado UI

### `LobbyPageComponent`
Sin estado local relevante (solo lee `AuthStore.playerId()` para el header global; el
nombre se muestra en el header, no en el lobby).

### `BotsConfigPageComponent`
Signals locales:

| Signal              | Tipo                              | Default              | Notas |
|---------------------|-----------------------------------|----------------------|-------|
| `bots`              | `Bot[]`                           | `[]`                 | Cargado desde `BotsApiService.getBots()`. |
| `loadingCatalog`    | `boolean`                         | `true`               | True mientras se obtiene el catálogo. |
| `catalogError`      | `string \| null`                  | `null`               | Copy traducido (no `ApiError.message`). |
| `selectedBotId`     | `string \| null`                  | `null`               | Selección actual; null = nada seleccionado. |
| `seriesFormat`      | `SeriesFormat`                    | `'BEST_OF_3'`        | Default de proyecto ([[game-rules]]). |
| `creatingMatch`     | `boolean`                         | `false`              | True desde el tap del CTA hasta respuesta. |
| `createMatchError`  | `string \| null`                  | `null`               | Copy traducido. |

**Computed**:
- `canCreate = computed(() => !creatingMatch() && !loadingCatalog() && bots().length > 0 && selectedBotId() !== null)`.

**Transiciones**:
1. `init` → fetch catálogo → `loadingCatalog=false`; éxito setea `bots`, fallo setea
   `catalogError`.
2. `tapBot(botId)` → `selectedBotId = botId` (radio: pisa la previa).
3. `changeFormat(f)` → `seriesFormat = f`.
4. `tapCreate` → `creatingMatch=true; createMatchError=null` → POST → éxito navega a
   `/match/:matchId`; fallo setea `createMatchError` y `creatingMatch=false`. En caso
   especial de **404 botId inexistente**: además, recarga el catálogo y resetea
   `selectedBotId=null`.

---

## Mapeo de errores (resumen)

Fuente: FR-014 y FR-014a; implementado en `src/app/shared/error-copy/error-copy.ts`.

| Scope              | Status | Copy UI                                                       | Side-effect           |
|--------------------|--------|---------------------------------------------------------------|-----------------------|
| `BOT_CATALOG`      | 401    | (sin mensaje — refreshInterceptor maneja redirect)            | redirect a `/login`   |
| `BOT_CATALOG`      | 403    | "No tenés permiso para ver los bots."                         | —                     |
| `BOT_CATALOG`      | 0 / 5xx| "No pudimos cargar los bots. Reintentá."                      | botón Reintentar      |
| `BOT_CATALOG`      | otro   | "Ocurrió un error inesperado. Reintentá."                     | botón Reintentar      |
| `CREATE_BOT_MATCH` | 401    | (sin mensaje)                                                 | redirect a `/login`   |
| `CREATE_BOT_MATCH` | 403    | "No tenés permiso para crear esta partida."                   | CTA habilitado        |
| `CREATE_BOT_MATCH` | 404    | "El bot ya no está disponible, actualizá la lista."           | recarga catálogo + reset selección |
| `CREATE_BOT_MATCH` | 409/422| "La configuración elegida no es válida."                      | CTA habilitado        |
| `CREATE_BOT_MATCH` | 0 / 5xx| "No pudimos crear la partida. Reintentá en unos segundos."    | CTA habilitado        |
| `CREATE_BOT_MATCH` | otro   | "Ocurrió un error inesperado. Reintentá."                     | CTA habilitado        |
