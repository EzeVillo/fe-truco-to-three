# Research: Revancha al terminar una partida

**Feature**: 014-rematch-on-match-end | **Fecha**: 2026-05-29

Decisiones técnicas para resolver los puntos abiertos del plan. No quedaron marcadores
`NEEDS CLARIFICATION` (la spec se clarificó previamente: la oferta es event-driven, sin reglas de
negocio ni lógica de bot en el FE; "rechazar" = "abandonar" = `REMATCH_CLOSED_BY_LEAVE`; y la oferta
aparece **después de cerrar el modal de resultado**, nunca simultánea).

## D1 — Ruteo de los eventos `REMATCH_*` (canal dedicado, fuera de cola y de `stateVersion`)

**Decisión**: Los 5 eventos `REMATCH_*` llegan por `/user/queue/match` con el `matchId` de la
partida **original**. En la suscripción de `MatchStateService` se detectan por `eventType` y se
entregan por un **canal dedicado** (`rematch$: Subject<MatchWsEvent>`), **sin** pasar por
`processLiveEvent` (reconciliación por `stateVersion`) **ni** por la cola ack-gated
(`MatchEventQueueService`). No modifican `MatchState` ni `roundGame` (el reducer ya los trata como
no-op) y no tocan `lastSeenVersion`/`lastApplied`.

**Rationale**: hay dos problemas si se procesan por el pipeline transaccional normal:
1. **Deadlock con el ACK del modal de resultado**: `MATCH_FINISHED` es *bloqueante*
   (`match-blocking-events.config.ts`): al aplicarlo, la cola queda `pausedForAck=true` hasta que el
   modal de resultado llame `resumeAck()`. Un `REMATCH_AVAILABLE` encolado detrás quedaría
   bloqueado. Entregándolo por un canal directo, la sesión de revancha se actualiza aunque la cola
   esté pausada, y queda lista para cuando el usuario cierre el modal (ver D3).
2. **Falsos huecos de `stateVersion`**: tras `MATCH_FINISHED` no hay más eventos transaccionales de
   *esta* partida (la nueva tiene su propio `matchId`/stream). Sacar los `REMATCH_*` del conteo
   evita refetches inútiles.

Mismo grado de desacople que los eventos del temporizador (`ACTION_DEADLINE_*`), que también viajan
por `/user/queue/match` pero se rutean aparte (feature 013, research D1).

**Implementación**: en la callback de `/user/queue/match`, antes de `processLiveEvent`, chequear
`isRematchEvent(event.eventType)`; si es, `this.rematch$.next(event)` y `return`. Como la oferta se
abre recién al cerrar el modal de resultado, los eventos llegados durante el `loading` o mientras el
modal está abierto solo actualizan el signal `session` de `RematchStateService`; el snapshot REST
(`GET …/rematch`) es la reconciliación de respaldo (ver D3).

**Alternativas consideradas**:
- *Procesarlos como transaccionales (estado actual del tipado)*: rechazada por el deadlock de ACK y
  los falsos huecos.
- *Rutearlos por `enqueueDerived`*: rechazada — los derivados pasan por la **misma cola** pausada
  por el ACK de `MATCH_FINISHED`; no resuelve el deadlock.

> **A verificar contra backend**: el doc lista los `REMATCH_*` en la sección de eventos de match; el
> ruteo por `eventType` funciona reciban o no `stateVersion`.

## D2 — Estado de la sesión: `RematchStateService` + snapshot REST como reconciliación

**Decisión**: Un `RematchStateService` (provisto a nivel `MatchScreenComponent`, como
`MatchStateService`) mantiene `session = signal<RematchSession | null>(null)`. Se inicializa con
`GET /api/matches/{matchId}/rematch` (§4.17.3) y se actualiza con los eventos del canal `rematch$`:

| Evento | Efecto sobre `session` |
|---|---|
| `REMATCH_AVAILABLE` | crea/setea sesión `OPEN`, `expiresAt`, `selfChoice='UNDECIDED'`, `opponentChoice='UNDECIDED'` |
| `REMATCH_OPPONENT_WANTS` | `opponentChoice='WANTS_REMATCH'` |
| `REMATCH_CONFIRMED` | `status='CONFIRMED'`, `resultMatchId=newMatchId` |
| `REMATCH_CLOSED_BY_LEAVE` | `status='CLOSED_BY_LEAVE'`, `opponentChoice='LEFT'` |
| `REMATCH_EXPIRED` | `status='EXPIRED'` |
| acción local `accept()` (204) | `selfChoice='WANTS_REMATCH'` (optimista) |
| acción local `leave()` (204) | `status='CLOSED_BY_LEAVE'`, `selfChoice='LEFT'` |

**Rationale**: concentra el estado en un único lugar reactivo (signals), separado de
`MatchState`/reconciliación. El snapshot REST es la fuente de verdad al cargar/reconectar (FR-011) y
también al decidir si abrir la oferta tras cerrar el modal (D3); los eventos lo mantienen vivo
(SC-003). `selfChoice`/`opponentChoice` habilitan los textos de estado.

**Derivación self/opponent**: el snapshot expone `playerOneChoice`/`playerTwoChoice`; se mapea con
`viewerSeat` (de `MatchState`) a `selfChoice`/`opponentChoice`. Los eventos `OPPONENT_WANTS`/
`CLOSED_BY_LEAVE` ya vienen orientados al rival (destinatario = el otro jugador) → aplican directo
sobre `opponentChoice`.

**Alternativas consideradas**:
- *Guardar la sesión dentro de `MatchState`*: rechazada — mezcla el ciclo de vida de la partida
  (reconciliada por `stateVersion`) con el de la sesión de revancha (event-driven aparte).

## D3 — Superficie de UI: oferta **secuencial** tras cerrar el modal de resultado

**Decisión** (revisada tras la clarificación 2026-05-29): la oferta de revancha **no** se embebe en
el modal de resultado ni se muestra simultánea con él. Se presenta como una **superficie posterior**:
cuando el jugador **cierra** el modal de resultado (`GameWonDialogComponent` de fin de match), recién
ahí se decide:

- si hay sesión de revancha (`RematchStateService.session()` no-null, o `GET …/rematch` responde
  `200`) → se abre un **`RematchDialogComponent`** dedicado (standalone, reactivo, inyecta
  `RematchStateService`); 
- si no hay sesión (`404` / signal null) → se navega al lobby, como hoy.

Para resolver la carrera "el usuario cierra el modal antes de que llegue `REMATCH_AVAILABLE`", al
cerrar el modal de resultado se consulta el estado de sesión de forma robusta: se usa el signal si ya
está, y si está vacío se hace un `getSession(matchId)` puntual; con eso se decide abrir la oferta o
ir al lobby. El `RematchDialogComponent` se abre con `viewContainerRef` del match-screen para poder
inyectar el `RematchStateService` provisto en el componente.

Estados de UI del `RematchDialogComponent` (todos derivados de `session`, reactivos):
- `OPEN` + `selfChoice='UNDECIDED'`: botón **"Revancha"** (`t3-btn--primary`) + **"Salir"**
  (`t3-btn--neutral`) + countdown del **tiempo restante real** + (si
  `opponentChoice='WANTS_REMATCH'`) leyenda "El rival quiere revancha".
- `OPEN` + `selfChoice='WANTS_REMATCH'`: "Esperando al rival…" + countdown + "Salir".
- `CLOSED_BY_LEAVE`: "El rival no quiere revancha" + solo "Salir".
- `EXPIRED`: "La revancha venció" + solo "Salir".
- `CONFIRMED`: navegación automática a la nueva partida (ver D4); breve "¡Revancha! Empezando…".

**Rationale**: la clarificación fija que la oferta debe aparecer **después** de cerrar el modal de
resultado ("se vería raro" instantánea). Un diálogo separado, abierto en el `afterClosed` del modal
de resultado, materializa esa secuencia sin parpadeo. La sesión/contador del backend pueden haber
arrancado antes (FR-001a/FR-009): el countdown muestra el **restante real**, no el total. Un
componente reactivo (signals) cubre la actualización en vivo que un `MAT_DIALOG_DATA` estático no
permite.

**Botonera**: usar siempre `t3-btn` (constitución III / `pnpm lint:themes`). La oferta no es un CTA
título+descripción, así que el patrón vertical no aplica; sí aplica la prohibición de `mat-*-button`.

**Alternativas consideradas**:
- *Embeber la oferta dentro del modal de resultado (D3 previa)*: **rechazada** por la clarificación
  — mostraría la oferta simultánea al resultado.
- *Renderizar la oferta como panel inline en `match-screen` (sin diálogo)*: viable, pero el diálogo
  reusa el patrón de overlay ya usado para el resultado y centra la atención; se elige el diálogo.
- *Pasar la sesión por `MAT_DIALOG_DATA`*: rechazada — no es reactivo a los eventos posteriores.

## D4 — Navegación a la revancha confirmada (`REMATCH_CONFIRMED` → `newMatchId`)

**Decisión**: Al pasar `session.status` a `CONFIRMED` con `resultMatchId`, el
`RematchDialogComponent` (o `MatchScreenComponent` observando el signal) cierra la oferta y navega a
`/match/{resultMatchId}`. Como Angular **reutiliza** el componente cuando solo cambia el parámetro de
ruta, `MatchScreenComponent` debe reaccionar a `route.paramMap` (en vez de leer `route.snapshot` una
sola vez en `ngOnInit`) y re-inicializar `MatchStateService` y `RematchStateService` con el nuevo
`matchId`.

**Rationale**: SC-002 (llegar a la nueva partida sin pasos manuales). El nuevo match ya está
`IN_PROGRESS` cuando llega `REMATCH_CONFIRMED` (§9.6: luego llegan `GAME_STARTED`/`ROUND_STARTED`/
`TURN_CHANGED` para `newMatchId`); no hace falta `POST /start`. Reaccionar a `paramMap` es el
mecanismo idiomático para navegar entre dos `match/:matchId`.

**Notas de implementación**: al re-inicializar, limpiar suscripciones y estado del match anterior
(`MatchStateService.init` resetea buffers/versión; `RematchStateService` resetea su signal). Llamar
`eventQueue.resumeAck()` al cerrar el modal de resultado (como hoy) para no dejar la cola del match
anterior pausada; la apertura de la oferta sucede en ese mismo `afterClosed`.

**Alternativas consideradas**:
- *`router.navigate` con `onSameUrlNavigation:'reload'`*: posible, pero re-suscribir por `paramMap`
  es más explícito, testeable y sin configuración global del router.

## D5 — Expiración: countdown robusto al desfase de reloj; `expiresAt` epochMillis vs ISO-8601

**Decisión**: `expiresAt` llega en **epochMillis** por `REMATCH_AVAILABLE` (§9.6) y en **ISO-8601**
por `GET …/rematch` (§4.17.3). `RematchStateService` normaliza siempre a epochMillis
(`Date.parse(iso)` para el snapshot). El countdown reutiliza `computeRemainingMsFromSnapshot(expiresAt,
serverClockOffsetMs, now)` de `utils/turn-timer.ts`, usando el `serverClockOffsetMs` que ya expone
`MatchStateService`. El tick (signal `nowMs`) corre a baja frecuencia (~200–250 ms) solo mientras la
oferta está `OPEN`. Como la oferta se abre **después** de cerrar el modal de resultado, el primer
valor mostrado ya es el **restante real** (puede ser menor al total) — FR-009/FR-001a.

**Comportamiento a 0 local**: el FE **no** declara la expiración por su cuenta: al llegar a 0 puede
atenuar la oferta, pero el cierre efectivo lo marca `REMATCH_EXPIRED` (o el `status` del snapshot).

**Alternativas consideradas**:
- *Declarar `EXPIRED` localmente al llegar a 0*: rechazada — el backend es el árbitro; podría haber
  una confirmación en vuelo.

## D6 — Acciones REST y mapeo de errores

**Decisión**: `RematchApiService` (`providedIn: 'root'`, fino) expone:
- `choose(matchId)` → `POST /api/matches/{matchId}/rematch/choose` (§4.17.1), 204.
- `leave(matchId)` → `POST /api/matches/{matchId}/rematch/leave` (§4.17.2), 204.
- `getSession(matchId)` → `GET /api/matches/{matchId}/rematch` (§4.17.3) → `RematchSessionResponse`.

`RematchStateService` los consume. Errores: `getSession` 404 = no hay sesión (no se abre la oferta;
se va al lobby). `choose`/`leave` 422 (sesión no `OPEN`/expirada/no participante) o 404 → mapear con
`getErrorCopy('REMATCH', error)` a copy de producto y degradar la UI (p. ej. "La revancha ya no está
disponible" + solo "Salir"). 401 lo maneja el interceptor (copy '').

**Rationale**: respeta FR-013 y la regla de mensajería de errores; reusa el patrón fino de
`BotsApiService`/`MatchActionsService`.

## Resumen de impacto en archivos

| Archivo | Cambio |
|---|---|
| `features/match/models/match-ws-events.ts` | + interfaces de payload de los 5 `REMATCH_*` (los `eventType` ya existen) |
| `features/match/models/rematch.models.ts` | NUEVO — `RematchSession` (vista) + `RematchSessionResponse` (REST) + enums status/choice |
| `features/match/services/match-state.service.ts` | + `rematch$` Subject; rutear `REMATCH_*` fuera de cola/`stateVersion` |
| `features/match/services/rematch-api.service.ts` | NUEVO — choose/leave/getSession |
| `features/match/services/rematch-state.service.ts` | NUEVO — signal `session`, init por snapshot, accept()/leave(), reducción de eventos |
| `features/match/utils/rematch-view.ts` | NUEVO — derivar opponentChoice/expiry/flags + normalizar expiresAt |
| `features/match/components/rematch-dialog/*` | NUEVO — diálogo reactivo de la oferta (standalone), abierto tras cerrar el resultado |
| `features/match/pages/match-screen/*` | en `afterClosed` del modal de resultado: decidir oferta-vs-lobby; proveer servicios; `viewContainerRef`; navegación a `newMatchId`; re-init por `paramMap` |
| `shared/error-copy/error-copy.ts` | + scope `'REMATCH'` |
| `tests/contract/rematch.contract.spec.ts` | NUEVO — paridad con §4.17/§9.6 |

> **Nota**: `GameWonDialogComponent` **no** se modifica para embeber la oferta (cambio respecto de la
> versión previa del plan): la oferta es un diálogo aparte que se abre al cerrarse el de resultado.
