# Research — ACK del usuario gobierna el avance de la cola

**Feature**: 011-ack-gated-event-queue
**Fecha**: 2026-05-27

Esta fase documenta las decisiones de diseño tomadas antes de la Fase 1. La feature 010 ya estableció la cola serial estricta; aquí sólo se justifica cómo extenderla.

---

## Decisión 1 — Dónde vive la marca "bloqueante"

**Decisión**: Catálogo centralizado de `eventType` candidatos en `src/app/features/match/config/match-blocking-events.config.ts`, exportado como `BLOCKING_MATCH_EVENT_TYPES: ReadonlySet<MatchEventType>`. La cola consulta el catálogo al aplicar cada evento.

**Racional**:
- FR-004 exige una única fuente configurable.
- Espejar la convención de `match-event-delays.config.ts` (010) — misma carpeta, mismo formato `Record`/`Set` tipado contra `MatchEventType`.
- Mantenerlo como `Set` (no `Record<boolean>`) hace explícita la semántica "lista de inclusión" y simplifica `if (BLOCKING.has(evt.eventType))`.

**Alternativas consideradas**:
- *Hardcodear el switch en `MatchEventQueueService`*: rechazado — viola FR-004 (no centralizado) y obliga a tocar el servicio para agregar/quitar.
- *Marcar `isBlocking: boolean` en cada handler de modal del componente*: rechazado — la cola decidiría "tarde" (después de aplicar y emitir), forzando coordinación frágil entre Subject emit y diálogo abierto.
- *Calcular bloqueo desde el payload (p. ej. `ENVIDO_RESOLVED` sólo bloquea si `response = QUIERO`)*: rechazado para la cola — agrega lógica de dominio al servicio genérico. Se resuelve con la **Decisión 3** (override del componente).

---

## Decisión 2 — Mecanismo de pausa en la cola

**Decisión**: Añadir a `MatchEventQueueService` un estado interno `pausedForAck: boolean` y un método público `resumeAck(): void`. En `applyItem`, después de aplicar el evento, si su `eventType ∈ BLOCKING_MATCH_EVENT_TYPES` y `pausedForAck` no fue ya liberado por el handler (ver Decisión 3), se marca `pausedForAck = true` y `schedule()` se aborta hasta `resumeAck()`.

**Detalle de control de flujo**:
1. `schedule()` consulta `pausedForAck` además de las condiciones actuales (`processing`, `pendingTimerId`, `queue.length`).
2. `applyItem(item)` ejecuta `deps.applyTransactional(event)` que internamente llama `Subject.next` síncronamente; los suscriptores (componente) corren antes de que `applyItem` retorne.
3. Si el handler decidió que no abre modal y llamó `resumeAck()`, el flag queda en `false` y la cola sigue normal.
4. Si el handler abrió el modal, `resumeAck()` se llamará en `dialogRef.afterClosed()` — la cola queda parada hasta entonces.
5. Para evitar la condición de carrera "aplico evento bloqueante → marco pausedForAck = true → handler ya había llamado resume", se usa un *token* por evento bloqueante: `applyItem` decide pausar **antes** de invocar `applyTransactional`, y `resumeAck` consume el token; si el handler llama `resumeAck` síncronamente, el token ya está liberado cuando `applyItem` vuelve a chequear.

Concretamente, el orden dentro de `applyItem(item)` cuando es bloqueante:
```ts
this.pausedForAck = true;          // pausa optimista
this.deps.applyTransactional(...);  // emite Subject.next; handler puede llamar resumeAck() aquí
// si el handler lo llamó, pausedForAck quedó en false
// si no, queda en true y schedule() no programará el siguiente
```

**Racional**:
- Es la mínima cirugía sobre la 010: una sola variable de estado y una guarda extra en `schedule()`.
- El control fluye desde el componente (que sabe del dominio "este envido no abre modal porque fue NO_QUIERO") hacia el servicio.
- Preserva el comportamiento existente para eventos no bloqueantes (delays temporales).

**Alternativas consideradas**:
- *Promise/Observable que el componente resuelve*: rechazado — agrega asincronía innecesaria y complica la lectura del flujo.
- *Inyectar `MatDialog` en la queue para que el servicio espere el cierre*: rechazado — acopla un servicio puro a Material y rompe la testabilidad del servicio.

---

## Decisión 3 — Override del componente cuando el evento bloqueante no abre modal

**Decisión**: El handler del componente (suscrito a `envidoResolved$`, `gameWon$`, `matchEnded$`) llama `eventQueue.resumeAck()` **inmediatamente** cuando, por dominio, ese evento puntual no abre modal (p. ej. `payload.response === 'NO_QUIERO'`). Si sí abre, llama `resumeAck()` en `dialogRef.afterClosed().subscribe(...)`.

**Racional**:
- Mantiene a la cola libre de lógica de dominio.
- Cubre el caso documentado en código (`openEnvidoResultDialog` ya hace early-return en NO_QUIERO).
- FR-006 (idempotencia) se cumple porque `resumeAck()` es no-op cuando `pausedForAck = false`.

**Alternativas**: ver Decisión 1.

---

## Decisión 4 — Idempotencia del ACK

**Decisión**: `resumeAck()` chequea `if (!this.pausedForAck) return;` antes de tocar el flag. Doble click sobre "Aceptar" en el dialog se traduce en a lo sumo dos `afterClosed()` (en Material el segundo es no-op por sí mismo, pero igual nos cubrimos) y `resumeAck()` adicional se vuelve inocuo.

**Racional**: FR-006 explícito. Costo: una línea.

---

## Decisión 5 — Abandono de pantalla y reconexión

**Decisión**: Reutilizar lo que ya hace la 010:
- `MatchStateService.destroy()` invoca `eventQueue.clear()`. Se extiende `clear()` para resetear también `pausedForAck = false`.
- En `ngOnDestroy` del componente, las llamadas existentes a `dialog.closeAll()` no aplican (el componente no las hace hoy). Para alinearse con FR-008 ("cerrar el modal sin aplicar los eventos pendientes"), se agrega `this.dialog.closeAll()` en `ngOnDestroy`.
- Para reconexión (`flushImmediately()` durante el rebootstrap): la 010 ya descarta delays y aplica todo de una vez. Se modifica `flushImmediately()` para resetear `pausedForAck = false` antes de drenar — el snapshot fresco trae el estado canónico final, así que cualquier modal que estuviera abierto pierde sentido. El componente cierra el modal en respuesta a `loading.set(true)` (nuevo `effect` o subscripción al signal `loading` — alternativa simple: confiar en `MatDialog.closeAll()` en el camino de re-bootstrap, invocado desde el componente al detectar `loading` flanco subir).

**Racional**: Consistencia con FR-009. Cost: 2 líneas en queue + un `effect` en el componente.

---

## Decisión 6 — Catálogo inicial

**Decisión**: `BLOCKING_MATCH_EVENT_TYPES = new Set<MatchEventType>(['ENVIDO_RESOLVED', 'GAME_SCORE_CHANGED', 'MATCH_FINISHED', 'MATCH_ABANDONED', 'MATCH_FORFEITED'])`.

Notas:
- `ENVIDO_RESOLVED`: cubre user story 1. `NO_QUIERO` lo "destraba" por la Decisión 3.
- `GAME_SCORE_CHANGED`: dispara `gameWon$` cuando un `gamesWon*` se incrementa → abre `GameWonDialogComponent`. Si el evento no representa un cambio de partida ganada (caso teórico), el handler debe llamar `resumeAck()` inmediato.
- `MATCH_FINISHED|ABANDONED|FORFEITED`: el modal de fin de partida exige ACK del jugador para volver al lobby.
- **`HAND_RESOLVED` no se incluye todavía**: no existe modal de "Ronda ganada" en el código actual (la spec lo menciona como futuro). Cuando se cree, basta con agregar el string al set y conectar el modal en `match-screen.component.ts`.

**Racional**: Cubre los modales bloqueantes existentes; deja claro cómo extender.

---

## Decisión 7 — Encadenado de modales bloqueantes (FR-010)

**Decisión**: No requiere lógica extra. Al cerrarse el primer modal, `resumeAck()` libera la pausa, `schedule()` saca el siguiente ítem de la cola y `applyItem` se ejecuta inmediatamente (sin delay temporal porque el item ya estaba "esperando" en cola y el delay sólo aplica al programar el `setTimeout` desde 0).

Nota fina: el comportamiento actual de `schedule()` recalcula `setTimeout(item.delayMs)` cada vez. Para cumplir FR-010 ("delay efectivo = tiempo de lectura, sin extra entre dos bloqueantes consecutivos"), se modifica `schedule()` así: si el ítem siguiente también es bloqueante (`BLOCKING.has(item.event.eventType)`), se aplica con delay 0. Implementación: agregar una rama en `schedule()` que detecte ese caso y salte el `setTimeout`.

**Racional**: Cumple FR-010 literal; coste pequeño y testeable.

---

## Decisión 8 — Tests

**Cobertura mínima**:

1. `MatchEventQueueService`:
   - Aplicar un evento bloqueante deja `pausedForAck = true` y NO procesa el siguiente ítem encolado.
   - `resumeAck()` reanuda y procesa el siguiente con su delay normal.
   - `resumeAck()` adicional es no-op (idempotencia, FR-006).
   - Dos bloqueantes consecutivos: primer ACK → segundo se aplica sin delay (FR-010).
   - `clear()` resetea `pausedForAck`.
   - `flushImmediately()` resetea `pausedForAck` y drena.
   - Eventos no bloqueantes mientras la cola está pausada: quedan encolados, no se pierden (FR-005).

2. `MatchScreenComponent` (integración con `MatDialog` mock):
   - `ENVIDO_RESOLVED` con `QUIERO` → modal abierto + cola pausada hasta `afterClosed`.
   - `ENVIDO_RESOLVED` con `NO_QUIERO` → no abre modal, `resumeAck()` se llama síncronamente.
   - `GAME_SCORE_CHANGED` que dispara `gameWon$` → modal + ACK.

**Test runner**: Vitest existente.

---

## Resumen

Todas las "NEEDS CLARIFICATION" implícitas del template quedan resueltas: stack ya definido por el proyecto, sin contratos nuevos, alcance acotado a la pantalla de match. La feature es una extensión mínima y aislada de la 010.
