import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AchievementsCatalogResponse,
  PlayerProfile,
} from '../../../core/models/profile.models';

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getProfile(username: string): Observable<PlayerProfile> {
    return this.http.get<PlayerProfile>(`${this.baseUrl}/profile/${encodeURIComponent(username)}`);
  }

  getAchievementsCatalog(): Observable<AchievementsCatalogResponse> {
    return this.http.get<AchievementsCatalogResponse>(`${this.baseUrl}/achievements`);
  }
}
