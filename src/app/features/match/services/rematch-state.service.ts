import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { Subscription } from 'rxjs';
import type { ViewerSeat } from '../../../core/models/match.models';
import type { RematchSession, RematchChoice, RematchSessionResponse } from '../models/rematch.models';
import type {
  RematchAvailablePayload,
  RematchOpponentWantsPayload,
  RematchConfirmedPayload,
  RematchClosedByLeavePayload,
} from '../models/match-ws-events';
import { getErrorCopy } from '../../../shared/error-copy/error-copy';
import { RematchApiService } from './rematch-api.service';
import { MatchStateService } from './match-state.service';

@Injectable()
export class RematchStateService {
  private readonly api = inject(RematchApiService);
  private readonly matchState = inject(MatchStateService);

  readonly session = signal<RematchSession | null>(null);
  readonly errorMessage = signal<string>('');

  private matchId: string | null = null;
  private viewerSeat: ViewerSeat | null = null;
  private rematchSub: Subscription | null = null;

  /** Inicializa con snapshot REST y suscribe al canal rematch$. */
  init(matchId: string, viewerSeat: ViewerSeat): void {
    this.matchId = matchId;
    this.viewerSeat = viewerSeat;
    this.session.set(null);
    this.errorMessage.set('');

    this.rematchSub?.unsubscribe();
    this.rematchSub = this.matchState.rematch$.subscribe((event) => {
      this.handleRematchEvent(event.eventType, event.payload);
    });

    this.api.getSession(matchId).subscribe({
      next: (dto) => {
        const self: RematchChoice =
          viewerSeat === 'PLAYER_ONE' ? dto.playerOneChoice : dto.playerTwoChoice;
        const opponent: RematchChoice =
          viewerSeat === 'PLAYER_ONE' ? dto.playerTwoChoice : dto.playerOneChoice;

        this.session.set({
          sessionId: dto.sessionId,
          originMatchId: dto.originMatchId,
          status: dto.status,
          selfChoice: self,
          opponentChoice: opponent,
          expiresAt: Date.parse(dto.expiresAt),
          resultMatchId: dto.resultMatchId,
        });
      },
      error: () => {
        // 404 = sin sesión de revancha → session permanece null
        this.session.set(null);
      },
    });
  }

  /**
   * Inicializa la sesión directamente desde un DTO REST (sin llamar getSession).
   * Usado para resolver la carrera en afterClosed del modal de resultado (D3).
   */
  initFromDto(dto: RematchSessionResponse, viewerSeat: ViewerSeat): void {
    const self: RematchChoice =
      viewerSeat === 'PLAYER_ONE' ? dto.playerOneChoice : dto.playerTwoChoice;
    const opponent: RematchChoice =
      viewerSeat === 'PLAYER_ONE' ? dto.playerTwoChoice : dto.playerOneChoice;

    this.session.set({
      sessionId: dto.sessionId,
      originMatchId: dto.originMatchId,
      status: dto.status,
      selfChoice: self,
      opponentChoice: opponent,
      expiresAt: Date.parse(dto.expiresAt),
      resultMatchId: dto.resultMatchId,
    });
  }

  /** Limpia el estado al navegar a un nuevo matchId. */
  reset(): void {
    this.rematchSub?.unsubscribe();
    this.rematchSub = null;
    this.session.set(null);
    this.errorMessage.set('');
    this.matchId = null;
    this.viewerSeat = null;
  }

  /** Acepta la revancha (optimista). Llama POST …/rematch/choose. */
  accept(): void {
    if (!this.matchId) {return;}
    const prev = this.session();
    if (!prev || prev.status !== 'OPEN') {return;}

    this.session.update((s) => s && { ...s, selfChoice: 'WANTS_REMATCH' });

    this.api.choose(this.matchId).subscribe({
      error: (err: unknown) => {
        this.session.set(prev);
        this.errorMessage.set(getErrorCopy('REMATCH', err));
      },
    });
  }

  /** Abandona la sesión de revancha (optimista). Llama POST …/rematch/leave. */
  leave(): void {
    if (!this.matchId) {return;}
    const prev = this.session();

    this.session.update((s) =>
      s ? { ...s, status: 'CLOSED_BY_LEAVE', selfChoice: 'LEFT' } : null,
    );

    this.api.leave(this.matchId).subscribe({
      error: (err: unknown) => {
        this.session.set(prev);
        this.errorMessage.set(getErrorCopy('REMATCH', err instanceof HttpErrorResponse ? err : err));
      },
    });
  }

  private handleRematchEvent(eventType: string, payload: unknown): void {
    switch (eventType) {
      case 'REMATCH_AVAILABLE': {
        const p = payload as RematchAvailablePayload;
        this.session.set({
          sessionId: p.sessionId,
          originMatchId: p.originMatchId,
          status: 'OPEN',
          selfChoice: 'UNDECIDED',
          opponentChoice: 'UNDECIDED',
          expiresAt: p.expiresAt,
          resultMatchId: null,
        });
        break;
      }
      case 'REMATCH_OPPONENT_WANTS': {
        const _p = payload as RematchOpponentWantsPayload;
        void _p;
        this.session.update((s) => s && { ...s, opponentChoice: 'WANTS_REMATCH' });
        break;
      }
      case 'REMATCH_CONFIRMED': {
        const p = payload as RematchConfirmedPayload;
        this.session.update((s) => s && { ...s, status: 'CONFIRMED', resultMatchId: p.newMatchId });
        break;
      }
      case 'REMATCH_CLOSED_BY_LEAVE': {
        const _p = payload as RematchClosedByLeavePayload;
        void _p;
        this.session.update((s) => s && { ...s, status: 'CLOSED_BY_LEAVE', opponentChoice: 'LEFT' });
        break;
      }
      case 'REMATCH_EXPIRED': {
        this.session.update((s) => s && { ...s, status: 'EXPIRED' });
        break;
      }
    }
  }
}
