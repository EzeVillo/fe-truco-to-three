import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ConfirmLogoutDialogComponent } from './confirm-logout-dialog.component';

describe('ConfirmLogoutDialogComponent — wrapper delgado', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };
  let innerDialogAfterClosed$: Subject<boolean | undefined>;
  let innerDialogRefMock: { afterClosed: ReturnType<typeof vi.fn> };
  let dialogOpenSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dialogRefMock = { close: vi.fn() };
    innerDialogAfterClosed$ = new Subject<boolean | undefined>();
    innerDialogRefMock = { afterClosed: vi.fn().mockReturnValue(innerDialogAfterClosed$.asObservable()) };
    dialogOpenSpy = vi.fn().mockReturnValue(innerDialogRefMock);

    TestBed.configureTestingModule({
      imports: [ConfirmLogoutDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MatDialog, useValue: { open: dialogOpenSpy } },
      ],
    });
  });

  it('abre ConfirmDialogComponent en ngOnInit con variante destructive y labels correctos', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();

    expect(dialogOpenSpy).toHaveBeenCalledOnce();

    const [, config] = dialogOpenSpy.mock.calls[0] as [unknown, { data: Record<string, unknown>; panelClass: string }];
    expect(config.data['variant']).toBe('destructive');
    expect(config.data['title']).toBe('¿Cerrar sesión?');
    expect(config.data['confirmLabel']).toBe('Salir');
    expect(config.data['cancelLabel']).toBe('Cancelar');
    expect(config.panelClass).toBe('t3-confirm-dialog');
  });

  it('propaga true al outer dialogRef cuando el inner dialog confirma', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();

    innerDialogAfterClosed$.next(true);

    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });

  it('propaga false al outer dialogRef cuando el inner dialog cancela (false)', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();

    innerDialogAfterClosed$.next(false);

    expect(dialogRefMock.close).toHaveBeenCalledWith(false);
  });

  it('propaga false al outer dialogRef cuando el inner dialog se cierra sin valor (undefined)', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();

    innerDialogAfterClosed$.next(undefined);

    expect(dialogRefMock.close).toHaveBeenCalledWith(false);
  });

  it('método cancel() cierra el outer dialog con false (compatibilidad)', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();
    expect(dialogRefMock.close).toHaveBeenCalledWith(false);
  });

  it('método confirm() cierra el outer dialog con true (compatibilidad)', () => {
    const fixture = TestBed.createComponent(ConfirmLogoutDialogComponent);
    fixture.detectChanges();

    fixture.componentInstance.confirm();
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });
});
