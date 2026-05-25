# Research: Lobby post-login y creación de partida contra bots

**Branch**: `003-lobby-bots` | **Date**: 2026-05-24

## Resumen

No quedaron `NEEDS CLARIFICATION` en el Technical Context. La Session 2026-05-24 de la spec
ya resolvió los 5 puntos de mayor riesgo (header global, granularidad de errores, 401,
confirmación de logout, sticky del header). Este documento consolida decisiones de diseño
técnico restantes — pequeñas, todas con alternativa explícita.

---

## D-001: Mapeo "Mejor de N" ↔ `gamesToPlay`

**Decisión**: el front mantiene un enum `SeriesFormat = 'BEST_OF_1' | 'BEST_OF_3' | 'BEST_OF_5'`
y al construir el body del POST traduce a `gamesToPlay` (partidas a **ganar** para cerrar la
serie):

| SeriesFormat   | gamesToPlay | Significado                       |
|----------------|-------------|-----------------------------------|
| `BEST_OF_1`    | 1           | Partida única                     |
| `BEST_OF_3`    | 2           | Primero a 2 partidas ganadas (default) |
| `BEST_OF_5`    | 3           | Primero a 3 partidas ganadas      |

**Razón**: el contrato `POST /api/matches/bot` (`docs/CONTRATOS_API.md` §9.2) define
`gamesToPlay` como "Partidas a ganar para terminar el match (mínimo 1)". La regla de proyecto
en `CLAUDE.md` ya enuncia el mapeo: "mejor de 3 = primero a 2 ganadas". Mantener un enum
nominal en el front (no el int crudo) deja la UI legible y centraliza la traducción en un
único helper (`seriesFormatToGamesToPlay()`).

**Alternativas consideradas**:
- Guardar directamente `gamesToPlay: 1 | 2 | 3` en el componente → rechazado: pierde
  semántica y obliga a recordar la regla en cada lectura.
- Pedir al BE que acepte el nombre del formato → rechazado: requiere cambio de contrato
  para nada.

---

## D-002: Patrón visual del selector de formato de serie

**Decisión**: usar **`mat-button-toggle-group`** (Angular Material, single-select) con tres
toggles ("Mejor de 1", "Mejor de 3", "Mejor de 5"). Por accesibilidad lleva
`aria-label="Formato de serie"`. El default es `BEST_OF_3` y se setea en el signal del
componente al inicializar.

**Razón**: variante de segmented control nativa de Material, ya disponible (Material está en
el stack). Es compacta — entra en la bottom action bar incluso a 360 px junto al CTA — y
soporta single-select out of the box. Tap target ≥ 44 px verificado con el tema por defecto.

**Alternativas consideradas**:
- `mat-select` (dropdown) → rechazado: oculta opciones, requiere un tap extra, menos
  affordance.
- Chips (`mat-chip-listbox`) → rechazado: los chips visualmente sugieren multi-select / filtro
  y el componente no comunica "elegir uno" con la misma fuerza que un segmented.
- Botones custom → rechazado: reinventa Material sin beneficio.

---

## D-003: Grilla del catálogo de bots

**Decisión**: CSS Grid con `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));`
y `gap: 12px`. Padding inferior del contenedor de scroll igual a la altura de la bottom bar
+ safe area (`padding-bottom: calc(var(--t3-bottom-bar-h) + env(safe-area-inset-bottom) + 16px)`)
para que la última tarjeta nunca quede tapada (FR-016 / SC-003).

**Razón**: con `auto-fill`/`minmax` la grilla escala sola — 360 px da 2 columnas compactas
(160 px c/u — entra holgado), 720 px da 4, 1024 px+ da 5–6. Sin media queries adicionales,
respeta la regla "un solo `@media min-width: 1024px`" de [[responsive-scope]].

**Alternativas consideradas**:
- Listado de 1 columna en mobile, multi en desktop con media query → rechazado: más código,
  peor uso del ancho a 600–1023 px.
- Carrusel horizontal → rechazado: dificulta escanear ≥ 30 bots.

---

## D-004: Carga del catálogo — estado y caching

**Decisión**: `BotsApiService.getBots(): Observable<Bot[]>` sin caché en esta versión. El
componente mantiene tres signals: `bots`, `loading`, `loadError` (sí/no, sin código).
`Reintentar` re-ejecuta la suscripción. La selección y el formato son `signal<...>` locales
al `BotsConfigPage` — no se persisten entre visitas (FR — Edge case "Usuario navega atrás").

**Razón**: el catálogo de bots es pequeño y prácticamente estático del lado servidor; un
fetch por visita es aceptable y mantiene la primera versión sin complejidad accidental.
Sin caché se evita reasoning sobre invalidación cuando el BE devuelve 404 por `botId`
inexistente (FR-014 "404 bot inexistente" → recargar lista automáticamente).

**Alternativas consideradas**:
- `signalStore` global para bots → rechazado: no agrega valor todavía; ningún otro consumidor.
- Cachear en `localStorage` → rechazado: stale data fácil; no resuelve un problema real.

---

## D-005: Catálogo de copy de errores

**Decisión**: archivo `src/app/shared/error-copy/error-copy.ts` exporta una función pura
`getErrorCopy(scope: 'BOT_CATALOG' | 'CREATE_BOT_MATCH', error: HttpErrorResponse | unknown): string`.
Mapea por `error.status` (status 0 → red/offline), con fallback genérico. El catálogo
literal vive como `const` en el mismo archivo (las strings exactas están en FR-014 y
FR-014a).

**Razón**: separa la traducción HTTP→UI en un único punto testeable (regla
[[error-messaging]]: nunca `ApiError.message`). Una función pura es trivial de testear y
no introduce DI innecesario.

**Alternativas consideradas**:
- Servicio inyectable → rechazado: el catálogo no tiene estado ni deps; función basta.
- Mapear por `errorCode` del body → rechazado por ahora: el contrato actual no garantiza un
  `errorCode` estable en cada error; status HTTP es suficiente para esta feature.

---

## D-006: 401 y refresh

**Decisión**: **no** se maneja 401 en esta feature. El `refreshInterceptor` ya existente se
encarga del refresh transparente y, si el refresh falla, limpia `AuthStore` y dispara el
redirect a `/login`. Para FR-014 / FR-014a el código 401 figura como "manejado por el
interceptor global" — el catálogo de copy no emite mensaje en ese caso.

**Razón**: evita lógica duplicada y mantiene el comportamiento global de 401 coherente con
[[error-messaging]] (redirect silencioso).

**Alternativas consideradas**: ninguna razonable — duplicar el handler sería un anti-patrón.

---

## D-007: Header global y montaje

**Decisión**: `GlobalHeaderComponent` se monta una sola vez en `app.html` por encima del
`<router-outlet/>`. Lee `AuthStore.isAuthenticated()` para mostrar/ocultar el bloque de
"username + Salir". La acción Salir abre `ConfirmLogoutDialog` (Angular Material
`MatDialog`). Al confirmar: `authStore.clearSession()` + `router.navigateByUrl('/login')`.

**Razón**: render once = sin parpadeo entre rutas. `MatDialog` es el patrón estándar Material
y ya está en el stack. La señal `isAuthenticated` ya está expuesta por el store.

**Alternativas consideradas**:
- Header por página → rechazado por la Session 2026-05-24 (decisión: global compartido).
- Confirmación con `window.confirm` → rechazado: no tematizable, mala UX, no a11y.

---

## D-008: Rutas y redirect post-login

**Decisión**:
- Reemplazar el stub de `/lobby` en `src/app/app.routes.ts:23-30` (hoy carga `LoginPage`)
  por el `LobbyPageComponent` real (lazy `loadComponent`).
- Agregar ruta `/lobby/vs-bots` (lazy) con `canMatch: [authGuard]`.
- Cambiar el redirect raíz a `/lobby` cuando hay sesión (vía guard de `''` o doble redirect
  según pattern actual). El comportamiento se confirma con `authGuard` ya implementado:
  `''` redirige a `/login`; el `publicOnlyGuard` en `/login` redirige a `/lobby` si ya hay
  sesión. Se ajusta `LoginPageComponent` para navegar a `/lobby` tras login exitoso (si
  hoy navega a `/login` por el stub, se corrige).
- Path de la futura partida: `/match/:matchId` (placeholder de navegación; la página real
  se entregará en otra feature). Si la ruta aún no existe, el redirect 404 (`'**'`) la
  llevaría al login — se acepta como comportamiento provisorio hasta que la feature de
  partida exista; **el test E2E manual** validará solo hasta el POST y la promesa de
  navegación.

**Razón**: minimiza cambios al router y reutiliza guards existentes. La path
`/lobby/vs-bots` (anidada bajo `/lobby`) deja espacio claro para futuros modos
(`/lobby/quick-match`, `/lobby/private-room`, etc.) sin re-jerarquizar.

**Alternativas consideradas**:
- `/play/bots` separado del lobby → rechazado: peor mental model; el lobby es el "hub" y el
  resto cuelga de ahí.

---

## D-009: Accesibilidad mínima

**Decisión**: cada tarjeta de bot es un `<button>` (no `<div>`) con `role` implícito,
`aria-pressed` reflejando selección. La bottom bar lleva `role="region"` y
`aria-label="Acciones de partida"`. Tap targets ≥ 44 px (FR ≈ 44 px en SC implícito de
US3). Focus visible respetando el tema Material default.

**Razón**: requisito de calidad mínimo y trivial de cumplir desde el inicio; evita
retrabajo posterior.

---

## Riesgos abiertos / no-decisiones

- **Ruta `/match/:matchId` aún no existe**: en esta feature se navega con `router.navigate`
  igualmente; si el usuario completa el flujo antes de que exista la feature de partida,
  caerá en `'**'` → `/login`. Asumido. Se mitiga con un TODO visible en el código y una
  línea en `quickstart.md`.
- **Estado del usuario "tiene partida activa" (422 al crear)**: el copy genérico de 422
  cubre el caso ("La configuración elegida no es válida"). Una iteración futura podría
  ofrecer "Volver a tu partida en curso"; fuera de alcance acá.
