import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TapActionDirective } from './tap-action.directive';
import { UiClickSoundService } from '../../core/services/ui-click-sound.service';

@Component({
  standalone: true,
  imports: [TapActionDirective],
  template: `<button appTapAction (tap)="taps = taps + 1" type="button">Acción</button>`,
})
class HostComponent {
  taps = 0;
}

const BOUNDS = { left: 100, top: 100, right: 200, bottom: 150 } as DOMRect;

/**
 * jsdom no implementa PointerEvent: despachamos un Event genérico con las
 * propiedades que la directiva lee asignadas a mano.
 */
function pointer(type: string, props: Record<string, unknown>): Event {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerId: 1, pointerType: 'touch', button: 0, ...props });
  return event;
}

describe('TapActionDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let button: HTMLButtonElement;
  let play: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    play = vi.fn();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: UiClickSoundService, useValue: { play } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button');
    button.getBoundingClientRect = () => BOUNDS;
  });

  it('emite tap y suena el SFX cuando el puntero se suelta dentro del elemento', () => {
    button.dispatchEvent(pointer('pointerdown', { clientX: 150, clientY: 125 }));
    button.dispatchEvent(pointer('pointerup', { clientX: 150, clientY: 125 }));

    expect(fixture.componentInstance.taps).toBe(1);
    expect(play).toHaveBeenCalledOnce();
  });

  it('NO emite tap ni suena si el puntero se arrastra fuera y se suelta afuera', () => {
    button.dispatchEvent(pointer('pointerdown', { clientX: 150, clientY: 125 }));
    // Se suelta lejos de los límites del botón (arrastre fuera).
    button.dispatchEvent(pointer('pointerup', { clientX: 400, clientY: 400 }));

    expect(fixture.componentInstance.taps).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });

  it('NO emite tap si la secuencia se cancela (pointercancel)', () => {
    button.dispatchEvent(pointer('pointerdown', { clientX: 150, clientY: 125 }));
    button.dispatchEvent(pointer('pointercancel', { clientX: 150, clientY: 125 }));
    button.dispatchEvent(pointer('pointerup', { clientX: 150, clientY: 125 }));

    expect(fixture.componentInstance.taps).toBe(0);
  });

  it('preserva la activación por teclado (click sintético con detail 0)', () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

    expect(fixture.componentInstance.taps).toBe(1);
  });

  it('ignora el click táctil/mouse (detail > 0): ya se resolvió por pointerup', () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

    expect(fixture.componentInstance.taps).toBe(0);
  });

  it('NO emite tap ni suena si el botón está deshabilitado', () => {
    button.disabled = true;

    button.dispatchEvent(pointer('pointerdown', { clientX: 150, clientY: 125 }));
    button.dispatchEvent(pointer('pointerup', { clientX: 150, clientY: 125 }));

    expect(fixture.componentInstance.taps).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });

  it('NO emite tap ni suena por teclado si el botón está deshabilitado', () => {
    button.disabled = true;

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

    expect(fixture.componentInstance.taps).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });
});
