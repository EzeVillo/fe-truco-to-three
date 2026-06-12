import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

/**
 * Datos del modal de puntos de campaña. Todos los valores llegan del backend en el
 * push `CAMPAIGN_MATCH_POINTS`: el front nunca calcula los puntos ni la posición.
 */
export interface CampaignPointsDialogData {
  /** `true` si el jugador ganó el match. */
  won: boolean;
  /** Puntos acreditados por este match (0 en derrota). */
  pointsAwarded: number;
  /** Total acumulado del jugador tras el match. */
  totalPoints: number;
  /** Posición en el ranking antes del match. */
  previousPosition: number;
  /** Posición en el ranking después del match. */
  newPosition: number;
}

@Component({
  selector: 'app-campaign-points-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './campaign-points-dialog.component.html',
  styleUrl: './campaign-points-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignPointsDialogComponent {
  readonly data = inject<CampaignPointsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<CampaignPointsDialogComponent, void>>(MatDialogRef);

  /** `true` si el jugador escaló posiciones en el ranking. */
  get climbed(): boolean {
    return this.data.newPosition < this.data.previousPosition;
  }

  /** Texto principal del modal según el resultado. */
  get titleText(): string {
    return this.data.won ? '¡Puntos ganados!' : 'Sin puntos esta vez';
  }

  /** Texto del movimiento de posición en el ranking. */
  get positionText(): string {
    if (this.climbed) {
      return `Subiste del puesto #${this.data.previousPosition} al #${this.data.newPosition}`;
    }
    return `Seguís en el puesto #${this.data.newPosition}`;
  }

  /** Texto de contexto secundario según el resultado. */
  get contextMessage(): string {
    return this.data.won ? '¡Seguí escalando el ranking!' : 'La derrota no descuenta puntos.';
  }

  close(): void {
    this.dialogRef.close();
  }
}
