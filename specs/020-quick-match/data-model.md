# Data Model: Quick Match

## QuickMatchRequest

Representa la intención del jugador de entrar a la cola de partida rápida con un formato de serie.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `gamesToPlay` | `1 | 3 | 5` | Partidas totales de la serie. Se deriva de `SeriesFormat`: `BEST_OF_1 -> 1`, `BEST_OF_3 -> 3`, `BEST_OF_5 -> 5`. |

## QuickMatchResponse

Respuesta al intento de entrar a la cola.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `status` | `'SEARCHING' | 'MATCHED'` | `SEARCHING` indica que el jugador quedó en cola; `MATCHED` indica que ya existe partida. |
| `matchId` | `string | null` | UUID del match cuando `status = MATCHED`; `null` cuando `status = SEARCHING`. |
| `enqueuedAt` | `string` | ISO-8601 del momento en que el jugador entró a la cola. Si ya estaba en cola, conserva el valor original. |

### Invariantes

- Si `status = SEARCHING`, `matchId` debe ser `null`.
- Si `status = MATCHED`, `matchId` debe ser un UUID no vacío.
- `enqueuedAt` siempre debe estar presente.
- La llamada de entrada es idempotente: una búsqueda ya activa vuelve como `SEARCHING`.

## QuickMatchUiState

Estado de presentación de la pantalla.

| Estado | Descripción | Acciones visibles |
|--------|-------------|-------------------|
| `idle` | Todavía no se inició búsqueda. | Cambiar formato, buscar rival, volver al lobby. |
| `submitting` | Se envió la solicitud inicial y se espera respuesta. | CTA deshabilitado, indicador de carga. |
| `searching` | El jugador quedó en cola. | Cancelar búsqueda, volver cancelando. |
| `cancelling` | Se solicitó cancelar la búsqueda. | Acciones deshabilitadas, indicador de carga. |
| `matched` | Hay match y se está navegando. | Sin acciones principales; navegación automática. |
| `error` | Falló entrada o cancelación. | Reintentar o volver según el contexto. |

### Transiciones

```text
idle -> submitting -> matched
idle -> submitting -> searching
submitting -> error
searching -> matched
searching -> cancelling -> idle
searching -> error
cancelling -> error
error -> submitting
error -> idle
```

## MatchWsEvent relevante

Se reutiliza el evento de match existente.

| Campo | Tipo | Uso en quick match |
|-------|------|--------------------|
| `matchId` | `string` | Destino de navegación cuando se recibe un inicio de partida. |
| `eventType` | `'GAME_STARTED'` entre otros | Quick match solo actúa ante `GAME_STARTED` mientras está buscando. |
| `payload.gameNumber` | `number` | No se usa para navegación, pero confirma inicio de game. |

## Error Copy Scope

Nuevo scope: `QUICK_MATCH`.

Mapeo esperado:

| Caso | Copy visible |
|------|--------------|
| `401` | Sin copy; lo maneja el interceptor global. |
| `422` con jugador ocupado/revancha/cola | `Ya estás en una partida, una revancha pendiente o una búsqueda activa.` |
| `422` por configuración inválida | `La configuración elegida no es válida.` |
| Red/timeout/offline | `No pudimos buscar rival. Reintentá en unos segundos.` |
| `5xx` | `No pudimos buscar rival. Reintentá en unos segundos.` |
| Fallback | `Ocurrió un error inesperado. Reintentá.` |

Nota: el componente no debe usar `ApiError.message` para decidir el copy visible. Puede registrarlo
solo en `console.error`.
