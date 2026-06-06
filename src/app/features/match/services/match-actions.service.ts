import { Injectable, inject } from '@angular/core';
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

  /** §4.7 POST /api/matches/{matchId}/truco */
  callTruco(matchId: string): Observable<void> {
    return this.post(`${this.base}/${matchId}/truco`, undefined);
  }

  /** §4.9 POST /api/matches/{matchId}/envido */
  callEnvido(matchId: string, call: EnvidoCall): Observable<void> {
    return this.post<CallEnvidoRequest>(`${this.base}/${matchId}/envido`, { call });
  }

  /** §4.8 POST /api/matches/{matchId}/truco/respond */
  respondTruco(matchId: string, response: TrucoResponse): Observable<void> {
    return this.post<RespondTrucoRequest>(`${this.base}/${matchId}/truco/respond`, { response });
  }

  /** §4.10 POST /api/matches/{matchId}/envido/respond */
  respondEnvido(matchId: string, response: EnvidoResponse): Observable<void> {
    return this.post<RespondEnvidoRequest>(`${this.base}/${matchId}/envido/respond`, { response });
  }

  /** §4.11 POST /api/matches/{matchId}/fold */
  fold(matchId: string): Observable<void> {
    return this.post(`${this.base}/${matchId}/fold`, undefined);
  }

  /** §4.6 POST /api/matches/{matchId}/play-card */
  playCard(matchId: string, request: PlayCardRequest): Observable<void> {
    return this.post<PlayCardRequest>(`${this.base}/${matchId}/play-card`, request);
  }

  private post<T>(url: string, body: T | undefined): Observable<void> {
    return this.http.post<void>(url, body).pipe(
      catchError((err: unknown) => {
        console.warn('[match-actions] Request failed:', url, err);
        return EMPTY;
      }),
    );
  }
}
