import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, EMPTY, Subject, type Observable } from 'rxjs';
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
   * El lock SOLO se libera con algo del backend (socket o API), nunca por tiempo:
   *  - el evento derivado `AVAILABLE_ACTIONS_UPDATED` para el asiento del viewer
   *    (`MatchStateService.applyDerivedEvent()`), que es cuando `availableActions`
   *    se refresca de verdad — liberarlo antes (en un transaccional como
   *    `CARD_PLAYED`) deja una ventana de flicker con acciones obsoletas;
   *  - eventos que resetean la ronda/partida (`ROUND_STARTED`, `GAME_STARTED`,
   *    `MATCH_*`) como safety net si el derivado no llega;
   *  - el re-fetch del snapshot tras un error de la request (ver `actionError$`),
   *    cuyo snapshot al aplicarse limpia el lock.
   *
   * No hay timeout de seguridad: si el backend tarda, la UI espera congelada en
   * vez de re-habilitar acciones potencialmente obsoletas del turno anterior.
   */
  private readonly _actionPending = signal<boolean>(false);
  readonly actionPending = this._actionPending.asReadonly();

  /**
   * Notifica que una request de acción falló (red/timeout/4xx/5xx). El dueño del
   * estado (`MatchStateService`) reacciona re-fetcheando el snapshot para recargar
   * el match y reconciliar `availableActions`; ese re-fetch libera el lock.
   */
  private readonly _actionError$ = new Subject<void>();
  readonly actionError$ = this._actionError$.asObservable();

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
   * de derrota. Ante error de la request se dispara el re-fetch del snapshot.
   */
  abandon(matchId: string): Observable<void> {
    const url = `${this.base}/${matchId}/abandon`;
    this.setActionPending();
    return this.http
      .post<void>(url, undefined)
      .pipe(catchError((err: unknown) => this.handleActionError(url, err)));
  }

  /** Prende el lock optimista. Solo lo libera el backend (socket o re-fetch). */
  private setActionPending(): void {
    this._actionPending.set(true);
  }

  /** Limpia el lock optimista. Lo llama `MatchStateService` al aplicar nuevo estado. */
  clearActionPending(): void {
    this._actionPending.set(false);
  }

  /**
   * Dispara una acción mutante del jugador prendiendo el lock optimista. Ante
   * error de la request, delega en `handleActionError` (re-fetch del snapshot).
   */
  private mutate<T>(url: string, body: T | undefined): Observable<void> {
    this.setActionPending();
    return this.http
      .post<void>(url, body)
      .pipe(catchError((err: unknown) => this.handleActionError(url, err)));
  }

  /**
   * Maneja el fallo de una request de acción: lo silencia (solo `console.warn`)
   * y emite `actionError$` para que `MatchStateService` re-fetchee el snapshot.
   * No limpia el lock acá a propósito: la UI queda congelada hasta que el snapshot
   * recargado se aplique y lo libere, evitando re-habilitar acciones obsoletas.
   */
  private handleActionError(url: string, err: unknown): Observable<never> {
    console.warn('[match-actions] Request failed:', url, err);
    this._actionError$.next();
    return EMPTY;
  }
}
