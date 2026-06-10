import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, EMPTY, type Observable } from 'rxjs';
import type {
  PlayCardRequest,
  CallEnvidoRequest,
  RespondTrucoRequest,
  RespondEnvidoRequest,
} from '../../../core/models/match.models';
import type { EnvidoCall, TrucoResponse, EnvidoResponse } from '../../../core/models/enums';
import { environment } from '../../../../environments/environment';

/**
 * Servicio fino sin estado interno que dispara las 6 acciones de match
 * contra los endpoints REST del backend (fire-and-forget).
 *
 * Retorna Observable<void> para que el consumidor pueda usar finalize()
 * en anti-doble-tap. Errores 4xx/5xx/timeouts se silencian (solo console.warn).
 * Fuente: docs/CONTRATOS_API.md §4.6 – §4.11
 */
@Injectable({ providedIn: 'root' })
export class MatchActionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/matches`;

  /**
   * Lock optimista: al disparar una acción del jugador se prende y la UI
   * deshabilita TODAS las acciones (cantos, respuestas y cartas) hasta que el
   * backend confirme con un nuevo estado. Cierra la ventana entre el tap y el
   * primer evento WS, donde `availableActions` aún refleja el turno anterior y
   * los flags anti-doble-tap por botón no alcanzan (bloquean solo el mismo botón).
   *
   * Reset (en orden de probabilidad):
   *  - el primer evento transaccional / snapshot que aplica el nuevo estado
   *    (`MatchStateService.clearActionPending()`),
   *  - un error HTTP de la propia request,
   *  - un timeout de seguridad, por si el evento se pierde y no hay re-fetch.
   */
  private readonly _actionPending = signal<boolean>(false);
  readonly actionPending = this._actionPending.asReadonly();
  private pendingTimerId: ReturnType<typeof setTimeout> | null = null;
  private static readonly PENDING_SAFETY_MS = 6000;

  /** §4.7 POST /api/matches/{matchId}/truco */
  callTruco(matchId: string): Observable<void> {
    return this.mutate(`${this.base}/${matchId}/truco`, undefined);
  }

  /** §4.9 POST /api/matches/{matchId}/envido */
  callEnvido(matchId: string, call: EnvidoCall): Observable<void> {
    return this.mutate<CallEnvidoRequest>(`${this.base}/${matchId}/envido`, { call });
  }

  /** §4.8 POST /api/matches/{matchId}/truco/respond */
  respondTruco(matchId: string, response: TrucoResponse): Observable<void> {
    return this.mutate<RespondTrucoRequest>(`${this.base}/${matchId}/truco/respond`, { response });
  }

  /** §4.10 POST /api/matches/{matchId}/envido/respond */
  respondEnvido(matchId: string, response: EnvidoResponse): Observable<void> {
    return this.mutate<RespondEnvidoRequest>(`${this.base}/${matchId}/envido/respond`, {
      response,
    });
  }

  /** §4.11 POST /api/matches/{matchId}/fold */
  fold(matchId: string): Observable<void> {
    return this.mutate(`${this.base}/${matchId}/fold`, undefined);
  }

  /** §4.6 POST /api/matches/{matchId}/play-card */
  playCard(matchId: string, request: PlayCardRequest): Observable<void> {
    return this.mutate<PlayCardRequest>(`${this.base}/${matchId}/play-card`, request);
  }

  /**
   * §4.12 POST /api/matches/{matchId}/abandon
   *
   * Prende el lock optimista igual que una acción de juego: abandonar congela
   * el tablero (cartas + cantos + respuestas) en el acto, cerrando la ventana
   * entre el tap de "Abandonar" y el evento MATCH_ABANDONED que abre el modal
   * de derrota. Ante error HTTP se libera el lock (no llegó al backend).
   */
  abandon(matchId: string): Observable<void> {
    this.setActionPending();
    return this.http.post<void>(`${this.base}/${matchId}/abandon`, undefined).pipe(
      catchError((err: unknown) => {
        console.warn('[match-actions] Request failed:', `${this.base}/${matchId}/abandon`, err);
        this.clearActionPending();
        return EMPTY;
      }),
    );
  }

  /** Prende el lock optimista y arma el timeout de seguridad que lo libera. */
  private setActionPending(): void {
    this._actionPending.set(true);
    if (this.pendingTimerId !== null) {
      clearTimeout(this.pendingTimerId);
    }
    this.pendingTimerId = setTimeout(
      () => this.clearActionPending(),
      MatchActionsService.PENDING_SAFETY_MS,
    );
  }

  /** Limpia el lock optimista. Lo llama `MatchStateService` al aplicar nuevo estado. */
  clearActionPending(): void {
    if (this.pendingTimerId !== null) {
      clearTimeout(this.pendingTimerId);
      this.pendingTimerId = null;
    }
    this._actionPending.set(false);
  }

  /**
   * Dispara una acción mutante del jugador prendiendo el lock optimista. Ante
   * error HTTP, lo libera (la acción no llegó al backend, no habrá evento que
   * lo limpie) y silencia el error igual que `post()`.
   */
  private mutate<T>(url: string, body: T | undefined): Observable<void> {
    this.setActionPending();
    return this.http.post<void>(url, body).pipe(
      catchError((err: unknown) => {
        console.warn('[match-actions] Request failed:', url, err);
        this.clearActionPending();
        return EMPTY;
      }),
    );
  }
}
