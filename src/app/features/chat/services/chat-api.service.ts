import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ChatView, SendMessageResponse } from '../../../core/models/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** GET /api/chats/by-parent/MATCH/{matchId} — bootstrap / reconexión (§7.3). */
  getByParentMatch(matchId: string): Observable<ChatView> {
    return this.http.get<ChatView>(
      `${this.baseUrl}/chats/by-parent/MATCH/${encodeURIComponent(matchId)}`,
    );
  }

  /** POST /api/chats/by-parent/MATCH/{matchId}/messages — enviar mensaje (§7.4). */
  sendToParentMatch(matchId: string, content: string): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>(
      `${this.baseUrl}/chats/by-parent/MATCH/${encodeURIComponent(matchId)}/messages`,
      { content },
    );
  }
}
