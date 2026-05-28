import { Injectable, signal } from '@angular/core';
import type {
  MatchWsEvent,
  MatchDerivedEvent,
  TurnChangedPayload,
  TrucoRespondedPayload,
} from '../models/match-ws-events';
import { MATCH_EVENT_DELAYS_MS, resolveDelay } from '../config/match-event-delays.config';
import { isBlockingEvent } from '../config/match-blocking-events.config';

export interface MatchEventQueueDeps {
  getViewerSeat: () => string | null;
  applyTransactional: (event: MatchWsEvent) => void;
  applyDerived: (event: MatchDerivedEvent) => void;
}

type QueuedMatchEvent =
  | { kind: 'transactional'; event: MatchWsEvent; local: boolean; delayMs: number }
  | { kind: 'derived'; event: MatchDerivedEvent; local: boolean; delayMs: number };

@Injectable()
export class MatchEventQueueService {
  private queue: QueuedMatchEvent[] = [];
  private pendingTimerId: ReturnType<typeof setTimeout> | null = null;
  private processing = false;
  private pausedForAck = false;
  private deps: MatchEventQueueDeps | null = null;
  private lastAppliedEventType: string | null = null;
  private lastAppliedSeat: string | null = null;

  private readonly _isProcessingDelay = signal<boolean>(false);
  readonly isProcessingDelay = this._isProcessingDelay.asReadonly();

  init(deps: MatchEventQueueDeps): void {
    this.deps = deps;
  }

  enqueueTransactional(event: MatchWsEvent): void {
    if (!this.deps) {
      console.warn('[MatchEventQueueService] enqueueTransactional called before init');
      return;
    }

    const payload = event.payload as { seat?: string; callerSeat?: string; responderSeat?: string };
    const actingSeat = payload.seat ?? payload.callerSeat ?? payload.responderSeat ?? null;
    const local = actingSeat !== null && actingSeat === this.deps.getViewerSeat();
    // Eventos bloqueantes: el "delay efectivo" es el ACK del usuario, no un timer (FR-010).
    // Excepción: ENVIDO_RESOLVED lleva una pausa previa para que la respuesta
    // (¡Quiero!/¡No quiero!) no aparezca pegada al canto. El gate por ACK del modal
    // se mantiene: el delay sólo retrasa el momento de aplicar el evento.
    // Why: el delay aplica aun cuando el responder es local — si no, al responder
    // el viewer con Quiero/No quiero el modal aparecería pegado al click y los
    // botones nunca se bloquearían vía isProcessingDelay.
    // Eventos que cierran la mano por decisión del jugador (NO_QUIERO o
    // QUIERO_Y_ME_VOY_AL_MAZO al truco, FOLDED "Me voy al mazo"): aplicar delay
    // aun si la acción es local, así el cierre no queda pegado al click y se
    // percibe el canto. El QUIERO simple no entra acá: la mano continúa.
    const trucoResponse =
      event.eventType === 'TRUCO_RESPONDED'
        ? (event.payload as TrucoRespondedPayload).response
        : null;
    const isHandClosingByPlayer =
      event.eventType === 'FOLDED' ||
      trucoResponse === 'NO_QUIERO' ||
      trucoResponse === 'QUIERO_Y_ME_VOY_AL_MAZO';

    const delayMs = isBlockingEvent(event.eventType)
      ? event.eventType === 'ENVIDO_RESOLVED'
        ? MATCH_EVENT_DELAYS_MS[event.eventType]
        : 0
      : isHandClosingByPlayer
        ? MATCH_EVENT_DELAYS_MS[event.eventType]
        : resolveDelay(event.eventType, local);

    const item: QueuedMatchEvent = { kind: 'transactional', event, local, delayMs };

    // Coalescing conservador: dos TURN_CHANGED consecutivos del mismo seat sin nada en medio
    if (event.eventType === 'TURN_CHANGED') {
      const newSeat = (event.payload as TurnChangedPayload).seat;
      // Si el último evento aplicado fue un TURN_CHANGED del mismo seat y no hay nada pendiente
      if (
        this.lastAppliedEventType === 'TURN_CHANGED' &&
        this.lastAppliedSeat === newSeat &&
        this.queue.length === 0 &&
        !this.processing
      ) {
        return;
      }
      // Si el último item en cola es un TURN_CHANGED del mismo seat, reemplazarlo
      if (this.queue.length > 0) {
        const last = this.queue[this.queue.length - 1];
        if (last.kind === 'transactional' && last.event.eventType === 'TURN_CHANGED') {
          const lastSeat = (last.event.payload as TurnChangedPayload).seat;
          if (lastSeat === newSeat) {
            this.queue[this.queue.length - 1] = item;
            return;
          }
        }
      }
    }

    this.queue.push(item);
    this.schedule();
  }

  enqueueDerived(event: MatchDerivedEvent): void {
    const item: QueuedMatchEvent = { kind: 'derived', event, local: false, delayMs: 0 };
    this.queue.push(item);
    this.schedule();
  }

  flushImmediately(): void {
    this.cancelTimer();
    this.pausedForAck = false;
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.applyItem(item);
    }
    this.processing = false;
  }

  clear(): void {
    this.cancelTimer();
    this.queue = [];
    this.processing = false;
    this.pausedForAck = false;
    this._isProcessingDelay.set(false);
  }

  resumeAck(): void {
    if (!this.pausedForAck) {
      return;
    }
    this.pausedForAck = false;
    this.schedule();
  }

  pendingCount(): number {
    return this.queue.length;
  }

  private schedule(): void {
    if (this.processing || this.pendingTimerId !== null || this.queue.length === 0) {
      return;
    }
    if (this.pausedForAck) {
      return;
    }

    const item = this.queue[0];
    this.processing = true;

    if (item.delayMs === 0) {
      this.queue.shift();
      this.applyItem(item);
      this.processing = false;
      this.updateProcessingDelayState();
      this.schedule();
      return;
    }

    this._isProcessingDelay.set(true);

    this.pendingTimerId = setTimeout(() => {
      this.pendingTimerId = null;
      const current = this.queue.shift();
      if (current) {
        this.applyItem(current);
      }
      this.processing = false;
      this.updateProcessingDelayState();
      this.schedule();
    }, item.delayMs);
  }

  private cancelTimer(): void {
    if (this.pendingTimerId !== null) {
      clearTimeout(this.pendingTimerId);
      this.pendingTimerId = null;
    }
  }

  private updateProcessingDelayState(): void {
    const hasPendingDelay = this.queue.some(item => item.delayMs > 0);
    this._isProcessingDelay.set(hasPendingDelay);
  }

  private applyItem(item: QueuedMatchEvent): void {
    if (!this.deps) {
      console.warn('[MatchEventQueueService] applyItem called before init');
      return;
    }
    if (item.kind === 'transactional') {
      // Pausa antes de notificar al handler: si éste decide ACK síncrono (p. ej. NO_QUIERO),
      // puede invocar resumeAck() dentro de applyTransactional y revertir el flag.
      if (isBlockingEvent(item.event.eventType)) {
        this.pausedForAck = true;
      }
      this.deps.applyTransactional(item.event);
      this.lastAppliedEventType = item.event.eventType;
      this.lastAppliedSeat = (item.event.payload as { seat?: string }).seat ?? null;
    } else {
      this.deps.applyDerived(item.event);
    }
  }
}
