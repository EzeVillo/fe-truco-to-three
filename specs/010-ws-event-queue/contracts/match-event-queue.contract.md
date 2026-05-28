# Contrato interno — `MatchEventQueueService`

Esta feature no expone interfaces externas (no hay endpoints REST nuevos ni canales WS nuevos). El "contrato" que se documenta acá es la **API pública del servicio Angular nuevo**, que es lo que `MatchStateService` y los tests consumen.

## Ubicación

`src/app/features/match/services/match-event-queue.service.ts`

## Inyección y ciclo de vida

- `@Injectable()` sin `providedIn`. Se provee a nivel de `MatchScreenComponent` (`providers: [MatchStateService]` ya existe; agregar `MatchEventQueueService` al mismo array).
- Singleton por instancia de pantalla de match. Al salir de la pantalla, Angular lo destruye y se llama `clear()`.

## API pública

```ts
interface MatchEventQueueDeps {
  getViewerSeat: () => Seat | null;
  applyTransactional: (event: MatchWsEvent) => void;
  applyDerived: (event: MatchDerivedEvent) => void;
}

class MatchEventQueueService {
  /** Configura las dependencias. Llamado por MatchStateService.init(). */
  init(deps: MatchEventQueueDeps): void;

  /** Encola un evento transaccional vivo. */
  enqueueTransactional(event: MatchWsEvent): void;

  /** Encola un evento derivado vivo. */
  enqueueDerived(event: MatchDerivedEvent): void;

  /** Aplica todos los pendientes inmediatamente, en orden, sin delays. */
  flushImmediately(): void;

  /** Descarta todos los pendientes sin aplicar. Cancela timers. */
  clear(): void;

  /** Sólo testing: cantidad de eventos pendientes. */
  readonly pendingCount: () => number;
}
```

## Semántica garantizada

1. **Orden FIFO estricto**: el orden de aplicación = orden de llamadas a `enqueueTransactional` / `enqueueDerived` intercaladas, jamás reordenado.
2. **Delay mínimo**: entre dos `apply*` consecutivos, transcurre al menos `delayMs` del segundo evento (resuelto via `resolveDelay`).
3. **Eventos locales sin delay**: si `event.payload.seat === getViewerSeat()`, el ítem se marca `local=true` y se aplica con `delayMs=0`.
4. **Eventos derivados sin delay**: `delayMs=0` siempre.
5. **`flushImmediately()` preserva orden**, aplica todos los pendientes sincrónicamente en un mismo microtask y luego vuelve a IDLE.
6. **`clear()` no aplica nada**: los pendientes se descartan; útil para FR-011 (salir de la pantalla).
7. **Re-entrada**: si durante un `apply*` callback se llama de nuevo a `enqueue*`, el nuevo ítem entra al final de la cola y se procesa después del próximo delay; no causa recursión.

## Configuración consumida

```ts
// src/app/features/match/config/match-event-delays.config.ts

export const DEFAULT_MATCH_EVENT_DELAY_MS = 600;

export const MATCH_EVENT_DELAYS_MS: Record<MatchEventType, number> = {
  CARD_PLAYED: 600,
  TRUCO_CALLED: 600,
  TRUCO_RESPONDED: 600,
  ENVIDO_CALLED: 600,
  ENVIDO_RESOLVED: 800,
  FOLDED: 600,
  HAND_RESOLVED: 800,
  GAME_SCORE_CHANGED: 800,
  MATCH_FINISHED: 800,
  MATCH_ABANDONED: 800,
  MATCH_FORFEITED: 800,
  TURN_CHANGED: 0,
  ROUND_STARTED: 0,
  ROUND_ENDED: 0,
  GAME_STARTED: 0,
  HAND_DEALT: 0,
  HAND_CHANGED: 0,
  SCORE_CHANGED: 0,
  SPECTATOR_COUNT_CHANGED: 0,
  PLAYER_JOINED: 0,
  PLAYER_READY: 0,
  MATCH_CANCELLED: 0,
  MATCH_PLAYER_LEFT: 0,
  REMATCH_AVAILABLE: 0,
  REMATCH_OPPONENT_WANTS: 0,
  REMATCH_CONFIRMED: 0,
  REMATCH_CLOSED_BY_LEAVE: 0,
  REMATCH_EXPIRED: 0,
};

export function resolveDelay(
  eventType: MatchEventType,
  local: boolean,
): number {
  if (local) return 0;
  return MATCH_EVENT_DELAYS_MS[eventType] ?? DEFAULT_MATCH_EVENT_DELAY_MS;
}
```

## Integración con `MatchStateService` (cambios esperados)

- En `init(matchId)`:
  - Llamar `this.eventQueue.init({ getViewerSeat: () => this.state()?.viewerSeat ?? null, applyTransactional: e => this.applyAndIncrement(e), applyDerived: e => this.applyDerivedEvent(e) })`.
- En `processLiveEvent(event)`: si el evento pasa la validación de `stateVersion`, en vez de llamar `applyAndIncrement` directamente, llamar `this.eventQueue.enqueueTransactional(event)`.
- En `processLiveDerivedEvent(event)`: llamar `this.eventQueue.enqueueDerived(event)`.
- En el handler de reconexión (`wasConnected && isConnected && !loading`): antes del `fetchSnapshot`, llamar `this.eventQueue.flushImmediately()`.
- En `destroy()`: llamar `this.eventQueue.clear()` antes de `unsubscribeAll`.

## No-contrato

- No expone `Observable`s; los consumidores (componentes) siguen suscribiendo a `matchEvent$`, `gameWon$`, etc. de `MatchStateService`. La cola sólo retrasa el momento en que esos `Subject`s emiten.
