import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, finalize, map, shareReplay, tap } from 'rxjs';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { FullAuthResponse } from '../models/auth.models';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthRefreshService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private refreshInFlight$: Observable<string> | null = null;

  refresh(): Observable<string> {
    const currentRefreshToken = this.authStore.refreshToken();

    if (!currentRefreshToken) {
      this.authStore.clearSession();
      return EMPTY;
    }

    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    this.refreshInFlight$ = this.http
      .post<FullAuthResponse>(`${this.baseUrl}/refresh`, { refreshToken: currentRefreshToken })
      .pipe(
        tap((response) => {
          this.authStore.replaceSession(response);
        }),
        map((response) => response.accessToken),
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
      );

    return this.refreshInFlight$;
  }
}
