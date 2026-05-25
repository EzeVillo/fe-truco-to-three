import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ConfirmLogoutDialogComponent } from './confirm-logout-dialog.component';

describe('ConfirmLogoutDialogComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dialogRefMock = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ConfirmLogoutDialogComponent],
      providers: [provideAnimationsAsync(), { provide: MatDialogRef, useValue: dialogRefMock }],
    });
  });

  it('renderiza el título "¿Cerrar sesión?"', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('¿Cerrar sesión?');
  });

  it('Cancelar cierra el dialog con false', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.cancel();
    expect(dialogRefMock.close).toHaveBeenCalledWith(false);
  });

  it('Salir cierra el dialog con true', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.confirm();
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });
});
