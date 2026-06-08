import { Injectable, inject } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { Subject, Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/auth.store';
import { AuthRefreshService } from '../auth/auth-refresh.service';
import { ACCESS_TOKEN_REFRESH_SKEW_MS } from '../auth/auth.tokens';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly authRefreshService = inject(AuthRefreshService);
  private client!: Client;
  private readonly connected$ = new Subject<boolean>();
  private refreshBeforeConnectInFlight: Promise<void> | null = null;

  readonly connected = this.connected$.asObservable();

  connect(): void {
    if (this.client?.active) {
      return;
    }

    this.client = new Client({
      brokerURL: this.buildBrokerUrl(),
      connectHeaders: this.buildConnectHeaders(),
      beforeConnect: async () => {
        await this.refreshAccessTokenBeforeConnect();
        this.client.connectHeaders = this.buildConnectHeaders();
      },
      reconnectDelay: 5000,
      debug: () => undefined,
      onConnect: () => {
        this.connected$.next(true);
      },
      onDisconnect: () => {
        this.connected$.next(false);
      },
      onStompError: (frame) => {
        if (this.isAuthenticationFrame(frame.headers['message'], frame.body)) {
          this.recoverAuthenticationError();
          return;
        }

        console.error('STOMP error — message:', frame.headers['message'], '| body:', frame.body);
        this.connected$.next(false);
      },
      onWebSocketError: (evt) => {
        console.error('WS error', evt);
      },
      onWebSocketClose: (evt) => {
        console.warn(
          'WS closed — code:',
          (evt as CloseEvent).code,
          'reason:',
          (evt as CloseEvent).reason,
        );
      },
    });

    this.client.activate();
  }

  private buildConnectHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.authStore.accessToken() ?? ''}`,
    };
  }

  private shouldRefreshBeforeConnect(): boolean {
    const token = this.authStore.accessToken();
    const expiresAt = this.authStore.accessTokenExpiresAt();

    if (!token || !this.authStore.refreshToken()) {
      return false;
    }

    return expiresAt === null || Date.now() >= expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS;
  }

  private isAccessTokenExpiredForConnect(): boolean {
    const token = this.authStore.accessToken();
    const expiresAt = this.authStore.accessTokenExpiresAt();

    return !!token && expiresAt !== null && Date.now() >= expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS;
  }

  private refreshAccessTokenBeforeConnect(force = false): Promise<void> {
    if (!this.authStore.refreshToken() && this.isAccessTokenExpiredForConnect()) {
      this.authStore.clearSession();
      return Promise.reject(new Error('Access token expired without refresh token'));
    }

    if (!force && !this.shouldRefreshBeforeConnect()) {
      return Promise.resolve();
    }

    if (!this.authStore.refreshToken()) {
      this.authStore.clearSession();
      return Promise.reject(new Error('Refresh token unavailable'));
    }

    if (this.refreshBeforeConnectInFlight) {
      return this.refreshBeforeConnectInFlight;
    }

    this.refreshBeforeConnectInFlight = firstValueFrom(this.authRefreshService.refresh()).then(
      () => undefined,
    );

    return this.refreshBeforeConnectInFlight.finally(() => {
      this.refreshBeforeConnectInFlight = null;
    });
  }

  private isAuthenticationFrame(message: string | undefined, body: string | undefined): boolean {
    const text = `${message ?? ''} ${body ?? ''}`.toLowerCase();
    return (
      text.includes('unauthorized') ||
      text.includes('authentication') ||
      text.includes('token') ||
      text.includes('jwt')
    );
  }

  private recoverAuthenticationError(): void {
    this.connected$.next(false);

    void this.refreshAccessTokenBeforeConnect(true)
      .then(() => this.reconnect())
      .catch(() => {
        this.authStore.clearSession();
        this.disconnect();
      });
  }

  private reconnect(): void {
    if (!this.client) {
      return;
    }

    void this.client.deactivate().then(() => {
      this.client.connectHeaders = this.buildConnectHeaders();
      this.client.activate();
    });
  }

  private buildBrokerUrl(): string {
    const baseUrl = new URL(environment.wsUrl, window.location.origin);
    baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    return baseUrl.toString();
  }

  disconnect(): void {
    if (this.client?.active) {
      this.client.deactivate();
    }
  }

  subscribe<T>(destination: string, headers?: Record<string, string>): Observable<T> {
    return new Observable<T>((observer) => {
      let subscription: StompSubscription | undefined;

      const doSubscribe = (): void => {
        subscription?.unsubscribe();
        subscription = this.client.subscribe(
          destination,
          (message: IMessage) => {
            try {
              observer.next(JSON.parse(message.body) as T);
            } catch {
              console.error('Error parsing STOMP message', message.body);
            }
          },
          headers,
        );
      };

      if (this.client?.connected) {
        doSubscribe();
      }

      const connSub = this.connected.subscribe((isConnected) => {
        if (isConnected) {
          doSubscribe();
        } else {
          subscription?.unsubscribe();
          subscription = undefined;
        }
      });

      return () => {
        connSub.unsubscribe();
        subscription?.unsubscribe();
      };
    });
  }

  publish(destination: string, body: unknown): void {
    if (!this.client?.connected) {
      console.warn('WebSocket no conectado. Mensaje descartado:', destination);
      return;
    }
    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.connected$.complete();
  }
}
