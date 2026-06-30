import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { MatchHistoryResponse } from '../../../core/models/match-history.models';

@Injectable({ providedIn: 'root' })
export class MatchHistoryApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Historial del usuario autenticado (sale del token, sin params). Devuelve hasta
   * 5 partidas terminadas, más reciente primero. Guests reciben `entries: []`.
   */
  getHistory(): Observable<MatchHistoryResponse> {
    return this.http.get<MatchHistoryResponse>(`${this.baseUrl}/match-history`);
  }
}
