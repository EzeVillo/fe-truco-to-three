import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ToastCenterComponent } from './toast-center.component';
import type { ToastVM } from './toast.model';

function render(toast: ToastVM | null, pendingCount = 0) {
  const fixture = TestBed.createComponent(ToastCenterComponent);
  fixture.componentRef.setInput('toast', toast);
  fixture.componentRef.setInput('pendingCount', pendingCount);
  fixture.detectChanges();
  return fixture;
}

describe('ToastCenterComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ imports: [ToastCenterComponent] });
  });

  it('no renderiza nada sin toast', () => {
    const el = render(null).nativeElement as HTMLElement;
    expect(el.querySelector('.toast-center')).toBeNull();
  });

  it('muestra título, cuerpo y acciones', () => {
    const run = vi.fn();
    const fixture = render({
      key: 'k',
      title: 'Logro',
      body: 'Descripción',
      actions: [{ label: 'Cerrar', variant: 'neutral', run }],
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Logro');
    expect(root.textContent).toContain('Descripción');

    fixture.debugElement
      .query(By.css('.toast-center__btn'))
      .nativeElement.dispatchEvent(new MouseEvent('click'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('aplica variantes primary/danger a los botones', () => {
    const fixture = render({
      key: 'k',
      title: 'Invitación',
      body: 'Jugá',
      actions: [
        { label: 'Aceptar', variant: 'primary', run: vi.fn() },
        { label: 'Rechazar', variant: 'danger', run: vi.fn() },
      ],
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.toast-center__btn--primary')).not.toBeNull();
    expect(root.querySelector('.toast-center__btn--danger')).not.toBeNull();
  });

  it('muestra "×" solo cuando hay onClose y la invoca', () => {
    const onClose = vi.fn();
    const fixture = render({
      key: 'k',
      title: 'Solicitud',
      body: 'Te agregó',
      actions: [{ label: 'Aceptar', variant: 'primary', run: vi.fn() }],
      onClose,
    });
    const closeBtn = fixture.debugElement.query(By.css('.toast-center__close'));
    expect(closeBtn).not.toBeNull();
    closeBtn.nativeElement.dispatchEvent(new MouseEvent('click'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('no muestra "×" cuando no hay onClose', () => {
    const fixture = render({
      key: 'k',
      title: 'Invitación',
      body: 'Jugá',
      actions: [{ label: 'Aceptar', variant: 'primary', run: vi.fn() }],
    });
    expect(fixture.debugElement.query(By.css('.toast-center__close'))).toBeNull();
  });

  it('muestra el contador "+N" y la clase apilada cuando hay pendientes', () => {
    const fixture = render(
      {
        key: 'k',
        title: 'A',
        body: 'b',
        actions: [{ label: 'Cerrar', variant: 'neutral', run: vi.fn() }],
      },
      2,
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.toast-center--stacked')).not.toBeNull();
    expect(root.querySelector('.toast-center__count')?.textContent).toContain('+2');
  });
});
