import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import type { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WebSocketService } from '../../../core/services/websocket.service';
import type { MatchState } from '../../../core/models/match.models';
import type { MatchWsEvent, MatchDerivedEvent, MatchEndedEvent, GameWonPayload, EnvidoResolvedPayload, GameScoreChangedPayload } from '../models/match-ws-events';
import { applyMatchEvent, applyMatchDerivedEvent } from '../reducers/match-event.reducer';
import { MatchEventQueueService } from './match-event-queue.service';

interface MatchSnapshot extends MatchState {
  stateVersion: number;
}

/**
 * Eventos del temporizador de turno: viajan por /user/queue/match pero son
 * derivados (sin stateVersion). Ver docs/CONTRATOS_API.md §9.5 y feature 013.
 */
function isTimerEvent(event: MatchWsEvent): boolean {
  const type: string = event.eventType;
  return type === 'ACTION_DEADLINE_SET' || type === 'ACTION_DEADLINE_CLEARED';
}

/**
 * Eventos de revancha: viajan por /user/queue/match con matchId de la partida
 * original, pero se rutean por canal dedicado fuera de la cola ack-gated y de
 * la reconciliación por stateVersion. Ver research D1 (feature 014).
 */
function isRematchEvent(event: MatchWsEvent): boolean {
  const type: string = event.eventType;
  return (
    type === 'REMATCH_AVAILABLE' ||
    type === 'REMATCH_OPPONENT_WANTS' ||
    type === 'REMATCH_CONFIRMED' ||
    type === 'REMATCH_CLOSED_BY_LEAVE' ||
    type === 'REMATCH_EXPIRED'
  );
}

@Injectable()
export class MatchStateService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventQueue = inject(MatchEventQueueService);

  readonly state = signal<MatchState | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<boolean>(false);

  // Offset servidor↔cliente (epochMillis) para corregir el desfase de reloj al
  // calcular el restante del temporizador desde el snapshot REST (feature 013).
  // Se actualiza con el `timestamp` (epochMillis del servidor) de cada evento WS.
  private readonly _serverClockOffsetMs = signal<number>(0);
  readonly serverClockOffsetMs = this._serverClockOffsetMs.asReadonly();
  readonly matchEvent$ = new Subject<MatchWsEvent>();
  readonly matchEnded$ = new Subject<MatchEndedEvent>();
  readonly gameWon$ = new Subject<GameWonPayload>();
  readonly envidoResolved$ = new Subject<EnvidoResolvedPayload>();
  /** Canal dedicado para eventos REMATCH_*. Fuera de la cola ack-gated y de stateVersion. */
  readonly rematch$ = new Subject<MatchWsEvent>();

  private lastApplied = 0;
  private lastSeenVersion = 0;
  private buffer: MatchWsEvent[] = [];
  private derivedBuffer: MatchDerivedEvent[] = [];
  private subscriptions: Subscription[] = [];
  private currentMatchId: string | null = null;
  private wasConnected = false;

  init(matchId: string): void {
    this.currentMatchId = matchId;
    this.loading.set(true);
    this.error.set(false);
    this.state.set(null);
    this.lastApplied = 0;
    this.lastSeenVersion = 0;
    this.buffer = [];
    this.derivedBuffer = [];

    this.unsubscribeAll();
    this.eventQueue.clear();

    this.eventQueue.init({
      getViewerSeat: () => this.state()?.viewerSeat ?? null,
      applyTransactional: (e) => this.applyAndIncrement(e),
      applyDerived: (e) => this.applyDerivedEvent(e),
    });

    // Establece la conexión WebSocket si no está activa
    this.wsService.connect();

    // Subscribe to WS channels BEFORE the GET to avoid losing events
    const matchSub = this.wsService.subscribe<MatchWsEvent>('/user/queue/match').subscribe((event) => {
      this.updateServerClockOffset(event.timestamp);
      // Los eventos de revancha se rutean por canal dedicado: fuera de la cola
      // ack-gated y de la reconciliación por stateVersion (research D1, feature 014).
      if (isRematchEvent(event)) {
        this.rematch$.next(event);
        return;
      }
      // Los eventos del temporizador viajan por /user/queue/match pero con
      // stateVersion null: se tratan como derivados (no avanzan stateVersion ni
      // disparan detección de huecos). Ver docs/CONTRATOS_API.md §9.5 (research D1).
      if (isTimerEvent(event)) {
        const derived = event as unknown as MatchDerivedEvent;
        if (this.loading()) {
          this.derivedBuffer.push(derived);
        } else {
          this.processLiveDerivedEvent(derived);
        }
        return;
      }
      if (this.loading()) {
        this.buffer.push(event);
      } else {
        this.processLiveEvent(event);
      }
    });

    const derivedSub = this.wsService.subscribe<MatchDerivedEvent>('/user/queue/match-derived').subscribe((event) => {
      this.updateServerClockOffset(event.timestamp);
      // El backend puede enviar REMATCH_* por match-derived en lugar de match.
      // Ambos canales los redirigen al canal dedicado (research D1, feature 014).
      if (isRematchEvent(event as unknown as MatchWsEvent)) {
        this.rematch$.next(event as unknown as MatchWsEvent);
        return;
      }
      if (this.loading()) {
        this.derivedBuffer.push(event);
      } else {
        this.processLiveDerivedEvent(event);
      }
    });

    this.subscriptions.push(matchSub, derivedSub);

    // Fetch initial state
    this.fetchSnapshot(matchId);

    // Watch for reconnections
    const connSub = this.wsService.connected.subscribe((isConnected) => {
      if (!this.wasConnected && isConnected && this.currentMatchId) {
        // First connection - no-op, bootstrap handles it
      } else if (this.wasConnected && !isConnected) {
        // Disconnected - will reconnect automatically
      } else if (this.wasConnected && isConnected && !this.loading() && this.currentMatchId) {
        // Reconnected after being disconnected - re-bootstrap
        this.eventQueue.flushImmediately();
        this.loading.set(true);
        this.error.set(false);
        this.buffer = [];
        this.derivedBuffer = [];
        this.fetchSnapshot(this.currentMatchId);
      }
      this.wasConnected = isConnected || this.wasConnected;
    });

    this.subscriptions.push(connSub);
  }

  destroy(): void {
    this.eventQueue.clear();
    this.unsubscribeAll();
    this.matchEvent$.complete();
    this.matchEnded$.complete();
    this.gameWon$.complete();
    this.envidoResolved$.complete();
    this.rematch$.complete();
    this.currentMatchId = null;
  }

  private fetchSnapshot(matchId: string): void {
    const url = `${environment.apiUrl}/matches/${matchId}`;
    const sub = this.http.get<MatchSnapshot>(url).subscribe({
      next: (snapshot) => {
        this.state.set(snapshot);
        this.lastApplied = snapshot.stateVersion;
        this.lastSeenVersion = snapshot.stateVersion;
        this.drainBuffers();
        this.loading.set(false);

        // If match already finished, emit match ended
        if (snapshot.status === 'FINISHED') {
          this.emitMatchEndedFromState(snapshot);
        }
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
    this.subscriptions.push(sub);
  }

  private drainBuffers(): void {
    // Drain transactional buffer
    this.buffer.sort((a, b) => a.stateVersion - b.stateVersion);
    for (const event of this.buffer) {
      if (event.stateVersion <= this.lastApplied) {
        continue;
      }
      if (event.stateVersion === this.lastApplied + 1) {
        this.applyAndIncrement(event);
        this.lastSeenVersion = event.stateVersion;
      } else {
        // Gap detected - re-fetch
        this.triggerRefetch();
        return;
      }
    }
    this.buffer = [];

    // Drain derived buffer
    for (const event of this.derivedBuffer) {
      this.applyDerivedEvent(event);
    }
    this.derivedBuffer = [];
  }

  private processLiveEvent(event: MatchWsEvent): void {
    if (event.stateVersion <= this.lastSeenVersion) {
      // Duplicate or old event - discard
      return;
    }
    if (event.stateVersion === this.lastSeenVersion + 1) {
      this.lastSeenVersion = event.stateVersion;
      this.eventQueue.enqueueTransactional(event);
    } else {
      // Gap detected - re-fetch
      this.triggerRefetch();
    }
  }

  private updateServerClockOffset(eventTimestamp: number): void {
    if (typeof eventTimestamp === 'number' && Number.isFinite(eventTimestamp)) {
      this._serverClockOffsetMs.set(eventTimestamp - Date.now());
    }
  }

  private processLiveDerivedEvent(event: MatchDerivedEvent): void {
    // La cola retrasa el momento del Subject.next pero no afecta a los
    // consumidores (p. ej. AvailableActionsService): siguen suscritos a los
    // mismos Observables y reciben los eventos en el orden causal correcto.
    this.eventQueue.enqueueDerived(event);
  }

  private applyAndIncrement(event: MatchWsEvent): void {
    const current = this.state();
    if (!current) {return;}

    const next = applyMatchEvent(current, event);
    this.state.set(next);
    this.lastApplied = event.stateVersion;
    this.matchEvent$.next(event);

    if (
      event.eventType === 'MATCH_FINISHED' ||
      event.eventType === 'MATCH_ABANDONED' ||
      event.eventType === 'MATCH_FORFEITED'
    ) {
      this.emitMatchEnded(event);
    }

    if (event.eventType === 'GAME_SCORE_CHANGED') {
      const payload = event.payload as GameScoreChangedPayload;
      if (payload.gamesWonPlayerOne > current.gamesWonPlayerOne) {
        this.gameWon$.next({ winnerSeat: 'PLAYER_ONE' });
      } else if (payload.gamesWonPlayerTwo > current.gamesWonPlayerTwo) {
        this.gameWon$.next({ winnerSeat: 'PLAYER_TWO' });
      }
    }

    if (event.eventType === 'ENVIDO_RESOLVED') {
      this.envidoResolved$.next(event.payload as EnvidoResolvedPayload);
    }
  }

  private applyDerivedEvent(event: MatchDerivedEvent): void {
    const current = this.state();
    if (!current) {return;}
    const next = applyMatchDerivedEvent(current, event);
    this.state.set(next);
  }

  private triggerRefetch(): void {
    if (!this.currentMatchId || this.loading()) {return;}
    this.loading.set(true);
    this.buffer = [];
    this.derivedBuffer = [];
    this.eventQueue.clear();
    this.lastSeenVersion = this.lastApplied;
    this.fetchSnapshot(this.currentMatchId);
  }

  private emitMatchEnded(event: MatchWsEvent): void {
    const payload = event.payload as { winnerSeat: 'PLAYER_ONE' | 'PLAYER_TWO'; gamesWonPlayerOne: number; gamesWonPlayerTwo: number };
    const reason: MatchEndedEvent['reason'] =
      event.eventType === 'MATCH_FINISHED'
        ? 'FINISHED'
        : event.eventType === 'MATCH_ABANDONED'
          ? 'ABANDONED'
          : 'FORFEITED';

    this.matchEnded$.next({
      winnerSeat: payload.winnerSeat,
      gamesWonPlayerOne: payload.gamesWonPlayerOne,
      gamesWonPlayerTwo: payload.gamesWonPlayerTwo,
      reason,
    });
  }

  private emitMatchEndedFromState(state: MatchState): void {
    // When loading an already-finished match, we don't know the exact reason
    // Default to FINISHED; this is an edge case
    const winnerSeat: 'PLAYER_ONE' | 'PLAYER_TWO' =
      state.matchWinner === state.playerOneUsername
        ? 'PLAYER_ONE'
        : 'PLAYER_TWO';

    this.matchEnded$.next({
      winnerSeat,
      gamesWonPlayerOne: state.gamesWonPlayerOne,
      gamesWonPlayerTwo: state.gamesWonPlayerTwo,
      reason: 'FINISHED',
    });
  }

  private unsubscribeAll(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
  }
}
