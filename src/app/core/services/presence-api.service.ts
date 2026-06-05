import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { UserPresenceResponse } from '../models/presence.models';

@Injectable({ providedIn: 'root' })
export class PresenceApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me/presence`;

  getPresence(): Observable<UserPresenceResponse> {
    return this.http.get<UserPresenceResponse>(this.baseUrl);
  }
}
