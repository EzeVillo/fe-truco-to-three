import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import type { ConfirmDialogData } from './confirm-dialog.component';

function setup(data: ConfirmDialogData) {
  const dialogRefMock = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [ConfirmDialogComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefMock },
    ],
  });

  return { dialogRefMock };
}

describe('ConfirmDialogComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza el título recibido por MAT_DIALOG_DATA', () => {
    setup({ title: '¿Estás seguro?' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const h2 = fixture.debugElement.query(By.css('#confirm-dialog-title'));
    expect(h2.nativeElement.textContent.trim()).toBe('¿Estás seguro?');
  });

  it('renderiza el mensaje opcional cuando se provee', () => {
    setup({ title: 'Confirmar', message: 'Esta acción no se puede deshacer.' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const p = fixture.debugElement.query(By.css('#confirm-dialog-desc'));
    expect(p).toBeTruthy();
    expect(p.nativeElement.textContent.trim()).toBe('Esta acción no se puede deshacer.');
  });

  it('no renderiza elemento de mensaje cuando message es undefined', () => {
    setup({ title: 'Confirmar' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const p = fixture.debugElement.query(By.css('#confirm-dialog-desc'));
    expect(p).toBeNull();
  });

  it('variante destructive aplica role="alertdialog"', () => {
    setup({ title: '¿Salir?', variant: 'destructive' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const container = fixture.debugElement.query(By.css('.t3-confirm'));
    expect(container.nativeElement.getAttribute('role')).toBe('alertdialog');
  });

  it('variante primary aplica role="dialog"', () => {
    setup({ title: 'Confirmar', variant: 'primary' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const container = fixture.debugElement.query(By.css('.t3-confirm'));
    expect(container.nativeElement.getAttribute('role')).toBe('dialog');
  });

  it('variante por defecto (sin especificar) aplica role="dialog"', () => {
    setup({ title: 'Confirmar' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const container = fixture.debugElement.query(By.css('.t3-confirm'));
    expect(container.nativeElement.getAttribute('role')).toBe('dialog');
  });

  it('click en botón de confirmación emite true', () => {
    const { dialogRefMock } = setup({ title: 'Confirmar' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    fixture.componentInstance.confirm();
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });

  it('click en botón de cancelación emite false', () => {
    const { dialogRefMock } = setup({ title: 'Confirmar' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();
    expect(dialogRefMock.close).toHaveBeenCalledWith(false);
  });

  it('usa los labels personalizados de confirmLabel y cancelLabel', () => {
    setup({ title: '¿Salir?', confirmLabel: 'Salir', cancelLabel: 'Seguir jugando' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('.t3-btn'));
    const texts = buttons.map((b) => (b.nativeElement as HTMLElement).textContent?.trim());
    expect(texts).toContain('Seguir jugando');
    expect(texts).toContain('Salir');
  });

  it('usa labels por defecto cuando no se proveen', () => {
    setup({ title: 'Confirmar acción' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.confirmLabel).toBe('Confirmar');
    expect(fixture.componentInstance.cancelLabel).toBe('Cancelar');
  });

  it('variante destructive: el botón de confirmación tiene clase t3-btn--destructive', () => {
    setup({ title: '¿Salir?', variant: 'destructive', confirmLabel: 'Salir' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const confirmBtn = fixture.debugElement.query(By.css('.t3-btn--destructive'));
    expect(confirmBtn).toBeTruthy();
    expect((confirmBtn.nativeElement as HTMLElement).textContent?.trim()).toBe('Salir');
  });

  it('variante primary: el botón de confirmación tiene clase t3-btn--primary', () => {
    setup({ title: 'Guardar', variant: 'primary', confirmLabel: 'Guardar' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const confirmBtn = fixture.debugElement.query(By.css('.t3-btn--primary'));
    expect(confirmBtn).toBeTruthy();
  });

  it('el botón de cancelación siempre tiene clase t3-btn--neutral', () => {
    setup({ title: 'Confirmar', variant: 'destructive' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const cancelBtn = fixture.debugElement.query(By.css('.t3-btn--neutral'));
    expect(cancelBtn).toBeTruthy();
  });

  it('aria-modal está presente en el contenedor', () => {
    setup({ title: 'Confirmar' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const container = fixture.debugElement.query(By.css('.t3-confirm'));
    expect(container.nativeElement.getAttribute('aria-modal')).toBe('true');
  });

  it('aria-labelledby apunta al id del título', () => {
    setup({ title: 'Confirmar' });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();

    const container = fixture.debugElement.query(By.css('.t3-confirm'));
    expect(container.nativeElement.getAttribute('aria-labelledby')).toBe('confirm-dialog-title');
  });
});
