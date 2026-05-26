import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

export interface GameWonDialogData {
  /** Nombre del jugador local. */
  playerName: string;
  /** Nombre del rival. */
  opponentName: string;
  /** Partidas ganadas por el jugador local en la serie. */
  playerGamesWon: number;
  /** Partidas ganadas por el rival en la serie. */
  opponentGamesWon: number;
  /** Total de partidas de la serie (1, 3 o 5). */
  gamesToPlay: 1 | 3 | 5;
  /** Número de la partida individual que acaba de terminar. */
  gameNumber: number;
  /** `true` si la serie ya terminó con esta partida. */
  matchFinished: boolean;
  /** `true` si el jugador local ganó la serie (solo relevante si matchFinished). */
  localWonMatch: boolean;
}

@Component({
  selector: 'app-game-won-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './game-won-dialog.component.html',
  styleUrl: './game-won-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameWonDialogComponent {
  readonly data = inject<GameWonDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<GameWonDialogComponent, void>>(MatDialogRef);

  /** `true` si el jugador local ganó la serie. */
  get isMatchWon(): boolean {
    return this.data.matchFinished && this.data.localWonMatch;
  }

  /** `true` si el jugador local perdió la serie. */
  get isMatchLost(): boolean {
    return this.data.matchFinished && !this.data.localWonMatch;
  }

  /** `true` si solo ganó la partida individual pero la serie sigue. */
  get isGameOnly(): boolean {
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
    return '¡Partida ganada!';
  }

  /** Subtítulo de victoria/derrota. */
  get statusText(): string {
    if (this.isMatchWon) {
      return '¡Ganaste la partida!';
    }
    if (this.isMatchLost) {
      return 'Perdiste la partida...';
    }
    return `¡Ganaste la partida ${this.data.gameNumber}!`;
  }

  /** Texto de contexto según el estado de la serie. */
  get contextMessage(): string {
    if (this.isMatchWon) {
      return '¡Felicitaciones!';
    }
    if (this.isMatchLost) {
      return '¡La próxima será!';
    }
    if (this.data.playerGamesWon === this.data.opponentGamesWon) {
      return 'Serie empatada';
    }
    if (this.data.playerGamesWon > this.data.opponentGamesWon) {
      return 'Vas arriba en la serie';
    }
    return 'Seguís en carrera';
  }

  close(): void {
    this.dialogRef.close();
  }
}
