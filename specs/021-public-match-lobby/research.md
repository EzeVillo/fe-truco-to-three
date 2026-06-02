# Research — Lobby público de matches (021)

Phase 0. Resuelve las decisiones técnicas abiertas antes del diseño. No quedan marcadores
`NEEDS CLARIFICATION` en el Technical Context.

## D1 — Motor de reconciliación genérico (FR-015)

**Decisión**: Implementar un motor genérico `PublicLobbyStore<T>` (factory `createPublicLobby<T>()`)
en `src/app/shared/public-lobby/`, agnóstico al tipo de recurso, parametrizado por:

- `idOf: (item: T) => string` — clave única para deduplicar.
- `loadPage: (cursor: string | null) => Observable<{ items: T[]; nextCursor: string | null }>` — el
  bootstrap/paginación REST (lo provee el caller; matches usa `GET /api/matches/public`).
- `deltas$: Observable<PublicLobbyDelta<T>>` — stream de upserts/removed ya normalizado desde el topic
  WS (lo provee el caller; matches mapea `/topic/public-match-lobby`).

Expone signals: `items()`, `status()` (`idle | loading | ready | error`), `hasMore()`, y métodos
`start()`, `loadMore()`, `retry()`, `stop()`.

**Rationale**: El contrato del backend ya es **simétrico** para matches, copas y ligas
(`GET /api/{matches,cups,leagues}/public` + `/topic/public-*-lobby` + eventos
`PUBLIC_*_LOBBY_{UPSERT,REMOVED}` con idéntico shape — ver `docs/CONTRATOS_API.md §1.5, §9.4`). La
única lógica riesgosa (merge snapshot+deltas, orden de llegada, dedup) se escribe y testea una sola
vez. Copas/ligas a futuro = instanciar el motor + su propia card + su entrada de navegación.

**Alternativas consideradas**:
- *Lógica inline en el componente de matches*: rechazada — habría que reescribir el reconcile para
  copas/ligas, justo la parte propensa a bugs.
- *Generalizar también la UI (una card para los tres)*: rechazada (YAGNI) — un match (2 slots) y una
  liga/copa (N participantes, genera fixtures) muestran info distinta; una card común terminaría con
  ramas `if (type === …)`. Se generaliza el motor, no las vistas.

## D2 — Semántica de reconciliación (FR-012)

**Decisión**: Estado interno = `Map<id, T>` para O(1) en upsert/removed y dedup natural por id. El
signal `items()` deriva un array ordenado del Map.

Reglas:
- **Bootstrap REST**: cada item de la página se hace `upsert` en el Map (no se borra nada que no
  venga indicado por un delta `REMOVED`).
- **Delta `UPSERT`**: inserta o reemplaza la entrada por id.
- **Delta `REMOVED`**: elimina la entrada por id (no-op si no existe).
- **Delta antes del bootstrap**: el motor se **suscribe al topic antes** de llamar `loadPage`. Se
  mantiene un set `removedIds` con los ids que llegaron como `REMOVED` durante la carga; al integrar
  la respuesta REST, los ids presentes en `removedIds` **no** se re-insertan (evita "resucitar" una
  partida que el backend ya cerró mientras cargábamos). Esto cubre el edge case del spec
  "actualización en tiempo real que llega antes de la carga inicial".
- **Orden**: por inserción (las recién abiertas aparecen al final). Sin criterio de orden en el
  contrato; se deja estable y se documenta. Se puede ajustar luego sin tocar la API del motor.

**Reconexión WS**: al reconectar (`WebSocketService` reintenta solo), el motor re-ejecuta el bootstrap
(`retry()`/re-`loadPage` de la primera página) para reconciliar a un estado consistente — cubre el
edge case "pérdida y recuperación de la conexión". La suscripción al topic se re-arma vía el
`subscribe()` existente, que espera la conexión internamente.

**Rationale**: `Map` + `removedIds` resuelve dedup, idempotencia y orden de llegada con código
mínimo y testeable. `WebSocketService.subscribe()` ya maneja "suscribir aunque no esté conectado aún".

## D3 — Toast de race condition (Clarificación 2026-06-02, FR-014)

**Decisión**: Usar **`MatSnackBar`** de Angular Material para el toast no bloqueante (auto-dismiss
~4 s, sin botón de cierre obligatorio). El copy sale de `getErrorCopy('JOIN_MATCH', err)`, que para
**409** ya devuelve "La partida se llenó justo antes de que entraras." (ver `error-copy.ts`). No se
fuerza refresco ni se remueve la partida en el handler del error: la baja llega sola por el delta
`PUBLIC_MATCH_LOBBY_REMOVED` (FR-011/FR-014).

**Rationale**: `MatSnackBar` es nativo del stack (Angular Material ya instalado), no bloquea, y el
proyecto ya tiene `provideAnimationsAsync()` en `app.config.ts` (requisito de la animación del
snackbar). Reusar el scope `JOIN_MATCH` evita duplicar copy: unirse desde el lobby usa el mismo
`POST /api/join/{joinCode}`.

**Alternativas consideradas**:
- *Banner/diálogo bloqueante*: rechazado por la clarificación — el usuario pidió algo poco invasivo.
- *Mensaje inline en la card*: rechazado — la card va a desaparecer con el delta; un toast efímero es
  más coherente con "te quedás en el lobby y la lista se autocorrige".

**Pendiente menor**: estilar el panel del snackbar con tokens `--t3-…` vía `panelClass` global (en
`styles.scss`, fuera del glob de feature) para respetar la paleta sin romper `lint:styles`.

## D4 — Ubicación en la navegación

**Decisión**: Integrar dentro de **"Jugar online"** (`online-match-page`, ruta `lobby/online`), no como
modo nuevo en la pantalla de modos. La página queda con tres bloques: (1) lista de partidas públicas
[NUEVO, arriba], (2) crear partida con toggle Pública/Privada, (3) unirse por código [existente].

**Rationale**: Conceptualmente es "jugar contra una persona real" → el tercer camino natural junto a
crear-privada y unirse-por-código. Evita un quinto CTA que se confunda con "Partida rápida"
(matchmaking automático) y mantiene limpia la home (4 CTAs). Alineado con los Assumptions del spec.

**Alternativas consideradas**: *5º modo "Buscar partida" en el lobby* — rechazado por confusión con
"Partida rápida" y por inflar la pantalla de modos.

## D5 — Paginación

**Decisión**: Cursor-based con botón **"Cargar más"** (no scroll infinito). Primera página `limit=20`
(default del contrato); `loadMore()` pide la siguiente con el `after` opaco devuelto en
`_links.next.href`. `hasMore()` = existe `_links.next`.

**Rationale**: El contrato `GET /api/matches/public §4.3` es cursor-based (`limit`/`after`, `_links.next`).
"Cargar más" es más simple y predecible que scroll infinito en mobile, y suficiente para el volumen
esperado de un lobby. El motor genérico expone `loadMore()`/`hasMore()` para soportarlo.

## D6 — Generalización de `createMatch` y toggle de visibilidad

**Decisión**:
- Renombrar `MatchesApiService.createPrivateMatch` → `createMatch` (ya recibe `visibility` en el DTO
  `CreateMatchRequest`); actualizar el único call site (`online-match-page`). Sin cambio de contrato.
- Nuevo `VisibilitySelectorComponent` (toggle Pública/Privada) al estilo de `SeriesFormatSelector`.
- **Default de visibilidad = `PRIVATE`** para preservar el comportamiento actual de "Jugar online"
  (genera `joinCode`, no aparece en lobby); el usuario opta explícitamente por Pública. Reversible.

**Rationale**: El método ya estaba acoplado a "Private" solo por el nombre y un comentario; el DTO ya
soporta `visibility`. Mantener `PRIVATE` por defecto evita cambiar la conducta esperada de quien hoy
crea partidas privadas. La creación pública preserva el flujo: el backend devuelve `joinCode` igual y
la partida queda visible en el lobby hasta que entra el rival (autostart).

## D7 — Mapeo del `joinCode` desde el lobby

**Decisión**: El item del lobby trae `_links.join.href = /api/join/{joinCode}`. El FE extrae el
`joinCode` (último segmento del path) y reusa `MatchesApiService.joinByCode(joinCode)` →
`POST /api/join/{joinCode}`, navegando a `/match/:targetId`. No hace falta llamar a `/start`: las
públicas arrancan solas al entrar el 2º jugador (`§4.5`).

**Rationale**: Reusa el flujo de unión ya probado (mismo endpoint, mismo manejo de error/targetType).
La unicidad global de `joinCode` garantiza un único target.

## Resumen de decisiones

| # | Tema | Decisión |
|---|------|----------|
| D1 | Motor genérico | `PublicLobbyStore<T>` en `shared/public-lobby/`, reusable para cups/leagues |
| D2 | Reconcile | `Map<id,T>` + `removedIds`; suscribir WS antes del bootstrap; re-bootstrap al reconectar |
| D3 | Toast | `MatSnackBar` no bloqueante, copy `getErrorCopy('JOIN_MATCH')` (409), sin refresco forzado |
| D4 | Ubicación | Dentro de "Jugar online" (`lobby/online`), no modo nuevo |
| D5 | Paginación | Cursor + "Cargar más" (`limit`/`after`/`_links.next`) |
| D6 | createMatch | Generalizar método + toggle de visibilidad, default `PRIVATE` |
| D7 | Join | Extraer `joinCode` de `_links.join.href` y reusar `joinByCode` |
