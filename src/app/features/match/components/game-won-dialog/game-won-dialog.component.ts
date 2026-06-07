import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

export interface GameWonDialogData {
  /** Nombre del jugador local (o PLAYER_ONE en modo espectador). */
  playerName: string;
  /** Nombre del rival (o PLAYER_TWO en modo espectador). */
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
  /** `true` si el jugador local (o PLAYER_ONE) ganó. */
  localWonMatch: boolean;
  /** Modo espectador: texto y colores neutros, sin "ganaste/perdiste". */
  spectatorMode?: boolean;
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

  /** `true` si ganó la partida individual pero la serie sigue. */
  get isGameOnlyWon(): boolean {
    return !this.data.matchFinished && this.data.localWonMatch;
  }

  /** `true` si perdió la partida individual pero la serie sigue. */
  get isGameOnlyLost(): boolean {
    return !this.data.matchFinished && !this.data.localWonMatch;
  }

  /** Nombre del ganador (playerName si localWonMatch, opponentName si no). */
  get winnerName(): string {
    return this.data.localWonMatch ? this.data.playerName : this.data.opponentName;
  }

  /** Texto principal del modal según el estado. */
  get titleText(): string {
    if (this.data.spectatorMode) {
      return this.data.matchFinished
        ? `Ganó ${this.winnerName}`
        : `Game para ${this.winnerName}`;
    }
    if (this.isMatchWon) {
      return '¡Ganaste el match!';
    }
    if (this.isMatchLost) {
      return '¡Perdiste el match!';
    }
    if (this.isGameOnlyWon) {
      return '¡Game ganado!';
    }
    return 'Game perdido';
  }

  /** Texto de contexto según el estado de la serie, o `null` si no corresponde. */
  get contextMessage(): string | null {
    if (this.data.spectatorMode) {
      return null;
    }
    if (this.isMatchWon) {
      return '¡Felicitaciones!';
    }
    if (this.isMatchLost) {
      return '¡La próxima será!';
    }
    return null;
  }

  close(): void {
    this.dialogRef.close();
  }
}
