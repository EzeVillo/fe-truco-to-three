import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { Subscription } from 'rxjs';
import type { MatchState } from '../../../core/models/match.models';
import type { SpectateMatchState } from '../../../core/models/spectate.models';
import type {
  MatchWsEvent,
  MatchDerivedEvent,
  GameWonPayload,
  GameScoreChangedPayload,
  EnvidoResolvedPayload,
  MatchEndedEvent,
} from '../../match/models/match-ws-events';
import { applyMatchEvent, applyMatchDerivedEvent } from '../../match/reducers/match-event.reducer';
import { MatchEventQueueService } from '../../match/services/match-event-queue.service';
import { MatchCallAudioService } from '../../match/services/match-call-audio.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { SpectateApiService } from './spectate-api.service';
import { spectateErrorCopy, getErrorCopy } from '../../../shared/error-copy/error-copy';
import { adaptSpectateToMatchState } from '../utils/adapt-spectate-to-match-view';
import { SpectatorCountStore } from '../../../shared/services/spectator-count.store';

const SPECTATE_QUEUE = '/user/queue/match-spectate';

interface RawSpectateEvent {
  eventType: string;
  matchId?: string;
  timestamp?: number;
  stateVersion?: number;
  payload?: unknown;
}

function hasVersion(v: number | undefined): v is number {
  return v !== null && v !== undefined;
}

/**
 * Eventos derivados del reloj (sin stateVersion): reinician/limpian el deadline
 * del asiento obligado. Se rutean como derivados (igual que el flujo del jugador,
 * §9.5) porque applyMatchEvent no los maneja — solo applyMatchDerivedEvent. Sin
 * esto el espectador congela actionDeadline/actionDeadlineSeat tras el snapshot,
 * rompiendo el temporizador y el bubble de canto (que infiere el cantor desde
 * actionDeadlineSeat).
 */
function isTimerEvent(eventType: string): boolean {
  return eventType === 'ACTION_DEADLINE_SET' || eventType === 'ACTION_DEADLINE_CLEARED';
}

@Injectable()
export class SpectateStateService {
  private readonly wsService = inject(WebSocketService);
  private readonly apiService = inject(SpectateApiService);
  private readonly eventQueue = inject(MatchEventQueueService);
  private readonly callAudio = inject(MatchCallAudioService);
  private readonly countStore = inject(SpectatorCountStore);

  /** Estado adaptado del espectador (usado por deriveMatchView en la pantalla). */
  readonly matchState = signal<MatchState | null>(null);
  /** Cantidad de espectadores activos. */
  readonly spectatorCount = signal<number>(0);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly serverClockOffsetMs = signal<number>(0);

  /** Refleja si la cola está en medio de un delay o esperando ACK de modal. */
  readonly isProcessingDelay = this.eventQueue.isProcessingDelay;

  readonly gameWon$ = new Subject<GameWonPayload>();
  readonly envidoResolved$ = new Subject<EnvidoResolvedPayload>();
  readonly matchEnded$ = new Subject<MatchEndedEvent>();
  /** Emite cada evento de partida tras aplicarse — alimenta los bubbles de canto/respuesta. */
  readonly matchEvent$ = new Subject<MatchWsEvent>();

  private currentMatchId: string | null = null;
  private lastVersion = 0;
  private wasConnected = false;
  private subscriptions: Subscription[] = [];
  private wsSubscription: Subscription | null = null;

  init(matchId: string): void {
    this.currentMatchId = matchId;
    this.loading.set(true);
    this.error.set(null);
    this.matchState.set(null);
    this.lastVersion = 0;
    this.wasConnected = false;

    this.unsubscribeAll();
    this.eventQueue.clear();

    // El espectador nunca es "local" para ninguna acción: getViewerSeat devuelve
    // null para que resolveDelay aplique siempre el delay completo del oponente.
    this.eventQueue.init({
      getViewerSeat: () => null,
      applyTransactional: (e) => this.applyAndEmit(e),
      applyDerived: (e) => this.applyDerived(e),
      getCallAudioDurationMs: (e) => this.callAudio.getCallDurationMs(e),
    });

    this.wsService.connect();
    this.subscribeToChannel(matchId);

    const connSub = this.wsService.connected.subscribe((isConnected) => {
      if (this.wasConnected && !isConnected) {
        // Se perdió la conexión — esperar reconexión
      } else if (this.wasConnected && isConnected && this.currentMatchId !== null) {
        // Reconexión: el BE limpia la sesión al desconectar (§11.2), hay que re-suscribir
        this.loading.set(true);
        this.error.set(null);
        this.eventQueue.clear();
        this.wsSubscription?.unsubscribe();
        this.wsSubscription = null;
        this.subscribeToChannel(this.currentMatchId);
      }
      if (isConnected) {
        this.wasConnected = true;
      }
    });

    this.subscriptions.push(connSub);
  }

  private subscribeToChannel(matchId: string): void {
    this.wsSubscription = this.wsService
      .subscribe<RawSpectateEvent>(SPECTATE_QUEUE, { matchId })
      .subscribe((event) => this.handleEvent(event));
    this.subscriptions.push(this.wsSubscription);
  }

  private handleEvent(event: RawSpectateEvent): void {
    if (hasVersion(event.timestamp)) {
      this.serverClockOffsetMs.set(event.timestamp - Date.now());
    }

    switch (event.eventType) {
      case 'SPECTATE_STATE': {
        const payload = event.payload as { matchState: SpectateMatchState };
        const snap = payload.matchState;
        this.lastVersion = hasVersion(event.stateVersion) ? event.stateVersion : snap.stateVersion;
        this.eventQueue.clear();
        this.matchState.set(adaptSpectateToMatchState(snap));
        this.spectatorCount.set(snap.spectatorCount);
        this.countStore.set(snap.spectatorCount);
        this.loading.set(false);
        this.error.set(null);
        break;
      }

      case 'SPECTATE_ERROR': {
        const payload = event.payload as { error: string };
        this.error.set(spectateErrorCopy(payload.error));
        this.loading.set(false);
        break;
      }

      // Eventos privados por asiento re-difundidos en bot-vs-bot (§9.5g). La mano
      // boca arriba se reconstruye en deriveMatchView a partir de HAND_DEALT (y del
      // snapshot) menos las cartas ya jugadas, así que PLAYER_HAND_UPDATED es
      // redundante; se descarta para no meter ruido en la cola/versionado.
      // AVAILABLE_ACTIONS_UPDATED nunca le interesa a un espectador.
      case 'PLAYER_HAND_UPDATED':
      case 'AVAILABLE_ACTIONS_UPDATED':
        break;

      case 'SPECTATOR_COUNT_CHANGED': {
        const payload = event.payload as { spectatorCount: number };
        const expectedVersion = this.lastVersion + 1;
        if (hasVersion(event.stateVersion) && event.stateVersion !== expectedVersion) {
          this.triggerRefetch();
        } else {
          this.spectatorCount.set(payload.spectatorCount);
          this.countStore.set(payload.spectatorCount);
          if (hasVersion(event.stateVersion)) {
            this.lastVersion = event.stateVersion;
          }
        }
        break;
      }

      default: {
        // Eventos de reloj (sin stateVersion): se rutean como derivados para que
        // applyMatchDerivedEvent actualice actionDeadline/actionDeadlineSeat.
        if (isTimerEvent(event.eventType)) {
          this.enqueueTimerEvent(event as unknown as MatchDerivedEvent);
          break;
        }
        // Evento de partida re-difundido (CARD_PLAYED, TURN_CHANGED, etc.)
        this.enqueueGameEvent(event as unknown as MatchWsEvent);
        break;
      }
    }
  }

  private enqueueGameEvent(event: MatchWsEvent): void {
    if (this.matchState() === null || this.loading()) {
      return;
    }

    const expectedVersion = this.lastVersion + 1;
    if (hasVersion(event.stateVersion) && event.stateVersion !== expectedVersion) {
      this.triggerRefetch();
      return;
    }

    // Avanzar la versión al recibir el evento (antes del delay) para que los
    // eventos que lleguen mientras el delay corre no se interpreten como huecos.
    if (hasVersion(event.stateVersion)) {
      this.lastVersion = event.stateVersion;
    }

    this.eventQueue.enqueueTransactional(event);
  }

  private enqueueTimerEvent(event: MatchDerivedEvent): void {
    if (this.matchState() === null || this.loading()) {
      return;
    }
    this.eventQueue.enqueueDerived(event);
  }

  // Callback del queue: aplica un evento derivado (reloj) al estado.
  private applyDerived(event: MatchDerivedEvent): void {
    const current = this.matchState();
    if (current === null) {
      return;
    }
    this.matchState.set(applyMatchDerivedEvent(current, event));
  }

  // Callback del queue: aplica el evento al estado y emite a los subjects.
  // Llamado por MatchEventQueueService tras cumplir el delay.
  private applyAndEmit(event: MatchWsEvent): void {
    const current = this.matchState();
    if (current === null) {
      return;
    }

    this.matchState.set(applyMatchEvent(current, event));
    this.matchEvent$.next(event);

    if (
      event.eventType === 'MATCH_FINISHED' ||
      event.eventType === 'MATCH_ABANDONED' ||
      event.eventType === 'MATCH_FORFEITED'
    ) {
      const p = event.payload as {
        winnerSeat: 'PLAYER_ONE' | 'PLAYER_TWO';
        gamesWonPlayerOne: number;
        gamesWonPlayerTwo: number;
      };
      const reason: MatchEndedEvent['reason'] =
        event.eventType === 'MATCH_FINISHED'
          ? 'FINISHED'
          : event.eventType === 'MATCH_ABANDONED'
            ? 'ABANDONED'
            : 'FORFEITED';
      this.matchEnded$.next({
        winnerSeat: p.winnerSeat,
        gamesWonPlayerOne: p.gamesWonPlayerOne,
        gamesWonPlayerTwo: p.gamesWonPlayerTwo,
        reason,
      });
    }

    if (event.eventType === 'GAME_SCORE_CHANGED') {
      const p = event.payload as GameScoreChangedPayload;
      if (p.gamesWonPlayerOne > current.gamesWonPlayerOne) {
        this.gameWon$.next({ winnerSeat: 'PLAYER_ONE' });
      } else if (p.gamesWonPlayerTwo > current.gamesWonPlayerTwo) {
        this.gameWon$.next({ winnerSeat: 'PLAYER_TWO' });
      }
    }

    if (event.eventType === 'ENVIDO_RESOLVED') {
      this.envidoResolved$.next(event.payload as EnvidoResolvedPayload);
    }
  }

  private triggerRefetch(): void {
    if (this.currentMatchId === null) {
      return;
    }
    this.loading.set(true);
    this.eventQueue.clear();
    const sub = this.apiService.getSpectate(this.currentMatchId).subscribe({
      next: (snap) => {
        this.lastVersion = snap.stateVersion;
        this.matchState.set(adaptSpectateToMatchState(snap));
        this.spectatorCount.set(snap.spectatorCount);
        this.countStore.set(snap.spectatorCount);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (err: unknown) => {
        this.error.set(getErrorCopy('SPECTATE', err));
        this.loading.set(false);
      },
    });
    this.subscriptions.push(sub);
  }

  destroy(): void {
    this.eventQueue.clear();
    this.unsubscribeAll();
    this.countStore.reset();
    this.currentMatchId = null;
    this.gameWon$.complete();
    this.envidoResolved$.complete();
    this.matchEnded$.complete();
    this.matchEvent$.complete();
  }

  private unsubscribeAll(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
    this.wsSubscription = null;
  }
}
