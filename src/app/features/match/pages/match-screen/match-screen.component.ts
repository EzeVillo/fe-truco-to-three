import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  ViewContainerRef,
  type OnInit,
  type OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { deriveMatchView, type MatchView } from '../../utils/derive-match-view';
import { derivePendingCall } from '../../utils/derive-pending-call';
import {
  computeElapsedFraction,
  computeRemainingMsFromSnapshot,
  isUrgent,
} from '../../utils/turn-timer';
import { callDisplayMapper } from '../../utils/call-display-mapper';
import { GameBoardComponent } from '../../components/game-board/game-board.component';
import { WaitingRoomComponent } from '../../components/waiting-room/waiting-room.component';
import { ChatPanelComponent } from '../../../chat/components/chat-panel/chat-panel.component';
import { ChatStore } from '../../../chat/services/chat.store';
import { MatchesApiService } from '../../../lobby/services/matches-api.service';
import { VISIBILITY, type Visibility } from '../../../../core/models/enums';
import {
  GameWonDialogComponent,
  type GameWonDialogData,
} from '../../components/game-won-dialog/game-won-dialog.component';
import {
  EnvidoResultDialogComponent,
  type EnvidoResultDialogData,
} from '../../components/envido-result-dialog/envido-result-dialog.component';
import {
  RematchDialogComponent,
  type RematchDialogResult,
} from '../../components/rematch-dialog/rematch-dialog.component';
import {
  CampaignPointsDialogComponent,
  type CampaignPointsDialogData,
} from '../../components/campaign-points-dialog/campaign-points-dialog.component';
import { CampaignPointsService } from '../../../campaign/services/campaign-points.service';
import { isCampaignMatch, clearCampaignMatch } from '../../../campaign/utils/campaign-match-store';
import { MatchStateService } from '../../services/match-state.service';
import { MatchEventQueueService } from '../../services/match-event-queue.service';
import { RematchStateService } from '../../services/rematch-state.service';
import { RematchApiService } from '../../services/rematch-api.service';
import {
  MatchCallAudioService,
  type MatchOutcomeLevel,
} from '../../services/match-call-audio.service';
import { BackgroundMusicService } from '../../services/background-music.service';
import { TurnTimerSoundService } from '../../services/turn-timer-sound.service';
import { CardPreloadService } from '../../services/card-preload.service';
import { PresenceCoordinatorService } from '../../../../core/services/presence-coordinator.service';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import type {
  MatchEndedEvent,
  MatchWsEvent,
  GameWonPayload,
  EnvidoResolvedPayload,
  PlayerReadyPayload,
} from '../../models/match-ws-events';
import type { CampaignMatchPointsPayload } from '../../../../core/models/ws.models';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'app-match-screen',
  standalone: true,
  imports: [
    CommonModule,
    GameBoardComponent,
    WaitingRoomComponent,
    MatProgressSpinnerModule,
    ChatPanelComponent,
  ],
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
    if (!this.matchStateService.error()) {
      return '';
    }
    return getErrorCopy('MATCH_LOAD', null);
  });
  readonly selfCallText = signal<string | null>(null);
  readonly opponentCallText = signal<string | null>(null);

  // ---- Sala de espera (feature 015-private-match-code) ----
  // joinCode y visibilidad salen directo del snapshot REST (`lobby`, §4.14): el
  // backend los devuelve a quien ya está sentado en la sala, así que son fuente de
  // verdad estable ante creación/recarga/reconexión, sin router state ni storage.
  /** Código compartible de la partida (solo relevante para el anfitrión). */
  readonly joinCode = computed<string | null>(
    () => this.matchStateService.state()?.lobby?.joinCode ?? null,
  );
  /** Visibilidad de la partida (para el título de la sala de espera). */
  readonly visibility = computed<Visibility>(
    () => this.matchStateService.state()?.lobby?.visibility ?? VISIBILITY.PRIVATE,
  );
  /** Acción de inicio en curso. */
  readonly starting = signal<boolean>(false);
  /** El visor ya confirmo que esta listo para comenzar. */
  readonly selfReady = signal<boolean>(false);
  /** El rival ya confirmo que esta listo para comenzar. */
  readonly opponentReady = signal<boolean>(false);
  /** Acción de salida en curso. */
  readonly leaving = signal<boolean>(false);
  /** Aviso de que la partida fue cancelada antes de empezar (rival notificado). */
  readonly cancelledNotice = signal<string | null>(null);

  /** La partida aún no comenzó: se muestra la sala de espera, no el tablero. */
  readonly isPreGame = computed(() => {
    const status = this.matchView()?.status;
    return status === 'WAITING_FOR_PLAYERS' || status === 'READY';
  });

  /** Vista derivada para la sala de espera. */
  readonly waitingView = computed(() => {
    const state = this.matchStateService.state();
    if (!state) {
      return null;
    }
    const isHost = state.viewerSeat === 'PLAYER_ONE';
    const rivalPresent = state.playerTwoUsername !== null;
    const hostReady = isHost ? this.selfReady() : this.opponentReady();
    const rivalReady = isHost ? this.opponentReady() : this.selfReady();
    return {
      isHost,
      joinCode: this.joinCode(),
      visibility: this.visibility(),
      hostUsername: state.playerOneUsername,
      rivalUsername: state.playerTwoUsername,
      rivalPresent,
      canStart: rivalPresent,
      selfReady: this.selfReady(),
      opponentReady: this.opponentReady(),
      hostReady,
      rivalReady,
    };
  });

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

  /**
   * El plazo en rojo corre sobre el asiento propio: dispara el tic-tac de urgencia.
   * Se exige `remaining > 0` para cortar el sonido en cuanto se agota (no quedarse
   * sonando en el instante 0 mientras el backend resuelve el timeout). Sólo el turno
   * propio: el tic-tac es una alerta accionable para que el jugador no pierda por
   * tiempo; en el turno del rival no hay nada que hacer y sólo molestaría.
   */
  readonly turnTimerUrgentForSelf = computed(() => {
    const remaining = this.timerRemainingMs();
    return this.matchView()?.deadlineIsSelf === true && remaining > 0 && isUrgent(remaining);
  });

  /** El plazo propio se agotó antes de la resolución del backend (FR-008). */
  readonly viewerActionTimedOut = computed(() => {
    const v = this.matchView();
    return (
      !!v && v.status === 'IN_PROGRESS' && v.deadlineIsSelf === true && this.timerRemainingMs() <= 0
    );
  });

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  readonly matchStateService = inject(MatchStateService);
  readonly eventQueue = inject(MatchEventQueueService);
  private readonly rematchStateService = inject(RematchStateService);
  private readonly rematchApiService = inject(RematchApiService);
  private readonly campaignPoints = inject(CampaignPointsService);
  private readonly matchCallAudioService = inject(MatchCallAudioService);
  private readonly backgroundMusic = inject(BackgroundMusicService);
  private readonly turnTimerSound = inject(TurnTimerSoundService);
  private readonly cardPreload = inject(CardPreloadService);
  private readonly presenceCoordinator = inject(PresenceCoordinatorService);
  private readonly matchesApiService = inject(MatchesApiService);
  private readonly vcr = inject(ViewContainerRef);
  readonly chatStore = inject(ChatStore);
  private readonly destroyRef = inject(DestroyRef);
  private _rematchInited = false;
  /** Ref al diálogo de revancha abierto, para cerrarlo si navegamos antes de su propio cierre. */
  private rematchDialogRef: MatDialogRef<RematchDialogComponent, RematchDialogResult> | null = null;
  /** matchId para el que ya se hidrató el bubble de canto desde el snapshot. */
  private _callHydratedMatchId: string | null = null;
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

    // La sala de espera vive en /match/:id, pero todavia no es juego activo.
    // La musica de partida arranca solo cuando el tablero esta en curso.
    effect(() => {
      if (this.matchView()?.status === 'IN_PROGRESS') {
        this.backgroundMusic.start();
      } else {
        this.backgroundMusic.stop();
      }
    });

    // Tic-tac de urgencia cuando el plazo propio entra en rojo (≤ 5 s). El effect se
    // re-evalúa en cada tick del temporizador (nowMs), arrancando/cortando el loop.
    effect(() => {
      if (this.turnTimerUrgentForSelf()) {
        this.turnTimerSound.start();
      } else {
        this.turnTimerSound.stop();
      }
    });

    // Inicia RematchStateService la primera vez que el estado de la partida carga.
    // Se re-activa al navegar a una nueva partida (re-init via paramMap, D4).
    //
    // El snapshot REST de la revancha SOLO se pide cuando el presence ya indica que hay
    // una revancha activa para este match (caso reconexión). En el flujo en vivo no se
    // pega al GET: la sesión llega por el evento WS REMATCH_AVAILABLE o por el GET de
    // carrera al cerrar el modal de resultado.
    effect(() => {
      const state = this.matchStateService.state();
      const id = this.matchId();
      if (state && id && !this._rematchInited) {
        this._rematchInited = true;
        const hasActiveRematch = this.presenceCoordinator.presence()?.rematch?.originMatchId === id;
        this.rematchStateService.init(id, state.viewerSeat, hasActiveRematch);
      }
    });

    // Hidrata el bubble de canto desde el snapshot inicial. Si el rival cantó
    // ANTES de que entráramos a la partida (típico en la revancha: el bot canta
    // apenas arranca la nueva ronda), ese evento WS ya pasó y no se reemite, así
    // que el bubble nunca aparecería. El snapshot sí refleja el canto sin resolver.
    effect(() => {
      const state = this.matchStateService.state();
      const id = this.matchId();
      if (!state || !id || !state.roundGame || this._callHydratedMatchId === id) {
        return;
      }
      // Una vez que llegó el primer snapshot con ronda en curso, no re-hidratar:
      // a partir de ahí mandan los eventos WS en vivo.
      this._callHydratedMatchId = id;
      // No pisar un bubble ya mostrado por un evento en vivo que se nos adelantó.
      if (this.selfCallText() !== null || this.opponentCallText() !== null) {
        return;
      }
      const pending = derivePendingCall(state);
      if (!pending) {
        return;
      }
      // Si el canto pendiente es un envido, recordamos el asiento del cantor: sin
      // esto, al refrescar con un envido en curso no llegó el ENVIDO_CALLED en vivo
      // y handleMatchEvent no podría inferir el respondedor cuando llegue
      // ENVIDO_RESOLVED, dejando sin mostrar la respuesta (¡Quiero!/¡No quiero!).
      if (state.roundGame.roundStatus === 'ENVIDO_IN_PROGRESS') {
        this.lastEnvidoCallerSeat = pending.seat;
      }
      const isSelf = pending.seat === state.viewerSeat;
      (isSelf ? this.selfCallText : this.opponentCallText).set(pending.text);
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
    this.cardPreload.preloadDeck();
    // Usar paramMap para detectar cambios de matchId al navegar a la revancha (D4).
    this._paramSub = this.route.paramMap.subscribe((params) => {
      const newId = params.get('matchId') ?? '';
      if (!newId || newId === this.matchId()) {
        return;
      }
      this.matchId.set(newId);
      this._rematchInited = false;
      this._callHydratedMatchId = null;
      this.selfCallText.set(null);
      this.opponentCallText.set(null);
      this.clearAllCallDisplayTimers();
      this.cancelledNotice.set(null);
      this.starting.set(false);
      this.selfReady.set(false);
      this.opponentReady.set(false);
      // joinCode + visibilidad ya no se arrastran por navegación: el snapshot REST
      // (`lobby`, §4.14) los trae y `joinCode()`/`visibility()` los derivan de él.
      // Si navegamos a otra partida (típico: revancha confirmada cuya navegación llegó
      // por presence antes de procesar REMATCH_CONFIRMED), el reset() de abajo deja la
      // sesión en null y el diálogo de revancha quedaría colgado mostrando "Salir" con la
      // nueva partida de fondo. Lo cerramos acá pidiendo NO volver a navegar.
      this.rematchDialogRef?.close({ confirmedMatchId: null, skipNavigation: true });
      this.rematchStateService.reset();
      this.matchStateService.init(newId);
      this.chatStore.enterMatch(newId);
    });

    // Cancelación de la sala antes de empezar (rival notificado). Feature 015.
    this._preGameClosedSub = this.matchStateService.preGameClosed$.subscribe(() => {
      this.cancelledNotice.set('La partida fue cancelada.');
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
    this.backgroundMusic.stop();
    this.turnTimerSound.stop();
    this._paramSub?.unsubscribe();
    this._preGameClosedSub?.unsubscribe();
    this._endedSub?.unsubscribe();
    this._gameWonSub?.unsubscribe();
    this._envidoSub?.unsubscribe();
    this._eventSub?.unsubscribe();
    this.clearAllCallDisplayTimers();
    this.stopTimerTick();
    this.dialog.closeAll();
    this.rematchStateService.reset();
    this.matchStateService.destroy();
    this.chatStore.leave();
  }

  private handleMatchEvent(event: MatchWsEvent): void {
    // El evento llega ya post-delay (applyTransactional), sincronizado con la
    // carta apareciendo en el tablero: local sin delay, rival con su delay.
    if (event.eventType === 'CARD_PLAYED') {
      this.playCardThrowAudio();
    }

    if (event.eventType === 'PLAYER_READY') {
      this.markPlayerReady(event.payload as PlayerReadyPayload);
    }

    if (event.eventType === 'MATCH_PLAYER_LEFT') {
      this.opponentReady.set(false);
    }

    if (event.eventType === 'GAME_STARTED') {
      this.selfReady.set(true);
      this.opponentReady.set(true);
      this.starting.set(false);
    }

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
      const payload = event.payload as {
        response: string;
        winnerSeat: 'PLAYER_ONE' | 'PLAYER_TWO';
      };
      const textMap: Record<string, string> = {
        QUIERO: '\u00a1Quiero!',
        NO_QUIERO: '\u00a1No quiero!',
      };
      const text = textMap[payload.response];
      if (!text) {
        return;
      }

      const state = this.matchStateService.state();
      if (!state) {
        return;
      }

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
      this.playCallAudio(event);

      // Tanto QUIERO como NO_QUIERO del envido se auto-limpian a los 3 s.
      const timeoutId = window.setTimeout(() => {
        signalRef.set(null);
      }, 3000);
      this.callDisplayTimers.set('call', timeoutId);

      this.lastEnvidoCallerSeat = null;
      return;
    }

    const displayEvent = callDisplayMapper(event);
    if (!displayEvent) {
      return;
    }

    const state = this.matchStateService.state();
    if (!state) {
      return;
    }

    // Solo puede haber un call text visible a la vez: limpiar ambos antes
    this.selfCallText.set(null);
    this.opponentCallText.set(null);
    this.clearAllCallDisplayTimers();

    const isSelf = displayEvent.seat === state.viewerSeat;
    const signalRef = isSelf ? this.selfCallText : this.opponentCallText;

    signalRef.set(displayEvent.text);
    this.playCallAudio(event);

    if (displayEvent.autoClear) {
      const timeoutId = window.setTimeout(() => {
        signalRef.set(null);
      }, 3000);
      this.callDisplayTimers.set('call', timeoutId);
    }
  }

  private playCallAudio(event: MatchWsEvent): void {
    try {
      this.matchCallAudioService.playForEvent(event);
    } catch {
      // El audio no debe bloquear ni romper el flujo visual de la partida.
    }
  }

  private playCardThrowAudio(): void {
    try {
      this.matchCallAudioService.playCardThrow();
    } catch {
      // El audio no debe bloquear ni romper el flujo visual de la partida.
    }
  }

  private playOutcomeAudio(level: MatchOutcomeLevel, won: boolean): void {
    try {
      this.matchCallAudioService.playOutcome(level, won);
    } catch {
      // El audio no debe bloquear ni romper el flujo visual de la partida.
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
    this.router.navigate(['/lobby']);
  }

  /** Marca al jugador listo (§4.5). La transicion al tablero llega por GAME_STARTED. */
  onStartMatch(): void {
    if (this.starting() || this.selfReady()) {
      return;
    }
    const id = this.matchId();
    if (!id) {
      return;
    }
    this.starting.set(true);
    this.matchesApiService.startMatch(id).subscribe({
      next: () => {
        this.selfReady.set(true);
        this.starting.set(false);
        // El status pasa a IN_PROGRESS al llegar GAME_STARTED (reducer).
      },
      error: () => {
        this.starting.set(false);
      },
    });
  }

  private markPlayerReady(payload: PlayerReadyPayload): void {
    const viewerSeat = this.matchStateService.state()?.viewerSeat;
    if (!viewerSeat) {
      return;
    }
    if (payload.seat === viewerSeat) {
      this.selfReady.set(true);
      this.starting.set(false);
    } else {
      this.opponentReady.set(true);
    }
  }

  /** Cualquier jugador sale de la sala antes de comenzar (§4.13). */
  onLeaveMatch(): void {
    if (this.leaving()) {
      return;
    }
    const id = this.matchId();
    if (!id) {
      return;
    }
    this.leaving.set(true);
    this.matchesApiService.leaveMatch(id).subscribe({
      next: () => {
        this.router.navigate(['/lobby']);
      },
      error: () => {
        this.leaving.set(false);
      },
    });
  }

  private openResultDialog(event: MatchEndedEvent): void {
    const state = this.matchStateService.state();
    if (!state) {
      return;
    }

    const data: GameWonDialogData = this.mapMatchEndedToDialogData(event, state);

    this.playOutcomeAudio('MATCH', data.localWonMatch);

    const dialogRef = this.dialog.open<GameWonDialogComponent, GameWonDialogData, void>(
      GameWonDialogComponent,
      {
        data,
        panelClass: 't3-game-won-dialog',
        backdropClass: 't3-game-won-backdrop',
        disableClose: true,
      },
    );

    dialogRef.afterClosed().subscribe(() => {
      this.eventQueue.resumeAck();
      this.afterResultDialogClosed(event.reason);
    });
  }

  /**
   * Tras cerrar el modal de "ganaste/perdiste": en un match de campaña espera el
   * push `CAMPAIGN_MATCH_POINTS` y muestra el modal de puntos antes de continuar;
   * en cualquier otro match sigue el flujo normal (revancha / lobby).
   */
  private afterResultDialogClosed(reason: MatchEndedEvent['reason']): void {
    const matchId = this.matchId();
    if (!matchId || !isCampaignMatch(matchId)) {
      this.decideAfterResultDialog(reason);
      return;
    }

    this.campaignPoints.awaitForMatch(matchId).subscribe((payload) => {
      clearCampaignMatch(matchId);
      if (!payload) {
        // El push no llegó a tiempo: no bloqueamos al jugador, volvemos a la campaña.
        void this.router.navigate(['/lobby/campaign']);
        return;
      }
      this.openCampaignPointsDialog(payload);
    });
  }

  private openCampaignPointsDialog(payload: CampaignMatchPointsPayload): void {
    const data: CampaignPointsDialogData = {
      won: payload.won,
      pointsAwarded: payload.pointsAwarded,
      totalPoints: payload.totalPoints,
      previousPosition: payload.previousPosition,
      newPosition: payload.newPosition,
    };

    const dialogRef = this.dialog.open<
      CampaignPointsDialogComponent,
      CampaignPointsDialogData,
      void
    >(CampaignPointsDialogComponent, {
      data,
      panelClass: 't3-game-won-dialog',
      backdropClass: 't3-game-won-backdrop',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe(() => {
      // Tras los puntos volvemos a la campaña para ver el ranking actualizado.
      void this.router.navigate(['/lobby/campaign']);
    });
  }

  private decideAfterResultDialog(reason: MatchEndedEvent['reason']): void {
    const session = this.rematchStateService.session();
    if (session) {
      this.openRematchDialog();
      return;
    }

    // La revancha es puramente event-driven (FR-001/FR-002): el backend solo abre la
    // sesión y emite REMATCH_AVAILABLE en finales naturales (FINISHED). En abandono o
    // forfeit (timeout) NO hay revancha, así que no tiene sentido la consulta de carrera:
    // volvemos directo al lobby. Sin esto, el getSession espurio "buscaba" una revancha
    // inexistente en esos finales.
    if (reason !== 'FINISHED') {
      this.router.navigate(['/lobby']);
      return;
    }

    // Carrera: REMATCH_AVAILABLE pudo no haber llegado todavía — consulta puntual (D3).
    const matchId = this.matchId();
    const viewerSeat = this.matchStateService.state()?.viewerSeat;
    if (!matchId || !viewerSeat) {
      this.router.navigate(['/lobby']);
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
        this.router.navigate(['/lobby']);
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

    this.rematchDialogRef = dialogRef;

    dialogRef.afterClosed().subscribe((result) => {
      this.rematchDialogRef = null;
      // Ya navegamos por fuera (carrera con presence): no pisar ese destino.
      if (result?.skipNavigation) {
        return;
      }
      if (result?.confirmedMatchId) {
        this.router.navigate(['/match', result.confirmedMatchId]);
      } else {
        this.router.navigate(['/lobby']);
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

    const playerName = isPlayerOne ? state.playerOneUsername : (state.playerTwoUsername ?? '');
    const opponentName = isPlayerOne ? (state.playerTwoUsername ?? '') : state.playerOneUsername;
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

    this.playOutcomeAudio('GAME', data.localWonMatch);

    const dialogRef = this.dialog.open<GameWonDialogComponent, GameWonDialogData, void>(
      GameWonDialogComponent,
      {
        data,
        panelClass: 't3-game-won-dialog',
        backdropClass: 't3-game-won-backdrop',
        disableClose: false,
      },
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
    const pieUsername = isManoPlayerOne ? (state.playerTwoUsername ?? '') : state.playerOneUsername;
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

      this.playOutcomeAudio('ENVIDO', data.won);

      const dialogRef = this.dialog.open<EnvidoResultDialogComponent, EnvidoResultDialogData, void>(
        EnvidoResultDialogComponent,
        {
          data,
          panelClass: 't3-envido-result-dialog',
          backdropClass: 't3-envido-result-backdrop',
          disableClose: false,
        },
      );

      dialogRef.afterClosed().subscribe(() => {
        this.eventQueue.resumeAck();
      });
    }, MatchScreenComponent.ENVIDO_RESULT_MODAL_DELAY_MS);
  }

  private mapMatchEndedToDialogData(
    event: MatchEndedEvent,
    state: ReturnType<typeof this.matchStateService.state>,
  ): GameWonDialogData {
    if (!state) {
      throw new Error('State is null when mapping match ended data');
    }

    const viewerSeat = state.viewerSeat;
    const isPlayerOne = viewerSeat === 'PLAYER_ONE';

    const playerName = isPlayerOne ? state.playerOneUsername : (state.playerTwoUsername ?? '');
    const opponentName = isPlayerOne ? (state.playerTwoUsername ?? '') : state.playerOneUsername;
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
  private _preGameClosedSub?: Subscription;
  private _endedSub?: Subscription;
  private _gameWonSub?: Subscription;
  private _envidoSub?: Subscription;
  private _eventSub?: Subscription;
}
