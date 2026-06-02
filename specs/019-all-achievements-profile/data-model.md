# Data Model: Todos los logros en el perfil

**Feature**: 019-all-achievements-profile | **Fase 1**

Tipos en `src/app/core/models/profile.models.ts`. Los existentes se conservan; se agregan los del
catálogo y el view-model.

## Entidades existentes (sin cambios)

```ts
interface PlayerStats {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
}

interface UnlockedAchievement {
  achievementCode: string;
  unlockedAt: number;   // epochMillis
  matchId: string;
  gameNumber: number;
}

interface PlayerProfile {
  achievements: UnlockedAchievement[];
  stats: PlayerStats;
}

interface AchievementDefinition {  // copy legible resuelto por el front
  code: string;
  name: string;
  description: string;
}
```

## Entidades nuevas

### AchievementCatalogEntry

Entrada del catálogo del backend. Sólo el código (§7.5.3).

| Campo           | Tipo   | Notas                          |
|-----------------|--------|--------------------------------|
| achievementCode | string | Igual nombre que en el perfil  |

```ts
interface AchievementCatalogEntry {
  achievementCode: string;
}
```

### AchievementsCatalogResponse

Respuesta de `GET /api/achievements`.

```ts
interface AchievementsCatalogResponse {
  achievements: AchievementCatalogEntry[];
}
```

### AchievementView (view-model derivado)

Resultado del merge catálogo + desbloqueados. Es lo que consume el template.

| Campo           | Tipo                  | Notas                                                   |
|-----------------|-----------------------|---------------------------------------------------------|
| code            | string                | `achievementCode`                                       |
| name            | string                | resuelto por `getAchievementDisplay(code)`              |
| description     | string                | idem                                                    |
| unlocked        | boolean               | true si está en `PlayerProfile.achievements`            |
| unlockedAt      | number \| undefined   | sólo si `unlocked`; epochMillis                         |
| matchId         | string \| undefined   | contexto, sólo si `unlocked`                            |
| gameNumber      | number \| undefined   | contexto, sólo si `unlocked`                            |

```ts
interface AchievementView {
  code: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: number;
  matchId?: string;
  gameNumber?: number;
}
```

## Reglas de derivación (merge)

`mergeAchievements(catalogCodes: string[], unlocked: UnlockedAchievement[]): AchievementView[]`

1. **Unión de códigos** (FR-001, FR-011): `Set` con los códigos del catálogo + los del perfil. Garantiza
   que un desbloqueado fuera del catálogo no se pierda (edge case) y que no haya duplicados.
2. **Estado** (FR-002): para cada código, buscar coincidencia en `unlocked` por `achievementCode`. Si
   existe → `unlocked: true` con sus `unlockedAt/matchId/gameNumber`; si no → `unlocked: false`.
3. **Copy** (FR-007): `name`/`description` desde `getAchievementDisplay(code)` (con fallback genérico).
4. **Orden** (FR-003, FR-004):
   - Primero `unlocked === true`, luego `false`.
   - Entre desbloqueados: `unlockedAt` descendente (más reciente primero).
   - Desempate estable: `code` ascendente (aplica también entre bloqueados).

## Estados de la vista (componente)

| Estado            | Condición                                              | Render                                              |
|-------------------|--------------------------------------------------------|-----------------------------------------------------|
| Cargando          | request en curso                                       | "Cargando perfil..."                                |
| Error de perfil   | falla `GET /profile` (FR-009)                          | mensaje `getErrorCopy('PROFILE')` + Reintentar      |
| Catálogo OK       | ambas requests OK                                      | lista completa: desbloqueados + bloqueados          |
| Catálogo degradado| perfil OK, catálogo falla (FR-008)                     | sólo desbloqueados (todos `unlocked: true`)         |
| Catálogo vacío    | catálogo OK pero sin códigos y sin desbloqueados       | "Todavía no hay logros desbloqueados."              |

## Transiciones en tiempo real (FR-010, FR-012)

- Llega `ACHIEVEMENT_UNLOCKED` y `authStore.username() === username()`:
  - Si el código ya está `unlocked` → no-op (FR-011).
  - Si estaba bloqueado → pasa a `unlocked` con los datos del evento y se re-ordena (sube a la zona de
    desbloqueados).
- Si el perfil mostrado es de otro usuario → ignorar el evento (FR-012).
