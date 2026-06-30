import { afterNextRender, Directive, ElementRef, inject, input } from '@angular/core';
import type { Card } from '../../../core/models/match.models';
import { CardFlightService } from '../services/card-flight.service';

/**
 * Anima la entrada de una carta a la mesa. Si la carta tiene un origen registrado
 * (el jugador la tocó en su mano, ver CardFlightService), hace un FLIP: arranca en
 * la posición y tamaño que tenía en la mano y vuela hasta el slot. Sin origen
 * (carta del rival, espectador, reconexión) cae a un fade + scale en el lugar.
 *
 * Solo `transform`/`opacity` (GPU, sin reflow) y vía Web Animations API
 * (interrumpible, fuera del hilo principal). Respeta `prefers-reduced-motion`.
 */
@Directive({
  selector: '[appCardFlight]',
  standalone: true,
})
export class CardFlightDirective {
  // Curvas/duraciones en TS (no SCSS) porque la animación se construye por JS.
  // ease-out fuerte; el vuelo es una acción deliberada y ocasional, así que un
  // pelín más largo que una transición de UI estándar.
  private static readonly EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  private static readonly FLIGHT_MS = 300;
  private static readonly POP_MS = 200;

  readonly card = input.required<Card>({ alias: 'appCardFlight' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly flight = inject(CardFlightService);

  constructor() {
    afterNextRender(() => {
      // Sin Web Animations API (p. ej. jsdom en tests) o con reduced-motion no se anima.
      if (typeof this.host.nativeElement.animate !== 'function' || this.prefersReducedMotion()) {
        return;
      }
      const origin = this.flight.consumeOrigin(this.card());
      if (origin) {
        this.playFlight(origin);
      } else {
        this.playPop();
      }
    });
  }

  private playFlight(origin: DOMRect): void {
    const dest = this.host.nativeElement.getBoundingClientRect();
    if (dest.width === 0 || dest.height === 0) {
      return;
    }
    // Delta entre centros (transform-origin por defecto = center) y razón de
    // escala para arrancar del tamaño que la carta tenía en la mano.
    const dx = origin.left + origin.width / 2 - (dest.left + dest.width / 2);
    const dy = origin.top + origin.height / 2 - (dest.top + dest.height / 2);
    const scale = origin.width / dest.width;

    this.host.nativeElement.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.85 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ],
      {
        duration: CardFlightDirective.FLIGHT_MS,
        easing: CardFlightDirective.EASE_OUT,
        fill: 'both',
      },
    );
  }

  private playPop(): void {
    this.host.nativeElement.animate(
      [
        { transform: 'scale(0.85)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: CardFlightDirective.POP_MS, easing: CardFlightDirective.EASE_OUT, fill: 'both' },
    );
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
