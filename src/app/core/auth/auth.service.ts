import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, EMPTY, tap, map, shareReplay, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from './auth.store';
import { WebSocketService } from '../services/websocket.service';
import type {
  RegisterRequest,
  LoginRequest,
  FullAuthResponse,
  GuestAuthResponse,
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly webSocketService = inject(WebSocketService);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  /** Observable de refresh en vuelo (single-flight). null = no hay refresh activo. */
  private refreshInFlight$: Observable<string> | null = null;

  register(req: RegisterRequest): Observable<FullAuthResponse> {
    return this.http
      .post<FullAuthResponse>(`${this.baseUrl}/register`, req)
      .pipe(tap((response) => this.authStore.setSession(response)));
  }

  login(req: LoginRequest): Observable<FullAuthResponse> {
    return this.http
      .post<FullAuthResponse>(`${this.baseUrl}/login`, req)
      .pipe(tap((response) => this.authStore.setSession(response)));
  }

  guest(): Observable<GuestAuthResponse> {
    return this.http
      .post<GuestAuthResponse>(`${this.baseUrl}/guest`, null)
      .pipe(tap((response) => this.authStore.setSession(response)));
  }

  /**
   * Refresca el accessToken usando el refreshToken del store.
   * Si no hay refreshToken (guest o ANON): emite EMPTY y limpia la sesión.
   * Single-flight: múltiples llamadas concurrentes comparten la misma request HTTP.
   */
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
          // Rotar tokens en el store antes de reanudar las requests encoladas
          this.authStore.updateAccessToken(
            response.accessToken,
            response.accessTokenExpiresIn,
            response.refreshToken,
          );
        }),
        map((response) => response.accessToken),
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
      );

    return this.refreshInFlight$;
  }

  /**
   * Cierra sesión:
   * 1. Si hay refreshToken → llama DELETE best-effort (sin esperar respuesta).
   * 2. Llama clearSession() siempre.
   * 3. Cierra la conexión WebSocket autenticada (evita reconexiones con el token viejo).
   * 4. Emite void siempre (nunca falla desde el punto de vista del caller).
   */
  logout(): Observable<void> {
    const refreshToken = this.authStore.refreshToken();
    this.authStore.clearSession();
    this.webSocketService.disconnect();

    if (refreshToken) {
      // Best-effort: no esperamos, no propagamos errores
      this.http.delete<void>(`${this.baseUrl}/logout`, { body: { refreshToken } }).subscribe({
        error: () => {
          /* ignorar errores de red en logout */
        },
      });
    }

    return new Observable<void>((observer) => {
      observer.next();
      observer.complete();
    });
  }
}
