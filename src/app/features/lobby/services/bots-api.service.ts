import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { BotCatalog } from '../../../core/models/bot.models';
import type {
  CreateBotMatchRequest,
  CreateBotMatchResponse,
} from '../../../core/models/match.models';

@Injectable({ providedIn: 'root' })
export class BotsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getBots(): Observable<BotCatalog> {
    return this.http.get<BotCatalog>(`${this.baseUrl}/bots`);
  }

  createBotMatch(req: CreateBotMatchRequest): Observable<CreateBotMatchResponse> {
    return this.http.post<CreateBotMatchResponse>(`${this.baseUrl}/matches/bot`, req);
  }
}
