import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
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
  }

  private bootstrapPresence(): void {
    this.bootstrapSub?.unsubscribe();
    this.bootstrapSub = this.api
      .getPresence()
      .pipe(catchError(() => EMPTY))
      .subscribe((presence) => this.handlePresence(presence));
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
      case 'none':
        return null;
    }
  }

  private currentPath(): string {
    return this.router.url.split('?')[0].split('#')[0];
  }
}
