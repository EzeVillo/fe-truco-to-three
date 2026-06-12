import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CampaignResponse,
  CreateCampaignChallengeResponse,
} from '../../../core/models/campaign.models';

/**
 * Servicio REST fino del modo campaña.
 * Fuente del contrato: docs/CONTRATOS_API.md §7.7.
 */
@Injectable({ providedIn: 'root' })
export class CampaignApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** §7.7.1 GET /api/campaign — ranking completo + progreso del jugador. */
  getCampaign(): Observable<CampaignResponse> {
    return this.http.get<CampaignResponse>(`${this.baseUrl}/campaign`);
  }

  /**
   * §7.7.2 POST /api/campaign/challenges — crea el desafío al mejor de 5.
   * Sin `botId` desafía al inmediato superior; con `botId` (solo válido tras
   * alcanzar el #1) desafía a ese rival puntual.
   */
  createChallenge(botId?: string): Observable<CreateCampaignChallengeResponse> {
    const body = botId ? { botId } : {};
    return this.http.post<CreateCampaignChallengeResponse>(
      `${this.baseUrl}/campaign/challenges`,
      body,
    );
  }
}
