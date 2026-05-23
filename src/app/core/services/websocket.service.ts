import { Injectable, OnDestroy, inject } from '@angular/core';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../stores/auth.store';

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
      webSocketFactory: () => new SockJS(environment.wsUrl) as unknown as WebSocket,
      connectHeaders: {
        Authorization: `Bearer ${this.authStore.token() ?? ''}`,
      },
      reconnectDelay: 5000,
      onConnect: () => {
        this.connected$.next(true);
      },
      onDisconnect: () => {
        this.connected$.next(false);
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame);
        this.connected$.next(false);
      },
    });

    this.client.activate();
  }

  disconnect(): void {
    if (this.client?.active) {
      this.client.deactivate();
    }
  }

  subscribe<T>(destination: string): Observable<T> {
    return new Observable<T>((observer) => {
      let subscription: StompSubscription;

      const doSubscribe = (): void => {
        subscription = this.client.subscribe(destination, (message: IMessage) => {
          try {
            observer.next(JSON.parse(message.body) as T);
          } catch {
            console.error('Error parsing STOMP message', message.body);
          }
        });
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
