import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError } from 'rxjs';
import type { Subscription } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import {
  derivePresenceDestination,
  type PresenceDestination,
  type PresenceWsEvent,
  type UserPresenceResponse,
} from '../models/presence.models';
import { WebSocketService } from './websocket.service';
import { PresenceApiService } from './presence-api.service';

const PRESENCE_QUEUE = '/user/queue/presence';

/**
 * Estado del bootstrap REST de presencia (`GET /me/presence`).
 *
 * - `idle`    : no aplica (todavía no arrancó o no hay sesión autenticada).
 * - `loading` : el fetch inicial está en curso.
 * - `ready`   : ya llegó la primera presencia (REST o PRESENCE_UPDATED).
 * - `error`   : el fetch inicial falló.
 */
export type PresenceBootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class PresenceCoordinatorService {
  private readonly authStore = inject(AuthStore);
  private readonly api = inject(PresenceApiService);
  private readonly router = inject(Router);
  private readonly webSocket = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly started = signal(false);
  private active = false;
  private bootstrapSub: Subscription | null = null;
  private presenceSub: Subscription | null = null;
  private lastDestinationKey: string | null = null;

  /** Última presencia conocida (bootstrap REST o PRESENCE_UPDATED). null hasta el primer fetch. */
  private readonly _presence = signal<UserPresenceResponse | null>(null);
  readonly presence = this._presence.asReadonly();
  readonly busy = computed(() => this._presence()?.busy === true);

  /** Estado del fetch inicial de presencia. */
  private readonly _bootstrapStatus = signal<PresenceBootstrapStatus>('idle');
  readonly bootstrapStatus = this._bootstrapStatus.asReadonly();

  /**
   * Latcheado: una vez que el bootstrap respondió OK queda `true` para siempre
   * (dentro del ciclo de vida de la app). El `<router-outlet>` se monta con esto;
   * si se apagara durante un re-fetch se destruiría toda la app (partida incluida).
   */
  private readonly _everReady = signal(false);

  /**
   * La app puede mostrarse cuando la presencia no está bloqueando: o no aplica
   * (sin sesión) o ya cargó al menos una vez.
   */
  readonly appReady = computed(() => this._bootstrapStatus() === 'idle' || this._everReady());

  /** La overlay de carga tapa la app mientras el fetch inicial corre o falló. */
  readonly bootstrapOverlayVisible = computed(
    () => this._bootstrapStatus() === 'loading' || this._bootstrapStatus() === 'error',
  );

  constructor() {
    effect(() => {
      if (!this.started()) {
        return;
      }

      if (this.authStore.isAuthenticated()) {
        this.ensureActive();
      } else {
        this.stopActive();
      }
    });

    this.destroyRef.onDestroy(() => this.stopActive());
  }

  start(): void {
    if (this.started()) {
      return;
    }

    this.started.set(true);
    if (this.authStore.isAuthenticated()) {
      this.ensureActive();
    }
  }

  private ensureActive(): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.bootstrapPresence();
    this.subscribeToPresence();
  }

  private stopActive(): void {
    this.bootstrapSub?.unsubscribe();
    this.bootstrapSub = null;
    this.presenceSub?.unsubscribe();
    this.presenceSub = null;
    this.active = false;
    this.lastDestinationKey = null;
    this._presence.set(null);
    this._bootstrapStatus.set('idle');
  }

  /** Reintento manual desde la overlay tras un `error` en el fetch inicial. */
  retryBootstrap(): void {
    if (this._bootstrapStatus() === 'loading') {
      return;
    }

    this.bootstrapPresence();
  }

  private bootstrapPresence(): void {
    this.bootstrapSub?.unsubscribe();
    this._bootstrapStatus.set('loading');
    this.bootstrapSub = this.api
      .getPresence()
      .pipe(
        catchError(() => {
          this._bootstrapStatus.set('error');
          return EMPTY;
        }),
      )
      .subscribe((presence) => {
        this._bootstrapStatus.set('ready');
        this._everReady.set(true);
        this.handlePresence(presence);
      });
  }

  private subscribeToPresence(): void {
    this.webSocket.connect();
    this.presenceSub?.unsubscribe();
    this.presenceSub = this.webSocket
      .subscribe<PresenceWsEvent>(PRESENCE_QUEUE)
      .subscribe((event) => {
        if (!this.authStore.isAuthenticated()) {
          return;
        }

        if (event.eventType === 'PRESENCE_UPDATED') {
          this.handlePresence(event.payload);
        }
      });
  }

  private handlePresence(presence: UserPresenceResponse): void {
    this._presence.set(presence);
    this.navigateToDestination(derivePresenceDestination(presence));
  }

  private navigateToDestination(destination: PresenceDestination): void {
    const targetUrl = this.targetUrl(destination);
    if (!targetUrl) {
      this.lastDestinationKey = null;
      return;
    }

    const key = `${destination.kind}:${targetUrl}`;
    if (this.lastDestinationKey === key || this.currentPath() === targetUrl) {
      this.lastDestinationKey = key;
      return;
    }

    this.lastDestinationKey = key;
    void this.router.navigateByUrl(targetUrl);
  }

  private targetUrl(destination: PresenceDestination): string | null {
    switch (destination.kind) {
      case 'match':
        return `/match/${destination.matchId}`;
      case 'rematch':
        return `/match/${destination.originMatchId}`;
      case 'spectate':
        return `/spectate/${destination.matchId}`;
      case 'none':
        return null;
    }
  }

  private currentPath(): string {
    return this.router.url.split('?')[0].split('#')[0];
  }
}
