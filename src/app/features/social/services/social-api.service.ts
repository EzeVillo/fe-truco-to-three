import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CreateFriendshipRequestPayload,
  FriendSummary,
  IncomingFriendshipRequest,
  OutgoingFriendshipRequest,
} from '../../../core/models/social.models';

/**
 * Capa REST de la feature social (amistades) — feature 024-friends-system.
 * Paths y formas de respuesta: docs/CONTRATOS_API.md §7.5 y §8.2.
 *
 * Las acciones (send/accept/decline/cancel/remove) responden 204 sin body.
 * El otro jugador se identifica siempre por `username`.
 */
@Injectable({ providedIn: 'root' })
export class SocialApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  listFriends(): Observable<FriendSummary[]> {
    return this.http.get<FriendSummary[]>(`${this.baseUrl}/social/friendships`);
  }

  listIncoming(): Observable<IncomingFriendshipRequest[]> {
    return this.http.get<IncomingFriendshipRequest[]>(
      `${this.baseUrl}/social/friendship-requests/incoming`,
    );
  }

  listOutgoing(): Observable<OutgoingFriendshipRequest[]> {
    return this.http.get<OutgoingFriendshipRequest[]>(
      `${this.baseUrl}/social/friendship-requests/outgoing`,
    );
  }

  sendRequest(username: string): Observable<void> {
    const body: CreateFriendshipRequestPayload = { username };
    return this.http.post<void>(`${this.baseUrl}/social/friendship-requests`, body);
  }

  acceptRequest(username: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/social/friendship-requests/${encodeURIComponent(username)}/accept`,
      null,
    );
  }

  declineRequest(username: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/social/friendship-requests/${encodeURIComponent(username)}/decline`,
      null,
    );
  }

  cancelRequest(username: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/social/friendship-requests/${encodeURIComponent(username)}/cancel`,
      null,
    );
  }

  removeFriend(username: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/social/friendships/${encodeURIComponent(username)}`,
    );
  }
}
