import { Directive, ElementRef, HostListener, inject, output, signal } from '@angular/core';
import { UiClickSoundService } from '../../core/services/ui-click-sound.service';

/**
 * Reemplaza a `(click)` para acciones del juego en mobile.
 *
 * Un `<button>` nativo en táctil dispara el `click` según dónde *empezó* el toque:
 * si el dedo cae sobre el botón, levantarlo lejos igual ejecuta la acción. Dentro
 * de un match eso provoca acciones no deseadas (jugar una carta, cantar truco) al
 * tocar, arrastrar afuera y soltar.
 *
 * Esta directiva sólo emite `tap` si el puntero se *suelta dentro* de los límites
 * del elemento. Usa Pointer Events + `setPointerCapture` para seguir el dedo aunque
 * salga del botón, y desarma en `pointercancel`. La activación por teclado
 * (Enter/Espacio, que dispara un `click` sintético con `detail === 0`) se preserva.
 */
@Directive({
  selector: '[appTapAction]',
  standalone: true,
})
export class TapActionDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly clickSound = inject(UiClickSoundService);

  /** Se emite sólo cuando el puntero se suelta dentro del elemento (o por teclado). */
  readonly tap = output<Event>();

  private readonly armed = signal(false);
  private activePointerId: number | null = null;

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    // Para mouse, sólo el botón primario; touch/pen siempre arman.
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    this.armed.set(true);
    this.activePointerId = event.pointerId;
    try {
      // Capturar el puntero permite seguir el dedo aunque salga del botón.
      this.host.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      // setPointerCapture puede fallar si el puntero ya no es válido; ignorar.
    }
  }

  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (!this.armed() || event.pointerId !== this.activePointerId) {
      return;
    }
    this.disarm(event.pointerId);
    if (this.isWithinBounds(event)) {
      this.emitTap(event);
    }
  }

  @HostListener('pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    this.disarm(event.pointerId);
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    // El click táctil/mouse ya se resuelve por pointerup; sólo dejamos pasar la
    // activación por teclado (Enter/Espacio), que llega con detail === 0.
    if (event.detail === 0) {
      this.emitTap(event);
    }
  }

  /**
   * Único punto de emisión: reproduce el SFX de click (el listener global lo
   * ignora para los botones `appTapAction`, ver UiClickSoundService) y emite el
   * `tap`. Así el sonido acompaña a la acción ejecutada y no al `click` nativo,
   * que en táctil con pointer capture es inconsistente.
   */
  private emitTap(event: Event): void {
    this.clickSound.play();
    this.tap.emit(event);
  }

  private isWithinBounds(event: PointerEvent): boolean {
    const rect = this.host.nativeElement.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  private disarm(pointerId: number): void {
    this.armed.set(false);
    this.activePointerId = null;
    if (this.host.nativeElement.hasPointerCapture?.(pointerId)) {
      this.host.nativeElement.releasePointerCapture(pointerId);
    }
  }
}
