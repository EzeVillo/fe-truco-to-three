# Research: Sistema de amigos (MVP solo amistades)

**Feature**: 024-friends-system | **Date**: 2026-06-05

Decisiones técnicas previas al diseño. Todas las "NEEDS CLARIFICATION" del Technical Context
quedaron resueltas aquí.

---

## D1 — Dónde vive el estado social

**Decisión**: Un `signalStore` (`social.store.ts`, `{ providedIn: 'root' }`) que mantiene tres
señales de lista (`friends`, `incoming`, `outgoing`) más `loading`/`error`, expone métodos de
acción (que llaman al `SocialApiService` y aplican optimismo controlado) y un método `start()` que
gatea la suscripción WS.

**Rationale**:
- El estado se comparte entre la página y el (futuro) indicador de la navegación; un store root
  evita reconstruirlo por componente.
- NgRx Signals ya es el patrón de estado del repo (`AuthStore`). Coherencia.
- La reconciliación WS necesita un punto único de mutación; centralizarla en el store evita
  condiciones de carrera entre la página y el handler de eventos.

**Alternativas consideradas**:
- *Estado en el componente página*: rechazado — se pierde al salir de `/friends` y complica que un
  badge del header refleje solicitudes pendientes a futuro.
- *NgRx Store + Effects*: disponible en el proyecto pero más ceremonia de la necesaria para 3 listas;
  Signals es más liviano y ya consolidado para estado de este tamaño.

---

## D2 — Suscripción WS gateada (registrados, no guests)

**Decisión**: Replicar el patrón de `ProfileNotificationService`: un `effect` que observa
`authStore.isAuthenticated()`, `isGuest()` y `username()`, y suscribe a
`/user/queue/social` solo cuando `isAuthenticated && !isGuest && username !== null`; si deja de
cumplirse, desuscribe y limpia el estado. La suscripción usa `WebSocketService.subscribe<SocialWsEvent>()`,
que ya espera la conexión internamente.

**Rationale**: El contrato restringe lo social a usuarios registrados (`§7.5`); guests no deben ni
suscribirse. El patrón ya existe y está probado en el repo (FR-014, SC-006).

**Alternativas consideradas**:
- *Suscribir siempre y filtrar en cliente*: rechazado — desperdicia conexión y contradice el
  modelo de permisos del backend.

---

## D3 — Bootstrap REST de las tres listas

**Decisión**: Al iniciar la página `/friends` (o al `start()` del store), cargar en paralelo con
`forkJoin`:
- `GET /api/social/friendships` → amigos
- `GET /api/social/friendship-requests/incoming` → recibidas
- `GET /api/social/friendship-requests/outgoing` → enviadas

Un único `loading` global mientras llega la tanda; en error, `getErrorCopy('SOCIAL', err)`.

**Rationale**: Las tres listas se ven juntas (tabs en una sola página); cargarlas de una sola vez da
una entrada coherente y un solo estado de carga (patrón ya usado en `profile-page` con `forkJoin`).
SC-002 se cumple porque las actualizaciones posteriores llegan por WS, no por polling.

**Alternativas consideradas**:
- *Lazy por tab*: rechazado para el MVP — agrega estados de carga por pestaña sin beneficio claro y
  complica que el WS actualice una pestaña no abierta todavía.

---

## D4 — Reconciliación idempotente y eventos que cruzan listas

**Decisión**: El store reduce cada `SocialWsEvent` a mutaciones sobre las tres listas, usando el
`username` del otro jugador como clave de identidad y dedup. Tabla evento → efecto (detallada en
`data-model.md`):

| Evento WS | Efecto en listas |
|-----------|------------------|
| `FRIEND_REQUEST_RECEIVED` | upsert en `incoming` (por `requesterUsername`) |
| `FRIEND_REQUEST_ACCEPTED` | quitar de `outgoing` (por `addresseeUsername`) + upsert en `friends` |
| `FRIEND_REQUEST_DECLINED` | quitar de `outgoing` (lo recibe el requester) |
| `FRIEND_REQUEST_CANCELLED` | quitar de `incoming` (lo recibe el addressee) |
| `FRIENDSHIP_REMOVED` | quitar de `friends` (por el username del otro, sea cual sea de los dos) |

Cada mutación es idempotente: el upsert no duplica si la clave ya existe; el remove es no-op si no
está. Esto cubre el caso "evento de algo ya visto" (FR-013) y las acciones concurrentes.

**Rationale**: El backend identifica todo por `username` y no expone `friendshipId` (`§7.5`), así que
`username` es la clave natural. La idempotencia hace que el orden REST-vs-WS no importe (si el WS
llega antes que la respuesta REST de la acción, el estado converge igual).

**Detalle de `FRIENDSHIP_REMOVED`**: el payload trae `{ requesterUsername, addresseeUsername,
removedByUsername }`. El "otro" jugador es el que no es el usuario actual (`authStore.username()`);
se quita ese username de `friends`.

**Alternativas consideradas**:
- *Refetch completo ante cada evento*: rechazado — más latencia, más carga, y pierde el sentido del
  push WS; solo se usaría como fallback ante reconexión (ver D5).

---

## D5 — Reconexión / consistencia tras caída del WS

**Decisión**: Para el MVP, ante reconexión del socket el store re-bootstrapea por REST (vuelve a
llamar D3) para garantizar consistencia. `WebSocketService.connected` ya emite el estado de
conexión; el store puede re-disparar la carga al reconectar.

**Rationale**: Es la forma más simple y robusta de cerrar la brecha de eventos perdidos durante una
caída (edge case "conexión en tiempo real caída"). No requiere paginación ni cursores porque las
listas sociales del MVP son chicas.

**Alternativas consideradas**:
- *Reconciliación incremental con secuencia/versión*: el contrato social no expone número de
  secuencia para este canal; over-engineering para el tamaño del dato.

---

## D6 — Acciones: optimismo y manejo de errores

**Decisión**: Las acciones (enviar, aceptar, rechazar, cancelar, eliminar) llaman al REST y aplican
la mutación local **al recibir éxito** (`204`/`200`), confiando además en el WS para el otro lado.
Para eliminar amigo y rechazar/cancelar, se puede aplicar quita optimista con rollback si el REST
falla. El error se traduce con `getErrorCopy('SOCIAL', err)` y se muestra en snackbar/inline
(nunca `ApiError.message`).

**Rationale**: Evita parpadeos y entradas fantasma. La validación dura (no-self, no-duplicado) la
hace el backend; el front además valida `username !== self` antes de enviar para feedback inmediato
(FR-003).

**Alternativas consideradas**:
- *Optimismo total sin esperar REST*: rechazado para enviar solicitud (necesitamos el resultado para
  saber si fue válida); aceptable para quitas.

---

## D7 — Scope de copy de errores

**Decisión**: Agregar un único scope `'SOCIAL'` a `ErrorCopyScope` en `shared/error-copy/error-copy.ts`,
con mapeo por status:
- `401` → `''` (lo maneja el interceptor)
- `404` → "Ese usuario no existe o la solicitud ya no está disponible."
- `409` / `422` → "No se pudo completar la acción: revisá el estado de la solicitud."
- `0` / `5xx` → "No pudimos conectarnos. Reintentá en unos segundos."
- fallback genérico

Se afinará el copy exacto en implementación; los códigos salen de `§7.5` (404/422 documentados en
eliminar amigo, etc.).

**Rationale**: Un solo scope alcanza para todas las acciones sociales del MVP; mantiene el catálogo
centralizado (FR-015, Constitution "Copy de errores").

**Alternativas consideradas**:
- *Un scope por acción*: rechazado — granularidad innecesaria; los mensajes son equivalentes por
  status.

---

## D8 — Punto de entrada en la navegación

**Decisión**: Agregar un enlace a `/friends` en `GlobalHeaderComponent`, visible solo cuando
`isAuthenticated && !isGuest` (igual que el link de perfil, que se oculta para guests). La ruta se
registra en `app.routes.ts` con `canMatch: [authGuard]`.

**Rationale**: Coherente con cómo se expone `profile/:username` desde el header. No se crea un
drawer global (el usuario eligió página dedicada).

**Alternativas consideradas**:
- *Acceso solo desde el lobby*: válido pero menos visible; el header da acceso desde cualquier
  pantalla fuera de partida.

---

## Resumen de decisiones

| ID | Tema | Decisión |
|----|------|----------|
| D1 | Estado | `signalStore` root con 3 listas + acciones + reconciliación |
| D2 | WS gating | `effect` gateado a registrados (patrón ProfileNotificationService) |
| D3 | Bootstrap | `forkJoin` de las 3 listas REST al entrar |
| D4 | Reconciliación | reduce evento→mutación idempotente por `username` |
| D5 | Reconexión | re-bootstrap REST al reconectar |
| D6 | Acciones | aplicar en éxito + quitas optimistas con rollback; copy catalogado |
| D7 | Errores | scope `SOCIAL` único en `getErrorCopy` |
| D8 | Entrada | link en `GlobalHeaderComponent`, oculto a guests |
