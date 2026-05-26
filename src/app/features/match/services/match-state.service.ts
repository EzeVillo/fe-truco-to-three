import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import type { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WebSocketService } from '../../../core/services/websocket.service';
import type { MatchState } from '../../../core/models/match.models';
import type { MatchWsEvent, MatchDerivedEvent, MatchEndedEvent, RoundEndedPayload, EnvidoResolvedPayload } from '../models/match-ws-events';
import { applyMatchEvent, applyMatchDerivedEvent } from '../reducers/match-event.reducer';

interface MatchSnapshot extends MatchState {
  stateVersion: number;
}

@Injectable()
export class MatchStateService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<MatchState | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<boolean>(false);
  readonly matchEnded$ = new Subject<MatchEndedEvent>();
  readonly roundEnded$ = new Subject<RoundEndedPayload>();
  readonly envidoResolved$ = new Subject<EnvidoResolvedPayload>();

  private lastApplied = 0;
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
    this.buffer = [];
    this.derivedBuffer = [];

    this.unsubscribeAll();

    // Establece la conexión WebSocket si no está activa
    this.wsService.connect();

    // Subscribe to WS channels BEFORE the GET to avoid losing events
    const matchSub = this.wsService.subscribe<MatchWsEvent>('/user/queue/match').subscribe((event) => {
      if (this.loading()) {
        this.buffer.push(event);
      } else {
        this.processLiveEvent(event);
      }
    });

    const derivedSub = this.wsService.subscribe<MatchDerivedEvent>('/user/queue/match-derived').subscribe((event) => {
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
        this.loading.set(true);
        this.error.set(false);
        this.buffer = [];
        this.derivedBuffer = [];
        this.fetchSnapshot(this.currentMatchId);
      }
      this.wasConnected = isConnected;
    });

    this.subscriptions.push(connSub);
  }

  destroy(): void {
    this.unsubscribeAll();
    this.matchEnded$.complete();
    this.roundEnded$.complete();
    this.envidoResolved$.complete();
    this.currentMatchId = null;
  }

  private fetchSnapshot(matchId: string): void {
    const url = `${environment.apiUrl}/matches/${matchId}`;
    const sub = this.http.get<MatchSnapshot>(url).subscribe({
      next: (snapshot) => {
        this.state.set(snapshot);
        this.lastApplied = snapshot.stateVersion;
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
    if (event.stateVersion <= this.lastApplied) {
      // Duplicate or old event - discard
      return;
    }
    if (event.stateVersion === this.lastApplied + 1) {
      this.applyAndIncrement(event);
    } else {
      // Gap detected - re-fetch
      this.triggerRefetch();
    }
  }

  private processLiveDerivedEvent(event: MatchDerivedEvent): void {
    this.applyDerivedEvent(event);
  }

  private applyAndIncrement(event: MatchWsEvent): void {
    const current = this.state();
    if (!current) {return;}

    const next = applyMatchEvent(current, event);
    this.state.set(next);
    this.lastApplied = event.stateVersion;

    if (
      event.eventType === 'MATCH_FINISHED' ||
      event.eventType === 'MATCH_ABANDONED' ||
      event.eventType === 'MATCH_FORFEITED'
    ) {
      this.emitMatchEnded(event);
    }

    if (event.eventType === 'ROUND_ENDED') {
      this.roundEnded$.next(event.payload as RoundEndedPayload);
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
