import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal, type OnInit, type OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { deriveMatchView, type MatchView } from '../../utils/derive-match-view';
import { callDisplayMapper } from '../../utils/call-display-mapper';
import { GameBoardComponent } from '../../components/game-board/game-board.component';
import { GameWonDialogComponent, type GameWonDialogData } from '../../components/game-won-dialog/game-won-dialog.component';
import { EnvidoResultDialogComponent, type EnvidoResultDialogData } from '../../components/envido-result-dialog/envido-result-dialog.component';
import { MatchStateService } from '../../services/match-state.service';
import { MatchEventQueueService } from '../../services/match-event-queue.service';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import type { MatchEndedEvent, MatchWsEvent, GameWonPayload, EnvidoResolvedPayload } from '../../models/match-ws-events';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'app-match-screen',
  standalone: true,
  imports: [CommonModule, GameBoardComponent, MatProgressSpinnerModule],
  providers: [MatchStateService, MatchEventQueueService],
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
  readonly selfCallText = signal<string | null>(null);
  readonly opponentCallText = signal<string | null>(null);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  readonly matchStateService = inject(MatchStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly callDisplayTimers = new Map<string, number>();

  ngOnInit(): void {
    const matchId = this.route.snapshot.paramMap.get('matchId') ?? '';
    this.matchId.set(matchId);
    this.matchStateService.init(matchId);

    const endedSub = this.matchStateService.matchEnded$.subscribe((event) => {
      this.openResultDialog(event);
    });

    const gameWonSub = this.matchStateService.gameWon$.subscribe((event) => {
      this.openGameWonDialog(event);
    });

    const envidoSub = this.matchStateService.envidoResolved$.subscribe((event) => {
      this.openEnvidoResultDialog(event);
    });

    const eventSub = this.matchStateService.matchEvent$.subscribe((event) => {
      this.handleMatchEvent(event);
    });

    // Store subscriptions for cleanup
    this._endedSub = endedSub;
    this._gameWonSub = gameWonSub;
    this._envidoSub = envidoSub;
    this._eventSub = eventSub;

    this.destroyRef.onDestroy(() => {
      this.clearAllCallDisplayTimers();
    });
  }

  ngOnDestroy(): void {
    this._endedSub?.unsubscribe();
    this._gameWonSub?.unsubscribe();
    this._envidoSub?.unsubscribe();
    this._eventSub?.unsubscribe();
    this.clearAllCallDisplayTimers();
    this.matchStateService.destroy();
  }

  private handleMatchEvent(event: MatchWsEvent): void {
    // Reset call texts on round/game/match end events
    if (
      event.eventType === 'ROUND_STARTED' ||
      event.eventType === 'GAME_STARTED' ||
      event.eventType === 'MATCH_FINISHED' ||
      event.eventType === 'MATCH_ABANDONED' ||
      event.eventType === 'MATCH_FORFEITED'
    ) {
      this.selfCallText.set(null);
      this.opponentCallText.set(null);
      this.clearAllCallDisplayTimers();
      return;
    }

    // Handle ENVIDO_RESOLVED: infer responder seat from winnerSeat
    if (event.eventType === 'ENVIDO_RESOLVED') {
      const payload = event.payload as { response: string; winnerSeat: 'PLAYER_ONE' | 'PLAYER_TWO' };
      const textMap: Record<string, string> = {
        QUIERO: '\u00a1Quiero!',
        NO_QUIERO: '\u00a1No quiero!',
      };
      const text = textMap[payload.response];
      if (!text) {return;}

      const state = this.matchStateService.state();
      if (!state) {return;}

      // Solo puede haber un call text visible a la vez: limpiar ambos antes
      this.selfCallText.set(null);
      this.opponentCallText.set(null);
      this.clearAllCallDisplayTimers();

      if (payload.response === 'NO_QUIERO') {
        const noQuieroSeat: 'PLAYER_ONE' | 'PLAYER_TWO' =
          payload.winnerSeat === 'PLAYER_ONE' ? 'PLAYER_TWO' : 'PLAYER_ONE';
        const isSelf = noQuieroSeat === state.viewerSeat;
        const signalRef = isSelf ? this.selfCallText : this.opponentCallText;
        signalRef.set(text);
        // No auto-cleanup for NO_QUIERO
      } else {
        // QUIERO: the acceptor is the winnerSeat (they accepted and will reveal/envido continues)
        const isSelf = payload.winnerSeat === state.viewerSeat;
        const signalRef = isSelf ? this.selfCallText : this.opponentCallText;
        signalRef.set(text);

        const timeoutId = window.setTimeout(() => {
          signalRef.set(null);
        }, 3000);
        this.callDisplayTimers.set('call', timeoutId);
      }
      return;
    }

    const displayEvent = callDisplayMapper(event);
    if (!displayEvent) {return;}

    const state = this.matchStateService.state();
    if (!state) {return;}

    // Solo puede haber un call text visible a la vez: limpiar ambos antes
    this.selfCallText.set(null);
    this.opponentCallText.set(null);
    this.clearAllCallDisplayTimers();

    const isSelf = displayEvent.seat === state.viewerSeat;
    const signalRef = isSelf ? this.selfCallText : this.opponentCallText;

    signalRef.set(displayEvent.text);

    // Auto-clear acceptance texts after 3 seconds
    if (displayEvent.isAcceptance) {
      const timeoutId = window.setTimeout(() => {
        signalRef.set(null);
      }, 3000);
      this.callDisplayTimers.set('call', timeoutId);
    }
  }

  private clearAllCallDisplayTimers(): void {
    for (const timeoutId of this.callDisplayTimers.values()) {
      clearTimeout(timeoutId);
    }
    this.callDisplayTimers.clear();
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

    const data: GameWonDialogData = this.mapMatchEndedToDialogData(event, state);

    const dialogRef = this.dialog.open<GameWonDialogComponent, GameWonDialogData, void>(
      GameWonDialogComponent,
      {
        data,
        panelClass: 't3-game-won-dialog',
        backdropClass: 't3-game-won-backdrop',
        disableClose: true,
      }
    );

    dialogRef.afterClosed().subscribe(() => {
      this.router.navigate(['/']);
    });
  }

  private openGameWonDialog(event: GameWonPayload): void {
    const state = this.matchStateService.state();
    if (!state) {return;}

    const viewerSeat = state.viewerSeat;
    const isPlayerOne = viewerSeat === 'PLAYER_ONE';

    const playerName = isPlayerOne ? state.playerOneUsername : state.playerTwoUsername;
    const opponentName = isPlayerOne ? state.playerTwoUsername : state.playerOneUsername;
    const playerGamesWon = isPlayerOne ? state.gamesWonPlayerOne : state.gamesWonPlayerTwo;
    const opponentGamesWon = isPlayerOne ? state.gamesWonPlayerTwo : state.gamesWonPlayerOne;

    const data: GameWonDialogData = {
      playerName,
      opponentName,
      playerGamesWon,
      opponentGamesWon,
      gamesToPlay: state.gamesToPlay,
      gameNumber: state.gamesWonPlayerOne + state.gamesWonPlayerTwo,
      matchFinished: false,
      localWonMatch: event.winnerSeat === viewerSeat,
    };

    this.dialog.open<GameWonDialogComponent, GameWonDialogData, void>(
      GameWonDialogComponent,
      {
        data,
        panelClass: 't3-game-won-dialog',
        backdropClass: 't3-game-won-backdrop',
        disableClose: false,
      }
    );
  }

  private openEnvidoResultDialog(payload: EnvidoResolvedPayload): void {
    // No mostrar modal cuando el envido fue rechazado
    if (payload.response === 'NO_QUIERO') {
      return;
    }

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

  private mapMatchEndedToDialogData(event: MatchEndedEvent, state: ReturnType<typeof this.matchStateService.state>): GameWonDialogData {
    if (!state) {
      throw new Error('State is null when mapping match ended data');
    }

    const viewerSeat = state.viewerSeat;
    const isPlayerOne = viewerSeat === 'PLAYER_ONE';

    const playerName = isPlayerOne ? state.playerOneUsername : state.playerTwoUsername;
    const opponentName = isPlayerOne ? state.playerTwoUsername : state.playerOneUsername;
    const playerGamesWon = isPlayerOne ? event.gamesWonPlayerOne : event.gamesWonPlayerTwo;
    const opponentGamesWon = isPlayerOne ? event.gamesWonPlayerTwo : event.gamesWonPlayerOne;

    return {
      playerName,
      opponentName,
      playerGamesWon,
      opponentGamesWon,
      gamesToPlay: state.gamesToPlay,
      gameNumber: event.gamesWonPlayerOne + event.gamesWonPlayerTwo,
      matchFinished: true,
      localWonMatch: event.winnerSeat === viewerSeat,
    };
  }

  private _endedSub?: Subscription;
  private _gameWonSub?: Subscription;
  private _envidoSub?: Subscription;
  private _eventSub?: Subscription;
}
