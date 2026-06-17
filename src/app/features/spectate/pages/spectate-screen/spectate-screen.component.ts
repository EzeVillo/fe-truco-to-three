import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  ViewContainerRef,
  type OnInit,
  type OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { deriveMatchView, type MatchView } from '../../../match/utils/derive-match-view';
import { GameBoardComponent } from '../../../match/components/game-board/game-board.component';
import {
  GameWonDialogComponent,
  type GameWonDialogData,
} from '../../../match/components/game-won-dialog/game-won-dialog.component';
import {
  EnvidoResultDialogComponent,
  type EnvidoResultDialogData,
} from '../../../match/components/envido-result-dialog/envido-result-dialog.component';
import { SpectateStateService } from '../../services/spectate-state.service';
import { BotsApiService } from '../../../lobby/services/bots-api.service';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import { MatchEventQueueService } from '../../../match/services/match-event-queue.service';
import { MatchCallAudioService } from '../../../match/services/match-call-audio.service';
import { BackgroundMusicService } from '../../../match/services/background-music.service';
import { CardPreloadService } from '../../../match/services/card-preload.service';
import { derivePendingCall } from '../../../match/utils/derive-pending-call';
import { callDisplayMapper } from '../../../match/utils/call-display-mapper';
import {
  computeRemainingMsFromSnapshot,
  computeElapsedFraction,
  isUrgent,
} from '../../../match/utils/turn-timer';
import type {
  GameWonPayload,
  EnvidoResolvedPayload,
  MatchEndedEvent,
  MatchWsEvent,
} from '../../../match/models/match-ws-events';
import type { Seat } from '../../../../core/models/enums';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'app-spectate-screen',
  standalone: true,
  imports: [CommonModule, GameBoardComponent],
  providers: [SpectateStateService, MatchEventQueueService],
  templateUrl: './spectate-screen.component.html',
  styleUrl: './spectate-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpectateScreenComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly vcr = inject(ViewContainerRef);
  readonly spectateService = inject(SpectateStateService);
  private readonly botsApi = inject(BotsApiService);
  private readonly eventQueue = inject(MatchEventQueueService);
  private readonly callAudio = inject(MatchCallAudioService);
  private readonly backgroundMusic = inject(BackgroundMusicService);
  private readonly cardPreload = inject(CardPreloadService);

  private _gameWonSub?: Subscription;
  private _envidoSub?: Subscription;
  private _matchEndedSub?: Subscription;
  private _eventSub?: Subscription;

  readonly matchId = signal<string>('');

  readonly matchView = computed<MatchView | null>(() => {
    const state = this.spectateService.matchState();
    return state ? deriveMatchView(state) : null;
  });

  // El espectador renderiza con viewerSeat = PLAYER_ONE (perspectiva neutra): el
  // bubble "self" cuelga del asiento PLAYER_ONE y "opponent" del PLAYER_TWO.
  /** Texto de canto/respuesta visible sobre el asiento PLAYER_ONE. */
  readonly selfCallText = signal<string | null>(null);
  /** Texto de canto/respuesta visible sobre el asiento PLAYER_TWO. */
  readonly opponentCallText = signal<string | null>(null);

  // Estado del display de cantos, espejo de match-screen: a diferencia del
  // jugador, el espectador no actuaba ningún evento de respuesta (¡Quiero!,
  // ¡No quiero!, ¡Me voy al mazo!), así que se reconstruyen desde los eventos WS.
  private lastEnvidoCallerSeat: Seat | null = null;
  private readonly callDisplayTimers = new Map<string, number>();
  private _callHydratedMatchId: string | null = null;

  // Control de avance manual (§9.2b): las partidas bot-vs-bot no avanzan solas, el
  // creador dispara cada jugada con un POST .../advance. Solo el dueño puede
  // espectar una bot-vs-bot, así que basta detectar que es bot-vs-bot para mostrar
  // el control. Se "engancha" en true al ver las manos boca arriba (no-nulas solo
  // en bot-vs-bot) y no vuelve a apagarse aunque entre rondas queden null.
  readonly isBotVsBot = signal<boolean>(false);
  readonly advancing = signal<boolean>(false);
  readonly advanceError = signal<string | null>(null);

  /** El control de avance solo aplica mientras la serie sigue en curso. */
  readonly canAdvance = computed<boolean>(() => {
    const v = this.matchView();
    return (
      this.isBotVsBot() &&
      !!v &&
      v.status === 'IN_PROGRESS' &&
      !this.advancing() &&
      !this.spectateService.isProcessingDelay()
    );
  });

  private _advanceSub?: Subscription;

  constructor() {
    // Latch de bot-vs-bot: en cuanto el snapshot trae alguna mano boca arriba,
    // sabemos que es una partida bot-vs-bot de la que somos dueños.
    effect(() => {
      const round = this.spectateService.matchState()?.roundGame;
      if (round && (round.handPlayerOne !== null || round.handPlayerTwo !== null)) {
        this.isBotVsBot.set(true);
      }
    });

    // Hidratación: si entramos a mirar con un canto sin resolver ya en curso, el
    // evento WS original ya pasó; el snapshot lo refleja vía derivePendingCall.
    effect(() => {
      const state = this.spectateService.matchState();
      const id = this.matchId();
      if (!state || !id || !state.roundGame || this._callHydratedMatchId === id) {
        return;
      }
      this._callHydratedMatchId = id;
      if (this.selfCallText() !== null || this.opponentCallText() !== null) {
        return;
      }
      const pending = derivePendingCall(state);
      if (!pending) {
        return;
      }
      // Si el canto pendiente es un envido, recordamos el asiento del cantor: sin
      // esto, al refrescar con un envido en curso no llegó el ENVIDO_CALLED en vivo
      // y handleCallDisplay no podría inferir el respondedor cuando llegue
      // ENVIDO_RESOLVED, dejando sin mostrar la respuesta (¡Quiero!/¡No quiero!).
      if (state.roundGame.roundStatus === 'ENVIDO_IN_PROGRESS') {
        this.lastEnvidoCallerSeat = pending.seat;
      }
      (pending.seat === 'PLAYER_ONE' ? this.selfCallText : this.opponentCallText).set(pending.text);
    });
  }

  /** "Ahora" del cliente — se usa para calcular el restante del timer. */
  private readonly nowMs = signal<number>(Date.now());
  private timerIntervalId: number | null = null;
  private static readonly TIMER_TICK_MS = 200;

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

  readonly timerRemainingMs = computed(() => {
    const v = this.matchView();
    if (!v || v.actionDeadline === null || v.turnDurationMillis === null) {
      return 0;
    }
    return computeRemainingMsFromSnapshot(
      v.actionDeadline,
      this.spectateService.serverClockOffsetMs(),
      this.nowMs(),
    );
  });

  readonly timerRemainingFraction = computed<number>(() => {
    const total = this.matchView()?.turnDurationMillis ?? 0;
    return 1 - computeElapsedFraction(this.timerRemainingMs(), total);
  });

  readonly timerIsUrgent = computed<boolean>(
    () => this.timerActive() && isUrgent(this.timerRemainingMs()),
  );

  ngOnInit(): void {
    this.cardPreload.preloadDeck();
    this.backgroundMusic.start();
    const matchId = this.route.snapshot.paramMap.get('matchId') ?? '';
    this.matchId.set(matchId);
    this.spectateService.init(matchId);

    this.timerIntervalId = window.setInterval(() => {
      if (this.timerActive()) {
        this.nowMs.set(Date.now());
      }
    }, SpectateScreenComponent.TIMER_TICK_MS);

    this._gameWonSub = this.spectateService.gameWon$.subscribe((e) => this.openGameWonDialog(e));
    this._envidoSub = this.spectateService.envidoResolved$.subscribe((e) =>
      this.openEnvidoResultDialog(e),
    );
    this._matchEndedSub = this.spectateService.matchEnded$.subscribe((e) =>
      this.openMatchEndedDialog(e),
    );
    this._eventSub = this.spectateService.matchEvent$.subscribe((e) => this.handleCallDisplay(e));
  }

  ngOnDestroy(): void {
    this.backgroundMusic.stop();
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
    }
    this._gameWonSub?.unsubscribe();
    this._envidoSub?.unsubscribe();
    this._matchEndedSub?.unsubscribe();
    this._eventSub?.unsubscribe();
    this._advanceSub?.unsubscribe();
    this.clearAllCallDisplayTimers();
    this.dialog.closeAll();
    this.spectateService.destroy();
  }

  /**
   * Reconstruye los bubbles de canto y respuesta desde los eventos WS, espejo de
   * MatchScreenComponent.handleMatchEvent pero con viewerSeat fijo en PLAYER_ONE.
   */
  private handleCallDisplay(event: MatchWsEvent): void {
    // El evento llega post-delay: el espectador ve ambos asientos como remotos,
    // así que la carta y su sonido aparecen sincronizados con el delay de la cola.
    if (event.eventType === 'CARD_PLAYED') {
      try {
        this.callAudio.playCardThrow();
      } catch {
        // El audio nunca debe romper el flujo visual.
      }
    }

    // Reset al cerrar ronda/juego/partida.
    if (
      event.eventType === 'ROUND_STARTED' ||
      event.eventType === 'GAME_STARTED' ||
      event.eventType === 'MATCH_FINISHED' ||
      event.eventType === 'MATCH_ABANDONED' ||
      event.eventType === 'MATCH_FORFEITED'
    ) {
      this.resetCallTexts();
      this.lastEnvidoCallerSeat = null;
      return;
    }

    if (event.eventType === 'ENVIDO_CALLED') {
      this.lastEnvidoCallerSeat = (event.payload as { callerSeat: Seat }).callerSeat;
    }

    // ENVIDO_RESOLVED no trae responderSeat: se infiere como rival del cantor.
    if (event.eventType === 'ENVIDO_RESOLVED') {
      const response = (event.payload as { response: string }).response;
      const text =
        response === 'QUIERO' ? '¡Quiero!' : response === 'NO_QUIERO' ? '¡No quiero!' : null;
      const callerSeat = this.lastEnvidoCallerSeat;
      this.lastEnvidoCallerSeat = null;
      if (!text || !callerSeat) {
        return;
      }
      const responderSeat: Seat = callerSeat === 'PLAYER_ONE' ? 'PLAYER_TWO' : 'PLAYER_ONE';
      this.showCallText(responderSeat, text, event, true);
      return;
    }

    const displayEvent = callDisplayMapper(event);
    if (!displayEvent) {
      return;
    }
    this.showCallText(displayEvent.seat, displayEvent.text, event, displayEvent.autoClear);
  }

  /** Muestra el bubble sobre el asiento dado, limpiando cualquier otro previo. */
  private showCallText(seat: Seat, text: string, event: MatchWsEvent, autoClear: boolean): void {
    this.resetCallTexts();
    const signalRef = seat === 'PLAYER_ONE' ? this.selfCallText : this.opponentCallText;
    signalRef.set(text);
    try {
      this.callAudio.playForEvent(event);
    } catch {
      // El audio nunca debe romper el flujo visual.
    }
    if (autoClear) {
      const timeoutId = window.setTimeout(() => signalRef.set(null), 3000);
      this.callDisplayTimers.set('call', timeoutId);
    }
  }

  private resetCallTexts(): void {
    this.selfCallText.set(null);
    this.opponentCallText.set(null);
    this.clearAllCallDisplayTimers();
  }

  private clearAllCallDisplayTimers(): void {
    for (const timeoutId of this.callDisplayTimers.values()) {
      clearTimeout(timeoutId);
    }
    this.callDisplayTimers.clear();
  }

  private openGameWonDialog(event: GameWonPayload): void {
    const state = this.spectateService.matchState();
    if (!state) {
      this.eventQueue.resumeAck();
      return;
    }

    const data: GameWonDialogData = {
      playerName: state.playerOneUsername,
      opponentName: state.playerTwoUsername ?? '',
      playerGamesWon: state.gamesWonPlayerOne,
      opponentGamesWon: state.gamesWonPlayerTwo,
      gamesToPlay: state.gamesToPlay,
      gameNumber: state.gamesWonPlayerOne + state.gamesWonPlayerTwo,
      matchFinished: false,
      localWonMatch: event.winnerSeat === 'PLAYER_ONE',
      spectatorMode: true,
    };

    const ref = this.dialog.open<GameWonDialogComponent, GameWonDialogData, void>(
      GameWonDialogComponent,
      {
        viewContainerRef: this.vcr,
        data,
        panelClass: 't3-game-won-dialog',
        backdropClass: 't3-game-won-backdrop',
        disableClose: false,
      },
    );
    this.playSpectatorOutcomeCue();
    ref.afterClosed().subscribe(() => this.eventQueue.resumeAck());
  }

  private openMatchEndedDialog(event: MatchEndedEvent): void {
    const state = this.spectateService.matchState();
    if (!state) {
      this.eventQueue.resumeAck();
      return;
    }

    const data: GameWonDialogData = {
      playerName: state.playerOneUsername,
      opponentName: state.playerTwoUsername ?? '',
      playerGamesWon: event.gamesWonPlayerOne,
      opponentGamesWon: event.gamesWonPlayerTwo,
      gamesToPlay: state.gamesToPlay,
      gameNumber: event.gamesWonPlayerOne + event.gamesWonPlayerTwo,
      matchFinished: true,
      localWonMatch: event.winnerSeat === 'PLAYER_ONE',
      spectatorMode: true,
    };

    const ref = this.dialog.open<GameWonDialogComponent, GameWonDialogData, void>(
      GameWonDialogComponent,
      {
        viewContainerRef: this.vcr,
        data,
        panelClass: 't3-game-won-dialog',
        backdropClass: 't3-game-won-backdrop',
        disableClose: true,
      },
    );
    this.playSpectatorOutcomeCue();
    ref.afterClosed().subscribe(() => {
      this.eventQueue.resumeAck();
      void this.router.navigate(['/friends']);
    });
  }

  private openEnvidoResultDialog(payload: EnvidoResolvedPayload): void {
    // NO_QUIERO no abre modal; el ACK se consume de inmediato igual que en el match.
    if (payload.response === 'NO_QUIERO') {
      this.eventQueue.resumeAck();
      return;
    }

    const state = this.spectateService.matchState();
    if (!state || !state.roundGame) {
      this.eventQueue.resumeAck();
      return;
    }

    const manoName = state.roundGame.currentHand.mano;
    const isManoPlayerOne = state.playerOneUsername === manoName;
    const pieName = isManoPlayerOne ? (state.playerTwoUsername ?? '') : state.playerOneUsername;

    const data: EnvidoResultDialogData = {
      manoName,
      manoScore: payload.pointsMano ?? null,
      pieName,
      pieScore: payload.pointsPie ?? null,
      won: payload.winnerSeat === 'PLAYER_ONE',
      spectatorMode: true,
    };

    const ref = this.dialog.open<EnvidoResultDialogComponent, EnvidoResultDialogData, void>(
      EnvidoResultDialogComponent,
      {
        viewContainerRef: this.vcr,
        data,
        panelClass: 't3-envido-result-dialog',
        backdropClass: 't3-envido-result-backdrop',
        disableClose: false,
      },
    );
    this.playSpectatorOutcomeCue();
    ref.afterClosed().subscribe(() => this.eventQueue.resumeAck());
  }

  /**
   * Cue sonoro neutro al aparecer un modal de resultado en modo espectador (que,
   * a diferencia del jugador, no recibe jingle de win/lose). No-bloqueante: el
   * audio nunca debe romper el flujo. El desbloqueo de iOS ya está anclado al
   * primer gesto desde `App` vía el canal central, así que suena en WebKit.
   */
  private playSpectatorOutcomeCue(): void {
    try {
      this.callAudio.playSpectatorOutcomeCue();
    } catch {
      // El audio nunca debe romper el flujo visual.
    }
  }

  /**
   * Dispara la próxima acción de la partida bot-vs-bot (§9.2b). El nuevo estado
   * llega por el canal de espectador, así que acá solo manejamos el ciclo de la
   * request (bloquear reentradas y reportar error). El `204` es idempotente:
   * si la serie ya terminó, el botón ya estará oculto vía `canAdvance`.
   */
  onAdvance(): void {
    if (!this.canAdvance()) {
      return;
    }
    this.advancing.set(true);
    this.advanceError.set(null);
    this._advanceSub?.unsubscribe();
    this._advanceSub = this.botsApi.advanceBotVsBotMatch(this.matchId()).subscribe({
      next: () => {
        this.advancing.set(false);
      },
      error: (err: unknown) => {
        console.error('[SpectateScreen] error avanzando partida bot-vs-bot', err);
        this.advanceError.set(getErrorCopy('ADVANCE_BOT_VS_BOT_MATCH', err));
        this.advancing.set(false);
      },
    });
  }

  goBack(): void {
    void this.router.navigate(['/friends']);
  }
}
