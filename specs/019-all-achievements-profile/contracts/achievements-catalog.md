# Contrato: Catálogo de logros

**Feature**: 019-all-achievements-profile | **Fase 1**
**Fuente autoritativa**: `docs/CONTRATOS_API.md §7.5.3`

## `GET /api/achievements`

Devuelve la lista completa de logros existentes en el juego (sólo sus códigos). Idéntica para todos
los jugadores e independiente del progreso: **no** indica desbloqueo ni incluye título/descripción.

### Request

- **Método**: `GET`
- **Headers**: `Authorization: Bearer <jwt>` (obligatorio)
- **Body / params**: ninguno

### Respuesta 200

```json
{
  "achievements": [
    { "achievementCode": "WIN_GAME_AS_PIE_MANO_BUSTS_ON_ENVIDO_WITH_0_0_AT_2_2" },
    { "achievementCode": "WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO" }
  ]
}
```

### Tipo TypeScript (paridad verificada en contract test)

```ts
interface AchievementCatalogEntry {
  achievementCode: string;
}
interface AchievementsCatalogResponse {
  achievements: AchievementCatalogEntry[];
}
```

### Errores

| Código | Descripción              | Manejo en el front                                   |
|--------|--------------------------|------------------------------------------------------|
| 401    | Token ausente o inválido | Degradar a sólo-desbloqueados (FR-008); no error UI  |
| (otros)| —                        | `catchError` → `null` → degradar a sólo-desbloqueados |

### Notas de cruce

- El campo `achievementCode` es idéntico al del perfil (`GET /api/profile/{username}`) para permitir el
  cruce 1:1.
- No existen logros ocultos: el catálogo expone todos los códigos.
- El nombre/descripción legible los resuelve el front por código (`getAchievementDisplay`).

## Contract test asociado

`src/tests/contract/achievements-catalog.contract.spec.ts` debe:

1. Definir un objeto `satisfies AchievementsCatalogResponse` con al menos una entrada.
2. Leer `docs/CONTRATOS_API.md` y verificar que contiene `GET /api/achievements` y el campo
   `achievementCode` dentro de la sección del catálogo.
3. Verificar que la entrada del catálogo tiene exactamente la clave `achievementCode`.
