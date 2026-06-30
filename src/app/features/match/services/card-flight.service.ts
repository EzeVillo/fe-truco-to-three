import { Injectable } from '@angular/core';
import type { Card } from '../../../core/models/match.models';

interface CardOrigin {
  key: string;
  rect: DOMRect;
  registeredAt: number;
}

/**
 * Puente entre la mano del jugador y el área de cartas jugadas para animar el
 * "vuelo" de la carta (FLIP). Al tocar una carta, `player-hand` registra su
 * posición en pantalla; cuando esa misma carta aparece en la mesa, la directiva
 * `appCardFlight` consume el origen y anima el recorrido desde la mano al slot.
 *
 * El origen vive poco: entre el tap y el render de la carta jugada media el delay
 * de la cola de audio (ver audio-architecture). Un TTL evita que un origen viejo
 * (acción cancelada, reconexión) dispare un vuelo fuera de lugar.
 */
@Injectable({ providedIn: 'root' })
export class CardFlightService {
  /** Ventana de validez del origen desde el tap (ms). */
  private static readonly TTL_MS = 4000;

  private pending: CardOrigin | null = null;

  private static keyOf(card: Card): string {
    return `${card.suit}-${card.number}`;
  }

  /** Guarda la posición en pantalla de la carta recién tocada en la mano. */
  registerOrigin(card: Card, rect: DOMRect): void {
    this.pending = { key: CardFlightService.keyOf(card), rect, registeredAt: Date.now() };
  }

  /**
   * Devuelve y descarta el origen de `card` si fue registrado hace poco. `null` si
   * no hay origen para esa carta o si expiró (en cuyo caso no se anima el vuelo).
   */
  consumeOrigin(card: Card): DOMRect | null {
    const origin = this.pending;
    if (!origin || origin.key !== CardFlightService.keyOf(card)) {
      return null;
    }
    this.pending = null;
    if (Date.now() - origin.registeredAt > CardFlightService.TTL_MS) {
      return null;
    }
    return origin.rect;
  }
}
