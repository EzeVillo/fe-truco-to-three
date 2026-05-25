# Contrato: POST /api/matches/bot

**Origen autoritativo**: `docs/CONTRATOS_API.md` §9.2. Extracto/uso desde el front.

## Endpoint

```
POST {baseUrl}/api/matches/bot
```

- **baseUrl**: `environment.apiUrl`.
- **Auth**: requiere `Authorization: Bearer <jwt>`. Lo añade `jwtInterceptor`
  automáticamente.

## Request

`Content-Type: application/json`

```ts
interface CreateBotMatchRequest {
  botId: string;        // UUID del bot seleccionado.
  gamesToPlay: 1 | 2 | 3; // Partidas a GANAR para cerrar la serie.
}
```

Ejemplo:

```json
{
  "botId": "00000000-0000-0000-0000-000000000001",
  "gamesToPlay": 2
}
```

**Mapeo desde la UI** (ver `data-model.md` → `SeriesFormat`):

| Opción UI       | `gamesToPlay` |
|-----------------|---------------|
| Mejor de 1      | 1             |
| Mejor de 3 (default) | 2        |
| Mejor de 5      | 3             |

## Response 200 OK

```json
{
  "matchId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Tras recibirla el front navega a `/match/:matchId`.

> La partida se crea en estado `IN_PROGRESS`. El bot juega su turno automáticamente. Esta
> feature **no se suscribe** a `/user/queue/match` — esa integración queda para la feature
> de partida.

## Errores manejados

| Status   | Caso                                                              | Copy UI                                                       | Side-effect                          |
|----------|-------------------------------------------------------------------|---------------------------------------------------------------|--------------------------------------|
| `401`    | Token expirado / inválido                                          | (sin mensaje — refreshInterceptor)                            | Redirect a `/login`                  |
| `403`    | Permiso denegado                                                   | "No tenés permiso para crear esta partida."                   | CTA vuelve a habilitarse             |
| `404`    | `botId` no existe en el catálogo                                   | "El bot ya no está disponible, actualizá la lista."           | Recargar catálogo + resetear selección |
| `409` / `422` | `gamesToPlay` inválido, partida activa, revancha OPEN pendiente | "La configuración elegida no es válida."                      | CTA habilitado                       |
| `5xx`    | Error de servidor                                                  | "No pudimos crear la partida. Reintentá en unos segundos."    | CTA habilitado                       |
| `0`      | Red / offline / timeout                                            | Mismo copy que 5xx.                                           | CTA habilitado                       |
| Otros    | No catalogado                                                       | "Ocurrió un error inesperado. Reintentá."                     | CTA habilitado                       |

**Importante**: NUNCA mostrar `ApiError.message` del backend (regla [[error-messaging]]).

## Uso en el front

```ts
// src/app/features/lobby/services/bots-api.service.ts
createBotMatch(req: CreateBotMatchRequest): Observable<CreateBotMatchResponse> {
  return this.http.post<CreateBotMatchResponse>(
    `${environment.apiUrl}/api/matches/bot`,
    req,
  );
}
```

## Anti-doble-tap

El CTA se deshabilita inmediatamente al primer tap (`creatingMatch = true`) y solo se
vuelve a habilitar cuando llega respuesta (éxito → navegación; error → copy + reset del
flag). Este patrón está descrito en spec Edge case "Doble tap en Crear partida".
