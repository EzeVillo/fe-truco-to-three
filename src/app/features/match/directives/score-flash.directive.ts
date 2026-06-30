import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Resalta un número cuando cambia: un pop de escala + destello de brillo. Pensado
 * para el marcador (suma de puntos). No anima en el primer valor (estado inicial al
 * entrar al match), solo en cambios posteriores.
 *
 * Usa `transform` + `filter: brightness` (compositables, sin tocar color) vía Web
 * Animations API.
 */
@Directive({
  selector: '[appScoreFlash]',
  standalone: true,
})
export class ScoreFlashDirective {
  private static readonly EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  private static readonly DURATION_MS = 360;

  readonly value = input.required<number>({ alias: 'appScoreFlash' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previous: number | null = null;

  constructor() {
    effect(() => {
      const current = this.value();
      const prev = this.previous;
      this.previous = current;
      // Primer valor (baseline) o sin cambio real: no animar.
      if (prev === null || prev === current) {
        return;
      }
      this.flash();
    });
  }

  private flash(): void {
    const el = this.host.nativeElement;
    if (typeof el.animate !== 'function') {
      return;
    }
    el.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(1.35)', filter: 'brightness(1.8)', offset: 0.4 },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: ScoreFlashDirective.DURATION_MS, easing: ScoreFlashDirective.EASE_OUT },
    );
  }
}
