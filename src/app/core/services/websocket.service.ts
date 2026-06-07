import { Injectable, inject } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/auth.store';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private readonly authStore = inject(AuthStore);
  private client!: Client;
  private readonly connected$ = new Subject<boolean>();

  readonly connected = this.connected$.asObservable();

  connect(): void {
    if (this.client?.active) {
      return;
    }

    this.client = new Client({
      brokerURL: this.buildBrokerUrl(),
      connectHeaders: this.buildConnectHeaders(),
      beforeConnect: () => {
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
      let subscription: StompSubscription;

      const doSubscribe = (): void => {
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
      } else {
        const connSub = this.connected.subscribe((isConnected) => {
          if (isConnected) {
            doSubscribe();
            connSub.unsubscribe();
          }
        });
      }

      return () => {
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
