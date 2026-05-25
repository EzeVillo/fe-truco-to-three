import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { throwError } from 'rxjs';

export interface ConfirmDialogData {
  /** Título visible (h2). Obligatorio. */
  title: string;

  /** Mensaje descriptivo opcional (p). */
  message?: string;

  /** Texto del botón de confirmación. Default: 'Confirmar'. */
  confirmLabel?: string;

  /** Texto del botón de cancelación. Default: 'Cancelar'. */
  cancelLabel?: string;

  /**
   * Variante visual de la acción de confirmación.
   * - 'destructive': estilo rojo (t3-btn--destructive).
   * - 'primary': estilo dorado (t3-btn--primary). Default.
   */
  variant?: 'destructive' | 'primary';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent, boolean>);

  readonly variant: 'destructive' | 'primary';
  readonly confirmLabel: string;
  readonly cancelLabel: string;

  constructor() {
    if (!this.data?.title?.trim()) {
      throwError(() => new Error('[ConfirmDialogComponent] El campo "title" es obligatorio y no puede estar vacío.'));
      // fallback defensivo para evitar render roto en producción
    }
    this.variant = this.data?.variant ?? 'primary';
    this.confirmLabel = this.data?.confirmLabel ?? 'Confirmar';
    this.cancelLabel = this.data?.cancelLabel ?? 'Cancelar';
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
