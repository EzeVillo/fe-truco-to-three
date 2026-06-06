import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, type Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CreateMatchRequest,
  CreateMatchResponse,
  JoinResponse,
  QuickMatchRequest,
  QuickMatchResponse,
} from '../../../core/models/match.models';
import type { PublicMatchLobbyItem, PublicMatchesPage } from '../models/public-match-lobby.models';

/** Shape crudo de un item de GET /api/matches/public (§4.3), con _links HAL. */
interface RawPublicMatchItem {
  matchId: string;
  host: string;
  gamesToPlay: 1 | 3 | 5;
  totalSlots: number;
  occupiedSlots: number;
  status: PublicMatchLobbyItem['status'];
  _links?: { join?: { href?: string } };
}

interface RawPublicMatchesResponse {
  items: RawPublicMatchItem[];
  _links?: { next?: { href?: string } };
}

/** Extrae el joinCode de `/api/join/{joinCode}`. */
function joinCodeFromHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }
  const segment = href.split('/').filter(Boolean).pop();
  return segment ?? null;
}

/** Extrae el cursor `after` de un href de paginación; null si no hay. */
function cursorFromHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }
  const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('after');
}

/**
 * Servicio REST fino para el matchmaking de partidas (no-bot).
 * Fuente del contrato: docs/CONTRATOS_API.md §4.1 (crear), §4.2 (unirse),
 * §4.5 (iniciar), §4.13 (salir antes de comenzar). Feature 015.
 */
@Injectable({ providedIn: 'root' })
export class MatchesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** §4.1 POST /api/matches — crea una partida (visibility PUBLIC | PRIVATE). */
  createMatch(req: CreateMatchRequest): Observable<CreateMatchResponse> {
    return this.http.post<CreateMatchResponse>(`${this.baseUrl}/matches`, req);
  }

  /** §4.2 POST /api/join/{joinCode} — une al jugador a la partida del código. */
  joinByCode(joinCode: string): Observable<JoinResponse> {
    return this.http.post<JoinResponse>(`${this.baseUrl}/join/${joinCode}`, {});
  }

  /**
   * §4.3 GET /api/matches/public — página cursor-based de partidas públicas
   * abiertas. Normaliza el HAL del backend: `joinCode` desde `_links.join.href`
   * y `nextCursor` desde `_links.next.href` (`?after=`).
   */
  listPublicMatches(limit?: number, after?: string | null): Observable<PublicMatchesPage> {
    let params = new HttpParams();
    if (limit !== undefined) {
      params = params.set('limit', String(limit));
    }
    if (after) {
      params = params.set('after', after);
    }
    return this.http
      .get<RawPublicMatchesResponse>(`${this.baseUrl}/matches/public`, { params })
      .pipe(
        map((res) => ({
          items: res.items.map(
            (raw): PublicMatchLobbyItem => ({
              matchId: raw.matchId,
              host: raw.host,
              gamesToPlay: raw.gamesToPlay,
              totalSlots: raw.totalSlots,
              occupiedSlots: raw.occupiedSlots,
              status: raw.status,
              joinCode: joinCodeFromHref(raw._links?.join?.href),
            }),
          ),
          nextCursor: cursorFromHref(res._links?.next?.href),
        })),
      );
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
