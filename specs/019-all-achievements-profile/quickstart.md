# Quickstart: Todos los logros en el perfil

**Feature**: 019-all-achievements-profile | **Fase 1**

Guía rápida para implementar y verificar la feature.

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/app/core/models/profile.models.ts` | + `AchievementCatalogEntry`, `AchievementsCatalogResponse`, `AchievementView` |
| `src/app/features/profile/services/profile-api.service.ts` | + `getAchievementsCatalog(): Observable<AchievementsCatalogResponse>` |
| `src/app/features/profile/utils/achievement-merge.ts` | NUEVO: `mergeAchievements(catalogCodes, unlocked)` |
| `src/app/features/profile/pages/profile-page/profile-page.component.ts` | `forkJoin` catálogo+perfil; señal `achievementsView`; merge en WS |
| `src/app/features/profile/pages/profile-page/profile-page.component.html` | render unificado (desbloqueado/bloqueado) |
| `src/app/features/profile/pages/profile-page/profile-page.component.scss` | estilo bloqueado (atenuado + candado) con tokens |
| `src/tests/contract/achievements-catalog.contract.spec.ts` | NUEVO contract test |
| `*.spec.ts` asociados | tests de service, merge y componente |

## Esqueleto del service

```ts
getAchievementsCatalog(): Observable<AchievementsCatalogResponse> {
  return this.http.get<AchievementsCatalogResponse>(`${this.baseUrl}/achievements`);
}
```

## Esqueleto del componente (carga)

```ts
forkJoin({
  catalog: this.profileApi.getAchievementsCatalog().pipe(catchError(() => of(null))),
  profile: this.profileApi.getProfile(username),
}).subscribe({
  next: ({ catalog, profile }) => {
    this.profile.set(profile);
    const codes = catalog?.achievements.map((a) => a.achievementCode)
      ?? profile.achievements.map((a) => a.achievementCode); // degradación
    this.achievementsView.set(mergeAchievements(codes, profile.achievements));
    this.loading.set(false);
  },
  error: (err) => { /* getErrorCopy('PROFILE', err) — perfil falló */ },
});
```

## Verificación manual (dev)

1. `pnpm start` → `http://localhost:4200`.
2. Ir al perfil propio (`/profile/<username>`):
   - Se ven **todos** los logros; desbloqueados arriba, bloqueados abajo atenuados con candado.
   - Perfil sin desbloqueos → todos bloqueados (no el mensaje vacío).
3. Simular fallo de catálogo (p. ej. backend 401 sólo en `/achievements`) → se ven sólo desbloqueados,
   sin pantalla de error.
4. Con el perfil propio abierto, desbloquear un logro en partida → ese logro sube a desbloqueados sin
   recargar.

## Gates antes del PR

```bash
pnpm lint           # ESLint TS/HTML
pnpm lint:styles    # tokens CSS en SCSS de feature
pnpm lint:themes    # botones tematizados
pnpm test           # unit + contract (incluye achievements-catalog.contract.spec.ts)
pnpm build          # compila sin errores
```

## Criterios de aceptación cubiertos

- FR-001..FR-007, FR-011: `mergeAchievements` + render unificado.
- FR-008: `catchError` en catálogo → degradación a desbloqueados.
- FR-009: manejo de error de perfil intacto.
- FR-010, FR-012: merge en el handler de `achievementUnlocked$` con guard de username.
