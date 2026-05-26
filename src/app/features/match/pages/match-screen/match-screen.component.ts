import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit, type OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { deriveMatchView, type MatchView } from '../../utils/derive-match-view';
import { GameBoardComponent } from '../../components/game-board/game-board.component';
import { RoundWonDialogComponent, type RoundWonDialogData } from '../../components/round-won-dialog/round-won-dialog.component';
import { EnvidoResultDialogComponent, type EnvidoResultDialogData } from '../../components/envido-result-dialog/envido-result-dialog.component';
import { MatchStateService } from '../../services/match-state.service';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import type { MatchEndedEvent, RoundEndedPayload, EnvidoResolvedPayload } from '../../models/match-ws-events';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'app-match-screen',
  standalone: true,
  imports: [CommonModule, GameBoardComponent, MatProgressSpinnerModule],
  providers: [MatchStateService],
  templateUrl: './match-screen.component.html',
  styleUrl: './match-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class MatchScreenComponent implements OnInit, OnDestroy {
  readonly matchId = signal<string>('');
  readonly matchView = computed<MatchView | null>(() => {
    const state = this.matchStateService.state();
    return state ? deriveMatchView(state) : null;
  });
  readonly errorMessage = computed(() => {
    if (!this.matchStateService.error()) {return '';}
    return getErrorCopy('MATCH_LOAD', null);
  });

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  readonly matchStateService = inject(MatchStateService);

  ngOnInit(): void {
    const matchId = this.route.snapshot.paramMap.get('matchId') ?? '';
    this.matchId.set(matchId);
    this.matchStateService.init(matchId);

    const endedSub = this.matchStateService.matchEnded$.subscribe((event) => {
      this.openResultDialog(event);
    });

    const roundSub = this.matchStateService.roundEnded$.subscribe((event) => {
      this.openRoundResultDialog(event);
    });

    const envidoSub = this.matchStateService.envidoResolved$.subscribe((event) => {
      this.openEnvidoResultDialog(event);
    });

    // Store subscriptions for cleanup
    this._endedSub = endedSub;
    this._roundSub = roundSub;
    this._envidoSub = envidoSub;
  }

  ngOnDestroy(): void {
    this._endedSub?.unsubscribe();
    this._roundSub?.unsubscribe();
    this._envidoSub?.unsubscribe();
    this.matchStateService.destroy();
  }

  retry(): void {
    const id = this.matchId();
    if (id) {
      this.matchStateService.init(id);
    }
  }

  goToLobby(): void {
    this.router.navigate(['/']);
  }

  private openResultDialog(event: MatchEndedEvent): void {
    const state = this.matchStateService.state();
    if (!state) {return;}

    const data: RoundWonDialogData = this.mapMatchEndedToDialogData(event, state);

    const dialogRef = this.dialog.open<RoundWonDialogComponent, RoundWonDialogData, void>(
      RoundWonDialogComponent,
      {
        data,
        panelClass: 't3-round-won-dialog',
        backdropClass: 't3-round-won-backdrop',
        disableClose: true,
      }
    );

    dialogRef.afterClosed().subscribe(() => {
      this.router.navigate(['/']);
    });
  }

  private openRoundResultDialog(event: RoundEndedPayload): void {
    const state = this.matchStateService.state();
    if (!state) {return;}

    const viewerSeat = state.viewerSeat;
    const isPlayerOne = viewerSeat === 'PLAYER_ONE';

    const playerName = isPlayerOne ? state.playerOneUsername : state.playerTwoUsername;
    const opponentName = isPlayerOne ? state.playerTwoUsername : state.playerOneUsername;
    const playerRoundsWon = isPlayerOne ? state.gamesWonPlayerOne : state.gamesWonPlayerTwo;
    const opponentRoundsWon = isPlayerOne ? state.gamesWonPlayerTwo : state.gamesWonPlayerOne;

    const data: RoundWonDialogData = {
      playerName,
      opponentName,
      playerRoundsWon,
      opponentRoundsWon,
      roundsToPlay: state.gamesToPlay,
      roundNumber: state.gamesWonPlayerOne + state.gamesWonPlayerTwo + 1,
      matchFinished: false,
      localWonMatch: event.winnerSeat === viewerSeat,
    };

    this.dialog.open<RoundWonDialogComponent, RoundWonDialogData, void>(
      RoundWonDialogComponent,
      {
        data,
        panelClass: 't3-round-won-dialog',
        backdropClass: 't3-round-won-backdrop',
        disableClose: false,
      }
    );
  }

  private openEnvidoResultDialog(payload: EnvidoResolvedPayload): void {
    const state = this.matchStateService.state();
    if (!state || !state.roundGame) {return;}

    const manoUsername = state.roundGame.currentHand.mano;
    const isManoPlayerOne = state.playerOneUsername === manoUsername;
    const pieUsername = isManoPlayerOne ? state.playerTwoUsername : state.playerOneUsername;
    const viewerSeat = state.viewerSeat;

    const data: EnvidoResultDialogData = {
      manoName: manoUsername,
      manoScore: payload.pointsMano ?? null,
      pieName: pieUsername,
      pieScore: payload.pointsPie ?? null,
      won: payload.winnerSeat === viewerSeat,
    };

    this.dialog.open<EnvidoResultDialogComponent, EnvidoResultDialogData, void>(
      EnvidoResultDialogComponent,
      {
        data,
        panelClass: 't3-envido-result-dialog',
        backdropClass: 't3-envido-result-backdrop',
        disableClose: false,
      }
    );
  }

  private mapMatchEndedToDialogData(event: MatchEndedEvent, state: ReturnType<typeof this.matchStateService.state>): RoundWonDialogData {
    if (!state) {
      throw new Error('State is null when mapping match ended data');
    }

    const viewerSeat = state.viewerSeat;
    const isPlayerOne = viewerSeat === 'PLAYER_ONE';

    const playerName = isPlayerOne ? state.playerOneUsername : state.playerTwoUsername;
    const opponentName = isPlayerOne ? state.playerTwoUsername : state.playerOneUsername;
    const playerRoundsWon = isPlayerOne ? event.gamesWonPlayerOne : event.gamesWonPlayerTwo;
    const opponentRoundsWon = isPlayerOne ? event.gamesWonPlayerTwo : event.gamesWonPlayerOne;

    return {
      playerName,
      opponentName,
      playerRoundsWon,
      opponentRoundsWon,
      roundsToPlay: state.gamesToPlay,
      roundNumber: event.gamesWonPlayerOne + event.gamesWonPlayerTwo,
      matchFinished: true,
      localWonMatch: event.winnerSeat === viewerSeat,
    };
  }

  private _endedSub?: Subscription;
  private _roundSub?: Subscription;
  private _envidoSub?: Subscription;
}
