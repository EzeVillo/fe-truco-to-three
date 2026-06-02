import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CreateMatchRequest,
  CreateMatchResponse,
  JoinResponse,
  QuickMatchRequest,
  QuickMatchResponse,
} from '../../../core/models/match.models';

/**
 * Servicio REST fino para el matchmaking de partidas (no-bot).
 * Fuente del contrato: docs/CONTRATOS_API.md §4.1 (crear), §4.2 (unirse),
 * §4.5 (iniciar), §4.13 (salir antes de comenzar). Feature 015.
 */
@Injectable({ providedIn: 'root' })
export class MatchesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** §4.1 POST /api/matches — crea una partida (MVP: visibility PRIVATE). */
  createPrivateMatch(req: CreateMatchRequest): Observable<CreateMatchResponse> {
    return this.http.post<CreateMatchResponse>(`${this.baseUrl}/matches`, req);
  }

  /** §4.2 POST /api/join/{joinCode} — une al jugador a la partida del código. */
  joinByCode(joinCode: string): Observable<JoinResponse> {
    return this.http.post<JoinResponse>(`${this.baseUrl}/join/${joinCode}`, {});
  }

  /** §4.5 POST /api/matches/{matchId}/start — inicia la partida (anfitrión). 204 sin body. */
  startMatch(matchId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/matches/${matchId}/start`, {});
  }

  /** §4.13 POST /api/matches/{matchId}/leave — sale antes de comenzar. 204 sin body. */
  leaveMatch(matchId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/matches/${matchId}/leave`, {});
  }

  /** §9.3 POST /api/matches/quick - entra o recupera la cola de quick match. */
  enterQuickMatch(req: QuickMatchRequest): Observable<QuickMatchResponse> {
    return this.http.post<QuickMatchResponse>(`${this.baseUrl}/matches/quick`, req);
  }

  /** §9.3 DELETE /api/matches/quick - cancela la busqueda. 204 sin body. */
  cancelQuickMatch(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/matches/quick`);
  }
}
