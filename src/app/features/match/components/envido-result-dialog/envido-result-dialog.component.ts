import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

export interface EnvidoResultDialogData {
  /** Nombre del jugador mano (quien empieza cantando). Siempre tiene puntaje. */
  manoName: string;
  /** Puntaje del mano. `null` o `undefined` muestra "Son buenas". */
  manoScore: number | null | undefined;
  /** Nombre del jugador pie (rival). */
  pieName: string;
  /** Puntaje del pie. `null` o `undefined` muestra "Son buenas". */
  pieScore: number | null | undefined;
  /** `true` si el jugador local ganó el envido. */
  won: boolean;
  /** Modo espectador: oculta el resultado personal ("¡Ganaste!"/"Perdiste..."). */
  spectatorMode?: boolean;
}

@Component({
  selector: 'app-envido-result-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './envido-result-dialog.component.html',
  styleUrl: './envido-result-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnvidoResultDialogComponent {
  readonly data = inject<EnvidoResultDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EnvidoResultDialogComponent, void>);

  get manoScoreDisplay(): string {
    return this.data.manoScore !== null && this.data.manoScore !== undefined
      ? String(this.data.manoScore)
      : '"Son buenas"';
  }

  get pieScoreDisplay(): string {
    return this.data.pieScore !== null && this.data.pieScore !== undefined
      ? String(this.data.pieScore)
      : '"Son buenas"';
  }

  close(): void {
    this.dialogRef.close();
  }
}
