import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { RematchSessionResponse } from '../models/rematch.models';

/** Servicio fino sin estado para los 3 endpoints de revancha (§4.17). */
@Injectable({ providedIn: 'root' })
export class RematchApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/matches`;

  /** §4.17.1 POST /api/matches/{matchId}/rematch/choose — 204 sin body. */
  choose(matchId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${matchId}/rematch/choose`, null);
  }

  /** §4.17.2 POST /api/matches/{matchId}/rematch/leave — 204 sin body. */
  leave(matchId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${matchId}/rematch/leave`, null);
  }

  /** §4.17.3 GET /api/matches/{matchId}/rematch. Retorna el DTO crudo; normalizar expiresAt en RematchStateService. */
  getSession(matchId: string): Observable<RematchSessionResponse> {
    return this.http.get<RematchSessionResponse>(`${this.base}/${matchId}/rematch`);
  }
}
