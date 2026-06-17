import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { BotCatalog } from '../../../core/models/bot.models';
import type {
  CreateBotMatchRequest,
  CreateBotMatchResponse,
  CreateBotVsBotMatchRequest,
  CreateBotVsBotMatchResponse,
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

  /** §9.2b crea una partida bot-vs-bot que el dueño puede espectar. */
  createBotVsBotMatch(req: CreateBotVsBotMatchRequest): Observable<CreateBotVsBotMatchResponse> {
    return this.http.post<CreateBotVsBotMatchResponse>(`${this.baseUrl}/matches/bot-vs-bot`, req);
  }

  /**
   * §9.2b el creador corta anticipadamente su partida bot-vs-bot en curso
   * (`POST /api/matches/bot-vs-bot/{matchId}/abandon`, respuesta `204`). Endpoint
   * propio de bot-vs-bot, distinto del abandono de partida con humanos (§4.12):
   * la serie termina (un bot gana administrativamente) y se libera la ocupación
   * por autoría del creador. Es idempotente. El evento MATCH_ABANDONED llega por
   * la suscripción de espectador y abre el modal de resultado.
   */
  abandonBotVsBotMatch(matchId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/matches/bot-vs-bot/${matchId}/abandon`, undefined);
  }

  /**
   * §9.2b las partidas bot-vs-bot no avanzan solas: cada llamada ejecuta
   * **exactamente la próxima acción** del bot que tiene que actuar (jugar carta,
   * cantar o responder). El servidor decide qué bot mueve; el cliente no manda
   * ninguno. Respuesta `204`. Solo el creador puede avanzarla (cualquier otro,
   * `422`) y es idempotente: si la serie ya terminó o no hay acción pendiente,
   * devuelve `204` sin avanzar. El nuevo estado llega por el canal de espectador.
   */
  advanceBotVsBotMatch(matchId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/matches/bot-vs-bot/${matchId}/advance`, undefined);
  }
}
