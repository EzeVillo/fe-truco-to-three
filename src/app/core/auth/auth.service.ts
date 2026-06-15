import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from './auth.store';
import { AuthRefreshService } from './auth-refresh.service';
import { WebSocketService } from '../services/websocket.service';
import type {
  RegisterRequest,
  LoginRequest,
  FullAuthResponse,
  GuestAuthResponse,
  CurrentIdentityResponse,
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly authRefreshService = inject(AuthRefreshService);
  private readonly webSocketService = inject(WebSocketService);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  register(req: RegisterRequest): Observable<FullAuthResponse> {
    return this.http.post<FullAuthResponse>(`${this.baseUrl}/register`, req).pipe(
      tap((response) => {
        this.authStore.setSession(response);
        // El principal cambió (p. ej. de invitado a la cuenta nueva): rebindear el
        // socket para que las colas POR USUARIO de STOMP queden atadas al token nuevo.
        this.webSocketService.rebindCredentials();
      }),
    );
  }

  login(req: LoginRequest): Observable<FullAuthResponse> {
    return this.http.post<FullAuthResponse>(`${this.baseUrl}/login`, req).pipe(
      tap((response) => {
        this.authStore.setSession(response);
        // Mismo motivo que en register: la sesión STOMP previa (invitado/otra cuenta)
        // quedaría atada al principal viejo y no recibiría los eventos del nuevo.
        this.webSocketService.rebindCredentials();
      }),
    );
  }

  guest(): Observable<GuestAuthResponse> {
    return this.http
      .post<GuestAuthResponse>(`${this.baseUrl}/guest`, null)
      .pipe(tap((response) => this.authStore.setSession(response)));
  }

  /**
   * Refresca el accessToken usando el refreshToken del store.
   * Si no hay refreshToken (guest o ANON): emite EMPTY y limpia la sesion.
   * Single-flight: multiples llamadas concurrentes comparten la misma request HTTP.
   */
  refresh(): Observable<string> {
    return this.authRefreshService.refresh();
  }

  me(): Observable<CurrentIdentityResponse> {
    return this.http.get<CurrentIdentityResponse>(`${this.baseUrl}/me`).pipe(
      tap((response) => {
        this.authStore.updateIdentity(response.playerId, response.username, response.tokenUse);
      }),
    );
  }

  rehydrateIdentityIfNeeded(): Observable<CurrentIdentityResponse | null> {
    if (
      !this.authStore.isAuthenticated() ||
      this.authStore.isGuest() ||
      this.authStore.username() !== null
    ) {
      return new Observable<null>((observer) => {
        observer.next(null);
        observer.complete();
      });
    }

    return this.me();
  }

  /**
   * Cierra sesion:
   * 1. Si hay refreshToken, llama DELETE best-effort (sin esperar respuesta).
   * 2. Llama clearSession() siempre.
   * 3. Cierra la conexion WebSocket autenticada (evita reconexiones con el token viejo).
   * 4. Emite void siempre (nunca falla desde el punto de vista del caller).
   */
  logout(): Observable<void> {
    const refreshToken = this.authStore.refreshToken();
    this.authStore.clearSession();
    this.webSocketService.disconnect();

    if (refreshToken) {
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
