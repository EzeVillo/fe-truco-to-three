# Contrato: GET /api/bots

**Origen autoritativo**: `docs/CONTRATOS_API.md` §9.1. Este documento es un extracto/uso
desde la perspectiva del front en esta feature.

## Endpoint

```
GET {baseUrl}/api/bots
```

- **baseUrl**: `environment.apiUrl` (dev: `http://localhost:8080`).
- **Auth**: el contrato dice "no requiere autenticación", pero el `jwtInterceptor` añade
  `Authorization: Bearer <jwt>` igual cuando hay sesión. El BE debe tolerarlo.

## Request

Sin query params. Sin body.

## Response 200 OK

`Bot[]` (ver `data-model.md` → `Bot`).

```json
[
  {
    "botId": "00000000-0000-0000-0000-000000000001",
    "name": "El Mentiroso",
    "personality": {
      "mentiroso": 90,
      "pescador": 20,
      "temerario": 70,
      "envidoso": 50,
      "aguantador": 30
    }
  }
]
```

- El array puede venir vacío (`[]`) — la UI debe mostrar el estado "catálogo vacío"
  (FR-018).
- `personality` puede no estar en versiones futuras; el front lo trata como opcional.

## Errores manejados

| Status   | Tratamiento en el front                                                              |
|----------|--------------------------------------------------------------------------------------|
| `401`    | Manejado por `refreshInterceptor`. La UI no muestra mensaje propio.                  |
| `403`    | Copy: "No tenés permiso para ver los bots." Botón "Reintentar" visible.              |
| `5xx`    | Copy: "No pudimos cargar los bots. Reintentá." Botón "Reintentar" visible.           |
| `0` (red/offline) | Mismo tratamiento que 5xx.                                                  |
| Otros    | Copy fallback: "Ocurrió un error inesperado. Reintentá."                             |

**Importante**: NUNCA mostrar `ApiError.message` del backend (regla [[error-messaging]]).

## Uso en el front

```ts
// src/app/features/lobby/services/bots-api.service.ts
getBots(): Observable<Bot[]> {
  return this.http.get<Bot[]>(`${environment.apiUrl}/api/bots`);
}
```
