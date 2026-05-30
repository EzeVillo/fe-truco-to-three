import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, ViewContainerRef, type OnInit, type OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { deriveMatchView, type MatchView } from '../../utils/derive-match-view';
import { computeElapsedFraction, computeRemainingMsFromSnapshot, isUrgent } from '../../utils/turn-timer';
import { callDisplayMapper } from '../../utils/call-display-mapper';
import { GameBoardComponent } from '../../components/game-board/game-board.component';
import { GameWonDialogComponent, type GameWonDialogData } from '../../components/game-won-dialog/game-won-dialog.component';
import { EnvidoResultDialogComponent, type EnvidoResultDialogData } from '../../components/envido-result-dialog/envido-result-dialog.component';
import { RematchDialogComponent, type RematchDialogResult } from '../../components/rematch-dialog/rematch-dialog.component';
import { MatchStateService } from '../../services/match-state.service';
import { MatchEventQueueService } from '../../services/match-event-queue.service';
import { RematchStateService } from '../../services/rematch-state.service';
import { RematchApiService } from '../../services/rematch-api.service';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import type { MatchEndedEvent, MatchWsEvent, GameWonPayload, EnvidoResolvedPayload } from '../../models/match-ws-events';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'app-match-screen',
  standalone: true,
  imports: [CommonModule, GameBoardComponent, MatProgressSpinnerModule],
  providers: [MatchStateService, MatchEventQueueService, RematchStateService],
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

  // ---- Temporizador de turno (feature 013-turn-timer) ----
  /** "Ahora" del cliente; se refresca mientras hay un plazo activo. */
  private readonly nowMs = signal<number>(Date.now());
  private static readonly TIMER_TICK_MS = 200;
  private timerIntervalId: number | null = null;

  /** Hay un plazo de turno consumible y la partida está en curso (FR-013). */
  readonly timerActive = computed(() => {
    const v = this.matchView();
    return (
      !!v &&
      v.status === 'IN_PROGRESS' &&
      v.actionDeadline !== null &&
      v.turnDurationMillis !== null &&
      v.turnDurationMillis > 0
    );
  });

  /** Restante en ms del plazo, corregido por el offset de reloj del servidor (FR-010). */
  readonly timerRemainingMs = computed(() => {
    const v = this.matchView();
    if (!v || v.actionDeadline === null || v.turnDurationMillis === null) {
      return 0;
    }
    return computeRemainingMsFromSnapshot(
      v.actionDeadline,
      this.matchStateService.serverClockOffsetMs(),
      this.nowMs(),
    );
  });

  /** Fracción restante [0, 1] para el anillo (1 = lleno, 0 = agotado). */
  readonly timerRemainingFraction = computed(() => {
    const total = this.matchView()?.turnDurationMillis ?? 0;
    return 1 - computeElapsedFraction(this.timerRemainingMs(), total);
  });

  /** Urgencia: quedan ≤ 5 s (FR-006). */
  readonly timerIsUrgent = computed(() => this.timerActive() && isUrgent(this.timerRemainingMs()));

  /** El plazo propio se agotó antes de la resolución del backend (FR-008). */
  readonly viewerActionTimedOut = computed(() => {
    const v = this.matchView();
    return (
      !!v &&
      v.status === 'IN_PROGRESS' &&
      v.deadlineIsSelf === true &&
      this.timerRemainingMs() <= 0
    );
  });

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  readonly matchStateService = inject(MatchStateService);
  readonly eventQueue = inject(MatchEventQueueService);
  private readonly rematchStateService = inject(RematchStateService);
  private readonly rematchApiService = inject(RematchApiService);
  private readonly vcr = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);
  private _rematchInited = false;
  private readonly callDisplayTimers = new Map<string, number>();
  private lastEnvidoCallerSeat: 'PLAYER_ONE' | 'PLAYER_TWO' | null = null;
  private envidoModalTimerId: number | null = null;

  /** Tiempo que el "¡Quiero!" del envido queda visible antes de abrir el modal de resultado. */
  private static readonly ENVIDO_RESULT_MODAL_DELAY_MS = 1200;

  constructor() {
    // Arranca/detiene el tick del temporizador según haya un plazo activo.
    // No depende de nowMs, así que no genera bucles de reactividad.
    effect(() => {
      if (this.timerActive()) {
        this.startTimerTick();
      } else {
        this.stopTimerTick();
      }
    });

    // Inicia RematchStateService la primera vez que el estado de la partida carga.
    // Se re-activa al navegar a una nueva partida (re-init via paramMap, D4).
    effect(() => {
      const state = this.matchStateService.state();
      const id = this.matchId();
      if (state && id && !this._rematchInited) {
        this._rematchInited = true;
        this.rematchStateService.init(id, state.viewerSeat);
      }
    });
  }

  private startTimerTick(): void {
    if (this.timerIntervalId !== null) {
      return;
    }
    this.nowMs.set(Date.now());
    this.timerIntervalId = window.setInterval(
      () => this.nowMs.set(Date.now()),
      MatchScreenComponent.TIMER_TICK_MS,
    );
  }

  private stopTimerTick(): void {
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  ngOnInit(): void {
    // Usar paramMap para detectar cambios de matchId al navegar a la revancha (D4).
    this._paramSub = this.route.paramMap.subscribe((params) => {
      const newId = params.get('matchId') ?? '';
      if (!newId || newId === this.matchId()) {return;}
      this.matchId.set(newId);
      this._rematchInited = false;
      this.rematchStateService.reset();
      this.matchStateService.init(newId);
    });

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
    this._paramSub?.unsubscribe();
    this._endedSub?.unsubscribe();
    this._gameWonSub?.unsubscribe();
    this._envidoSub?.unsubscribe();
    this._eventSub?.unsubscribe();
    this.clearAllCallDisplayTimers();
    this.stopTimerTick();
    this.dialog.closeAll();
    this.rematchStateService.reset();
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
      this.lastEnvidoCallerSeat = null;
      return;
    }

    if (event.eventType === 'ENVIDO_CALLED') {
      const payload = event.payload as { callerSeat: 'PLAYER_ONE' | 'PLAYER_TWO' };
      this.lastEnvidoCallerSeat = payload.callerSeat;
    }

    // Handle ENVIDO_RESOLVED: infer responder seat as opposite of last envido caller
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

      // El que responde (QUIERO / NO_QUIERO) es el rival del que cantó envido.
      // winnerSeat indica quién ganó los tantos, no quién respondió.
      const callerSeat = this.lastEnvidoCallerSeat;
      const responderSeat: 'PLAYER_ONE' | 'PLAYER_TWO' | null = callerSeat
        ? callerSeat === 'PLAYER_ONE'
          ? 'PLAYER_TWO'
          : 'PLAYER_ONE'
        : null;
      if (!responderSeat) {
        this.lastEnvidoCallerSeat = null;
        return;
      }

      const isSelf = responderSeat === state.viewerSeat;
      const signalRef = isSelf ? this.selfCallText : this.opponentCallText;
      signalRef.set(text);

      // Tanto QUIERO como NO_QUIERO del envido se auto-limpian a los 3 s.
      const timeoutId = window.setTimeout(() => {
        signalRef.set(null);
      }, 3000);
      this.callDisplayTimers.set('call', timeoutId);

      this.lastEnvidoCallerSeat = null;
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

    if (displayEvent.autoClear) {
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
    if (this.envidoModalTimerId !== null) {
      clearTimeout(this.envidoModalTimerId);
      this.envidoModalTimerId = null;
    }
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
      this.eventQueue.resumeAck();
      this.decideAfterResultDialog();
    });
  }

  private decideAfterResultDialog(): void {
    const session = this.rematchStateService.session();
    if (session) {
      this.openRematchDialog();
      return;
    }

    // Carrera: REMATCH_AVAILABLE pudo no haber llegado todavía — consulta puntual (D3).
    const matchId = this.matchId();
    const viewerSeat = this.matchStateService.state()?.viewerSeat;
    if (!matchId || !viewerSeat) {
      this.router.navigate(['/']);
      return;
    }

    this.rematchApiService.getSession(matchId).subscribe({
      next: (dto) => {
        // 200: inicializar sesión directamente desde el DTO y abrir el diálogo.
        this.rematchStateService.initFromDto(dto, viewerSeat);
        this.openRematchDialog();
      },
      error: () => {
        // 404 o error: sin sesión de revancha → lobby.
        this.router.navigate(['/']);
      },
    });
  }

  private openRematchDialog(): void {
    const dialogRef = this.dialog.open<RematchDialogComponent, void, RematchDialogResult>(
      RematchDialogComponent,
      {
        viewContainerRef: this.vcr,
        panelClass: 't3-rematch-dialog',
        backdropClass: 't3-rematch-backdrop',
        disableClose: true,
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.confirmedMatchId) {
        this.router.navigate(['/match', result.confirmedMatchId]);
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  private openGameWonDialog(event: GameWonPayload): void {
    const state = this.matchStateService.state();
    if (!state) {
      this.eventQueue.resumeAck();
      return;
    }

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

    const dialogRef = this.dialog.open<GameWonDialogComponent, GameWonDialogData, void>(
      GameWonDialogComponent,
      {
        data,
        panelClass: 't3-game-won-dialog',
        backdropClass: 't3-game-won-backdrop',
        disableClose: false,
      }
    );

    dialogRef.afterClosed().subscribe(() => {
      this.eventQueue.resumeAck();
    });
  }

  private openEnvidoResultDialog(payload: EnvidoResolvedPayload): void {
    // No mostrar modal cuando el envido fue rechazado: el ACK se consume síncrono.
    if (payload.response === 'NO_QUIERO') {
      this.eventQueue.resumeAck();
      return;
    }

    const state = this.matchStateService.state();
    if (!state || !state.roundGame) {
      this.eventQueue.resumeAck();
      return;
    }

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

    // La cola está pausada esperando el ACK (cierre del modal), así que diferir la
    // apertura es seguro: deja ver el "¡Quiero!" antes de mostrar el resultado.
    this.envidoModalTimerId = window.setTimeout(() => {
      this.envidoModalTimerId = null;

      const dialogRef = this.dialog.open<EnvidoResultDialogComponent, EnvidoResultDialogData, void>(
        EnvidoResultDialogComponent,
        {
          data,
          panelClass: 't3-envido-result-dialog',
          backdropClass: 't3-envido-result-backdrop',
          disableClose: false,
        }
      );

      dialogRef.afterClosed().subscribe(() => {
        this.eventQueue.resumeAck();
      });
    }, MatchScreenComponent.ENVIDO_RESULT_MODAL_DELAY_MS);
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

  private _paramSub?: Subscription;
  private _endedSub?: Subscription;
  private _gameWonSub?: Subscription;
  private _envidoSub?: Subscription;
  private _eventSub?: Subscription;
}
