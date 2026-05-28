import { Injectable } from '@angular/core';
import type { MatchWsEvent, MatchDerivedEvent, TurnChangedPayload } from '../models/match-ws-events';
import { resolveDelay } from '../config/match-event-delays.config';
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

  init(deps: MatchEventQueueDeps): void {
    this.deps = deps;
  }

  enqueueTransactional(event: MatchWsEvent): void {
    if (!this.deps) {
      console.warn('[MatchEventQueueService] enqueueTransactional called before init');
      return;
    }

    const seat = (event.payload as { seat?: string }).seat;
    const local = seat !== undefined && seat !== null && seat === this.deps.getViewerSeat();
    // Eventos bloqueantes: el "delay efectivo" es el ACK del usuario, no un timer (FR-010).
    const delayMs = isBlockingEvent(event.eventType) ? 0 : resolveDelay(event.eventType, local);

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
      this.schedule();
      return;
    }

    this.pendingTimerId = setTimeout(() => {
      this.pendingTimerId = null;
      const current = this.queue.shift();
      if (current) {
        this.applyItem(current);
      }
      this.processing = false;
      this.schedule();
    }, item.delayMs);
  }

  private cancelTimer(): void {
    if (this.pendingTimerId !== null) {
      clearTimeout(this.pendingTimerId);
      this.pendingTimerId = null;
    }
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
