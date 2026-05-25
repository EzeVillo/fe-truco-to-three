import { Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

/**
 * Wrapper delgado que abre `ConfirmDialogComponent` con la configuración
 * de cierre de sesión. Mantiene la API de apertura existente en el header
 * (MatDialog.open<ConfirmLogoutDialogComponent>) sin modificar ese call site.
 */
@Component({
  selector: 'app-confirm-logout-dialog',
  standalone: true,
  template: '',
})
export class ConfirmLogoutDialogComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<ConfirmLogoutDialogComponent, boolean>);

  ngOnInit(): void {
    const ref = this.dialog.open<ConfirmDialogComponent, unknown, boolean>(ConfirmDialogComponent, {
      data: {
        title: '¿Cerrar sesión?',
        variant: 'destructive',
        confirmLabel: 'Salir',
        cancelLabel: 'Cancelar',
      },
      panelClass: 't3-confirm-dialog',
      backdropClass: 't3-confirm-backdrop',
      autoFocus: 'button',
      restoreFocus: true,
    });

    ref.afterClosed().subscribe((result) => {
      this.dialogRef.close(result === true);
    });
  }

  /** @deprecated Usados únicamente por los tests existentes para compatibilidad. */
  cancel(): void {
    this.dialogRef.close(false);
  }

  /** @deprecated Usados únicamente por los tests existentes para compatibilidad. */
  confirm(): void {
    this.dialogRef.close(true);
  }
}
