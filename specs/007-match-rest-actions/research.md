# Phase 0 — Research: Acciones de match contra el backend (REST)

## R1 — Endpoints REST que se consumen

**Decisión**: usar los endpoints definidos en `docs/CONTRATOS_API.md` con sus paths, cuerpos y respuestas exactos:

| Acción de UI | Endpoint | Body | Response | Sección |
|---|---|---|---|---|
| Cantar truco | `POST /api/matches/{matchId}/truco` | (vacío) | `204 No Content` | §4.7 |
| Cantar envido | `POST /api/matches/{matchId}/envido` | `{ "call": "ENVIDO" \| "REAL_ENVIDO" \| "FALTA_ENVIDO" }` | `204 No Content` | §4.9 |
| Responder truco | `POST /api/matches/{matchId}/truco/respond` | `{ "response": "QUIERO" \| "NO_QUIERO" \| "QUIERO_Y_ME_VOY_AL_MAZO" }` | `204 No Content` | §4.8 |
| Responder envido | `POST /api/matches/{matchId}/envido/respond` | `{ "response": "QUIERO" \| "NO_QUIERO" }` | `204 No Content` | §4.10 |
| Irse al mazo | `POST /api/matches/{matchId}/fold` | (vacío) | `204 No Content` | §4.11 |
| Jugar carta | `POST /api/matches/{matchId}/play-card` | `{ "suit": "ESPADA" \| "BASTO" \| "COPA" \| "ORO", "number": 1..12 }` | `204 No Content` | §4.6 |
| Crear bot match | `POST /api/matches/bot` (ya existe) | `{ "botId", "gamesToPlay": 1\|3\|5 }` | `200 OK { "matchId": uuid, ... }` | — |

**Rationale**: el contrato es la fuente autoritativa. Todos responden `204` salvo `POST /matches/bot` que devuelve `matchId`. La auth viaja por `Authorization: Bearer <jwt>` inyectado por el `jwtInterceptor` existente.

**Alternativas consideradas**:
- Wrappear todas las acciones en un único endpoint genérico tipo `/api/matches/{id}/action` — descartado, el backend no lo expone.
- Esperar a tener WebSocket antes de cablear acciones — descartado, contradice el alcance pedido.

## R2 — Política de manejo de errores

**Decisión**: cada llamada usa `.subscribe({ next: () => {}, error: (err) => console.warn(...) })` en el `MatchActionsService`, o equivalente con `catchError(() => EMPTY)` antes del `subscribe`. Cero feedback visual al usuario para 4xx/5xx/timeouts/network errors en esta feature. Log opcional en consola con prefijo `[match-actions]` para diagnóstico de desarrollo.

**Rationale**: FR-010 + SC-003 lo exigen explícitamente: en esta etapa la mayoría de las acciones serán rechazadas por el backend (porque el mock las marca como disponibles sin estar sincronizado con el server). Mostrar errores degradaría la experiencia de desarrollo y sería inútil.

**Alternativas consideradas**:
- Toast silencioso de "acción no disponible" — descartado, contradice FR-010.
- Almacenar errores en un store de diagnóstico — descartado, agrega complejidad sin valor para esta iteración.

## R3 — Anti-doble-tap (debounce / disable)

**Decisión**: usar `signal<boolean>` por componente que dispara la acción (ej. `isCallingTruco`, `isPlayingCard`) que se setea a `true` al iniciar la request y vuelve a `false` en `finalize()`. El botón se deshabilita mientras esté en `true`. Ventana mínima implícita: hasta que vuelva la respuesta (sin importar éxito o error).

**Rationale**: cumple SC-005 ("≤ 1 request por click en ventana de 1 s") con cero coordinación entre componentes. No requiere RxJS `throttleTime` ni debounce explícito.

**Alternativas consideradas**:
- `throttleTime(500)` sobre un subject por acción — descartado, agrega complejidad y el operador requiere subject compartido.
- Sin protección, confiando en que el usuario no clickee dos veces — descartado, viola SC-005.

## R4 — Carta clickeada no se mueve a la mesa

**Decisión**: `PlayerHandComponent` mantiene su lista de cartas leída desde `MatchState.roundGame.myCards` del mock. El handler de click sólo invoca `MatchActionsService.playCard(matchId, card)`; no modifica ninguna señal de UI. Se omite cualquier "carta seleccionada" o feedback de tap más allá de un ripple visual del botón.

**Rationale**: FR-009 explícito. El movimiento a la mesa se hará por evento WS `CARD_PLAYED` en una iteración posterior; introducir movimiento ahora generaría inconsistencias cuando llegue la implementación WS.

**Alternativas consideradas**:
- Mover la carta a la mesa de forma optimista y revertir en error — descartado por FR-009 y porque la feature explícitamente difiere ese comportamiento al ciclo WS.

## R5 — Ruta `/match/:matchId`

**Decisión**: cambiar `app.routes.ts` para que la ruta `match` sea `match/:matchId` (con segmento dinámico). `MatchScreenComponent` lee el id via `ActivatedRoute.snapshot.paramMap.get('matchId')` (en lugar / además del `queryParamMap` actual para el `fixture` mock). El `fixture` query param se conserva para desarrollo del mock.

**Rationale**: FR-002 exige `matchId` como contexto. Pasarlo por route param lo hace deep-linkable y compatible con la convención del resto del proyecto.

**Alternativas consideradas**:
- Pasar el `matchId` por router state (`{ state: { matchId } }`) — descartado, no sobrevive a refresh.
- Mantener un store global con `currentMatchId` — descartado, sobre-engineering para esta iteración.

## R6 — Navegación post-creación bot match

**Decisión**: tras un `next` exitoso de `createBotMatch(...)` en `BotsConfigPageComponent`, llamar `router.navigate(['/match', response.matchId])`. En `error`, permanecer en la página sin mostrar mensaje al usuario (alineado a FR-010 para todo el flujo de match — aunque conviene revisar si ya hay copy de error en lobby; si lo hay, se respeta lo existente fuera de la pantalla de match).

**Rationale**: User Story 1 lo pide directamente. Reutiliza `BotsApiService.createBotMatch` ya implementado y probado por su contract test.

**Alternativas consideradas**:
- Navegar antes de la respuesta (optimista) — descartado, generaría pantalla de match sin `matchId` válido.

## R7 — Submenú de envido y opción "envido" del menú default

**Decisión**:
- En el menú default, mostrar la opción "Envido" sólo si `availableActions` del mock contiene `{ type: 'CALL_ENVIDO' }`.
- Al tocar "Envido" se abre `EnvidoSubmenuComponent` (ya existe) con las 3 variantes habilitadas; al seleccionar una se llama a `MatchActionsService.callEnvido(matchId, variant)` y se cierra el submenú.
- Las opciones individuales del submenú no necesitan estar todas habilitadas en esta feature: por simplicidad, todas las variantes son seleccionables (el backend rechaza si no aplica; el error se silencia).

**Rationale**: FR-012 + FR-013 + AS-2 de US2 lo describen. El submenú ya existe en `components/available-actions-panel/envido-submenu/`, sólo hace falta cablearlo.

**Alternativas consideradas**:
- Deshabilitar variantes individuales del submenú según si ya hubo `ENVIDO` cantado — descartado, el mock no provee esa granularidad y la iteración explícitamente acepta requests que serán rechazadas.

## R8 — Tests

**Decisión**:
- Contract test (`src/tests/contract/match-actions.contract.spec.ts`): parsear las secciones §4.6 – §4.11 + §8.1 de `docs/CONTRATOS_API.md` y verificar:
  - Paths exactos por acción.
  - Bodies y enums permitidos (case-sensitive).
  - Que los tipos TS (`PlayCardRequest`, `CallEnvidoRequest`, `RespondTrucoRequest`, `RespondEnvidoRequest`) satisfagan los shape descritos.
- Unit test del `MatchActionsService` con `HttpTestingController`: cada método (a) dispara una request al path correcto con el body correcto, (b) ante `flush(404)` / `error` no propaga la excepción, (c) loguea via `console.warn`.
- Unit test de `BotsConfigPageComponent`: tras `createBotMatch` exitoso, `Router.navigate` es llamado con `['/match', matchId]`.

**Rationale**: cubre Constitution Principle II (validación cruzada con contrato) y los AC más críticos.

**Alternativas consideradas**:
- E2E con Playwright — descartado para esta iteración; Vitest + HttpTestingController es suficiente y consistente con el resto del proyecto.
