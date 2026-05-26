import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

export interface RoundWonDialogData {
  /** Nombre del jugador local. */
  playerName: string;
  /** Nombre del rival. */
  opponentName: string;
  /** Rondas ganadas por el jugador local. */
  playerRoundsWon: number;
  /** Rondas ganadas por el rival. */
  opponentRoundsWon: number;
  /** Total de rondas de la serie (1, 3 o 5). */
  roundsToPlay: 1 | 3 | 5;
  /** Número de la ronda que acaba de terminar. */
  roundNumber: number;
  /** `true` si la serie ya terminó con esta ronda. */
  matchFinished: boolean;
  /** `true` si el jugador local ganó la serie (solo relevante si matchFinished). */
  localWonMatch: boolean;
}

@Component({
  selector: 'app-round-won-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './round-won-dialog.component.html',
  styleUrl: './round-won-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundWonDialogComponent {
  readonly data = inject<RoundWonDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RoundWonDialogComponent, void>>(MatDialogRef);

  /** `true` si el jugador local ganó la serie (ya sea en esta ronda o previamente). */
  get isMatchWon(): boolean {
    return this.data.matchFinished && this.data.localWonMatch;
  }

  /** `true` si el jugador local perdió la serie. */
  get isMatchLost(): boolean {
    return this.data.matchFinished && !this.data.localWonMatch;
  }

  /** `true` si solo ganó la ronda pero la serie sigue. */
  get isRoundOnly(): boolean {
    return !this.data.matchFinished;
  }

  /** Texto principal del modal según el estado. */
  get titleText(): string {
    if (this.isMatchWon) {
      return '¡Serie ganada!';
    }
    if (this.isMatchLost) {
      return 'Serie perdida';
    }
    return '¡Ronda ganada!';
  }

  /** Subtítulo de victoria/derrota. */
  get statusText(): string {
    if (this.isMatchWon) {
      return '¡Ganaste la partida!';
    }
    if (this.isMatchLost) {
      return 'Perdiste la partida...';
    }
    return `¡Ganaste la ronda ${this.data.roundNumber}!`;
  }

  /** Texto de contexto según el estado de la serie. */
  get contextMessage(): string {
    if (this.isMatchWon) {
      return '¡Felicitaciones!';
    }
    if (this.isMatchLost) {
      return '¡La próxima será!';
    }
    if (this.data.playerRoundsWon === this.data.opponentRoundsWon) {
      return 'Serie empatada';
    }
    if (this.data.playerRoundsWon > this.data.opponentRoundsWon) {
      return 'Vas arriba en la serie';
    }
    return 'Seguís en carrera';
  }

  close(): void {
    this.dialogRef.close();
  }
}
