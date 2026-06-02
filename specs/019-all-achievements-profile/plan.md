# Implementation Plan: Todos los logros en el perfil

**Branch**: `019-all-achievements-profile` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-all-achievements-profile/spec.md`

## Summary

Hoy el perfil sólo lista los logros **desbloqueados** que devuelve `GET /api/profile/{username}`. Esta
feature incorpora el catálogo completo de logros (`GET /api/achievements`, §7.5.3 del contrato) y lo
cruza por `achievementCode` con los desbloqueados del perfil, para renderizar **todos** los logros del
juego: los desbloqueados arriba (ordenados por fecha de desbloqueo, más reciente primero) y los
bloqueados debajo, atenuados y con candado. Si el catálogo falla pero el perfil carga, se degrada a
mostrar sólo los desbloqueados. La notificación en tiempo real ya existente (`ACHIEVEMENT_UNLOCKED`)
pasa a mover un logro de bloqueado→desbloqueado en el propio perfil.

Enfoque técnico: agregar un método `getAchievementsCatalog()` al `ProfileApiService`, combinar ambas
requests con `forkJoin` en `ProfilePageComponent`, derivar un view-model `AchievementView[]` ya
ordenado, y adaptar el template/SCSS para el estado bloqueado. Sin nuevas dependencias.

## Technical Context

**Language/Version**: TypeScript 5.x / Angular 21 (componentes standalone)

**Primary Dependencies**: Angular Material, RxJS (`forkJoin`, `catchError`), NgRx Signals (AuthStore), `@stomp/stompjs` (ya usado por `ProfileNotificationService`)

**Storage**: N/A (estado en memoria del componente vía `signal`)

**Testing**: Vitest + `@angular/common/http/testing` (HttpTestingController); contract tests en `src/tests/contract/`

**Target Platform**: Navegador (web app SPA), mobile-first 360 px → desktop 1024 px+

**Project Type**: Web application (frontend Angular standalone)

**Performance Goals**: Render instantáneo; catálogo acotado (decenas de ítems), sin paginación

**Constraints**: Tokens CSS `var(--t3-…)` obligatorios en SCSS; copy de error vía `getErrorCopy()`; un único breakpoint `@media (min-width: 1024px)`

**Scale/Scope**: 1 endpoint nuevo (GET), 1 servicio, 1 componente, 1 util de merge, ~10 logros en catálogo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: El nuevo estado "bloqueado" (opacidad, candado, color atenuado) usa exclusivamente `var(--t3-…)`. Si falta un token de opacidad/atenuado se agrega primero en `src/styles.scss`. Verificable con `pnpm lint:styles`.
> - [x] **Validación de contrato**: `AchievementsCatalogResponse` se tipa campo a campo contra `docs/CONTRATOS_API.md §7.5.3`. Se agrega contract test que parsea el doc y verifica el shape `{ achievements: [{ achievementCode }] }`.
> - [x] **CTAs verticales**: No se agregan CTAs con jerarquía título+descripción nuevos. El único botón (Reintentar / Volver) ya usa variantes `t3-btn`. Sin `mat-flat-button`.
> - [x] **Copy de errores**: El fallo de perfil sigue usando `getErrorCopy('PROFILE', err)`. El fallo de catálogo NO muestra error (degrada silenciosamente). En ningún path se muestra `ApiError.message` crudo.
> - [x] **Reglas de juego**: La feature no toca scoring, formato de partida ni `gamesToPlay`. N/A.

**Resultado**: PASS — sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/019-all-achievements-profile/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1 (contrato del endpoint de catálogo)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src/app/
├── core/models/
│   └── profile.models.ts            # + AchievementCatalogEntry, AchievementsCatalogResponse, AchievementView
├── features/profile/
│   ├── services/
│   │   ├── profile-api.service.ts        # + getAchievementsCatalog()
│   │   └── profile-api.service.spec.ts   # + test GET /achievements
│   ├── utils/
│   │   ├── achievement-merge.ts          # NUEVO: merge catálogo + desbloqueados → AchievementView[] ordenado
│   │   ├── achievement-merge.spec.ts     # NUEVO
│   │   └── achievement-display.ts        # (reutilizado tal cual)
│   └── pages/profile-page/
│       ├── profile-page.component.ts     # forkJoin catálogo+perfil; señal achievementsView; merge en WS
│       ├── profile-page.component.html   # render unificado desbloqueado/bloqueado
│       ├── profile-page.component.scss    # estilo bloqueado (atenuado + candado) con tokens
│       └── profile-page.component.spec.ts # + casos merge/orden/degradación/WS

src/tests/contract/
└── achievements-catalog.contract.spec.ts # NUEVO: paridad con docs/CONTRATOS_API.md §7.5.3
```

**Structure Decision**: Web app Angular standalone existente. Se extiende la feature `profile` ya
presente, sin crear módulos ni carpetas nuevas más allá del util de merge y su test. El merge se aísla
en una función pura (`achievement-merge.ts`) para testearlo sin TestBed y mantener el componente fino.

## Complexity Tracking

> Sin violaciones de constitution. Sección no aplica.
