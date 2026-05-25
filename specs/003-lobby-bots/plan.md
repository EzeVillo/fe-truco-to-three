# Implementation Plan: Lobby post-login y creación de partida contra bots

**Branch**: `003-lobby-bots` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-lobby-bots/spec.md`

## Summary

Tras el login, redirigir al usuario a un lobby (`/lobby`) que sirve de hub de modos de juego.
En esta versión el lobby muestra una sola acción primaria — **"Jugar contra bots"** — que
navega a `/lobby/vs-bots`. Esa pantalla lista los bots (modelo radio, selección 1-of-N),
mantiene una **bottom action bar fija** con el selector de **formato de serie**
(*Mejor de 1 / 3 / 5*, default *Mejor de 3*) y el CTA **Crear partida**. Al crear, se POST-ea
`/api/matches/bot` con `{ botId, gamesToPlay }` y, al recibir `{ matchId }`, se navega a la
vista de partida (`/match/:matchId`, ya inexistente pero ya nombrada como ruta destino).

Se introduce además un **header global compartido** sticky con marca + (cuando hay sesión)
username + acción **Salir**, y un **diálogo global de confirmación de logout**.

Sin WebSockets en esta feature: solo HTTP. Toda comunicación de errores al usuario pasa por
un **catálogo de copy del front** (FR-014 / FR-014a), nunca el `message` crudo del BE.

## Technical Context

**Language/Version**: TypeScript 5.x, Angular 21 (standalone components)

**Primary Dependencies**: Angular Router, `@angular/common/http`, Angular Material (Material 3),
NgRx Signals (`signalStore`), RxJS. Se reutilizan `AuthStore`, `jwtInterceptor`,
`refreshInterceptor` ya existentes.

**Storage**: N/A para esta feature (estado efímero en memoria del componente). `AuthStore`
ya persiste tokens en `localStorage` via `SessionStorageService`.

**Testing**: Vitest + `@analogjs/vitest-angular`. Tests unitarios de:
- `BotsApiService` (HTTP mocks: catálogo y creación).
- `ErrorCopyService` / catálogo de copy (mapeo código → mensaje).
- `BotsConfigPage` (selección radio, habilitado/deshabilitado del CTA, navegación
  post-éxito, mensaje post-error).
- `GlobalHeader` (visibilidad condicional según `isAuthenticated`, diálogo de logout).

**Target Platform**: Web (Chromium/Firefox/Safari modernos). Mobile portrait
360–1023 px y desktop ≥ 1024 px. **Sin** landscape mobile.

**Project Type**: Single-project frontend SPA (Angular). Backend en repo separado.

**Performance Goals**: Scroll del catálogo a 60 fps con ≥ 30 bots en mobile gama media
(SC-004). CTA siempre visible (sticky bottom bar) — SC-003.

**Constraints**:
- Ancho mínimo 360 px ([[design-system-standards]]).
- Header sticky top + bottom action bar fija; respetar safe areas (`env(safe-area-inset-*)`).
- Errores SIEMPRE traducidos vía catálogo de copy ([[error-messaging]]); jamás imprimir
  `ApiError.message`.
- Modalidad 1 vs 1 ([[game-rules]]); partida individual a 3 puntos exactos no se configura
  acá — solo el formato de serie.

**Scale/Scope**:
- 1 lobby page + 1 bots-config page + 1 global header + 1 confirm-logout dialog.
- 1 data service (`BotsApiService`) + 1 error-copy mapper.
- ~5–8 archivos `.ts` nuevos, ~3 `.scss`, ~6 tests.

## Constitution Check

`.specify/memory/constitution.md` está en estado de plantilla sin completar (placeholders
`[PRINCIPLE_N_NAME]`). **No hay principios ratificados** en este momento, por lo que no
existen gates específicos que evaluar.

Se aplican las **reglas de proyecto** ya documentadas en `CLAUDE.md` y memoria del usuario
como gates de facto:

| Regla | Estado |
|-------|--------|
| Idioma español en artefactos Spec Kit | ✅ cumplido en todos los outputs |
| Mobile-first, único breakpoint a 1024 px, mínimo 360 px ([[design-system-standards]]) | ✅ contemplado |
| Sin landscape mobile ([[responsive-scope]]) | ✅ contemplado |
| Copy de error mapeado por front, nunca `ApiError.message` ([[error-messaging]]) | ✅ FR-014/014a/014b |
| Variante truco-to-three: serie 1/3/5, partida a 3 exactos, 1v1 ([[game-rules]]) | ✅ contemplado |
| No suscripciones STOMP en esta feature | ✅ FR-017 |
| Standalone components, NgRx Signals para estado, Angular Material para UI | ✅ contemplado |
| pnpm como gestor único | ✅ |

**Resultado**: PASS (sin violaciones; sin justificaciones requeridas).

## Project Structure

### Documentation (this feature)

```text
specs/003-lobby-bots/
├── plan.md              # Este archivo (/speckit-plan)
├── spec.md              # Spec ya existente
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── GET_api_bots.md
│   └── POST_api_matches_bot.md
└── tasks.md             # Lo genera /speckit-tasks (NO se crea acá)
```

### Source Code (repository root)

```text
src/app/
├── app.routes.ts                                 # MODIFICAR: '/lobby' real + '/lobby/vs-bots'; corregir redirects post-login
├── app.html                                      # MODIFICAR: montar <app-global-header/>
├── core/
│   ├── auth/
│   │   ├── auth.store.ts                         # (sin cambios — se consume)
│   │   ├── jwt.interceptor.ts                    # (sin cambios)
│   │   └── refresh.interceptor.ts                # (sin cambios — ya maneja 401)
│   ├── guards/
│   │   ├── auth.guard.ts                         # (sin cambios)
│   │   └── public-only.guard.ts                  # (sin cambios)
│   └── models/
│       ├── bot.models.ts                         # NUEVO: Bot, BotPersonality
│       └── match.models.ts                       # MODIFICAR: añadir CreateBotMatchRequest/Response, SeriesFormat
├── features/
│   ├── lobby/
│   │   ├── pages/
│   │   │   └── lobby-page/
│   │   │       ├── lobby-page.component.ts       # NUEVO: hub con CTA "Jugar contra bots"
│   │   │       ├── lobby-page.component.html
│   │   │       ├── lobby-page.component.scss
│   │   │       └── lobby-page.component.spec.ts
│   │   ├── pages/
│   │   │   └── bots-config-page/
│   │   │       ├── bots-config-page.component.ts # NUEVO: lista bots + bottom bar + CTA
│   │   │       ├── bots-config-page.component.html
│   │   │       ├── bots-config-page.component.scss
│   │   │       └── bots-config-page.component.spec.ts
│   │   ├── components/
│   │   │   ├── bot-card/                         # NUEVO: tarjeta de bot (avatar, nombre, estado seleccionado)
│   │   │   │   ├── bot-card.component.ts
│   │   │   │   ├── bot-card.component.html
│   │   │   │   └── bot-card.component.scss
│   │   │   └── series-format-selector/           # NUEVO: chips/segmented Mejor de 1/3/5
│   │   │       ├── series-format-selector.component.ts
│   │   │       ├── series-format-selector.component.html
│   │   │       └── series-format-selector.component.scss
│   │   └── services/
│   │       └── bots-api.service.ts               # NUEVO: getBots() + createBotMatch()
│   └── auth/                                     # (sin cambios — redirect post-login ya apunta a /lobby vía AuthStore)
└── shared/
    ├── components/
    │   ├── global-header/                        # NUEVO: header sticky con username + logout
    │   │   ├── global-header.component.ts
    │   │   ├── global-header.component.html
    │   │   └── global-header.component.scss
    │   └── confirm-logout-dialog/                # NUEVO: MatDialog de "¿Cerrar sesión?"
    │       ├── confirm-logout-dialog.component.ts
    │       └── confirm-logout-dialog.component.html
    └── error-copy/
        ├── error-copy.ts                         # NUEVO: catálogo + mapper HttpErrorResponse → mensaje UI
        └── error-copy.spec.ts                    # NUEVO: tests del catálogo
```

**Structure Decision**: Single-project Angular SPA, mobile-first. Se respeta la
organización por features (`features/lobby/`) y la carpeta `shared/` para
componentes y utilidades transversales (header global, catálogo de copy,
diálogo de confirmación). El stub actual de `/lobby` (que apunta a `LoginPage`
en `app.routes.ts:23-30`) se reemplaza por el `LobbyPageComponent` real.

## Complexity Tracking

> No aplica — no hay violaciones de constitución ni desviaciones de las reglas del proyecto.
