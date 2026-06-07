import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { SpectateMatchState } from '../../../core/models/spectate.models';

/** GET /api/matches/{matchId}/spectate — vista pública del espectador (§4.15). */
@Injectable({ providedIn: 'root' })
export class SpectateApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getSpectate(matchId: string): Observable<SpectateMatchState> {
    return this.http.get<SpectateMatchState>(
      `${this.baseUrl}/matches/${encodeURIComponent(matchId)}/spectate`,
    );
  }
}
