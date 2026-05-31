import { Injectable, Injector, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { Subscription } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import type { ProfileWsEvent, UnlockedAchievement } from '../../../core/models/profile.models';
import { WebSocketService } from '../../../core/services/websocket.service';
import { getAchievementDisplay } from '../utils/achievement-display';

export interface AchievementNotification {
  name: string;
  description: string;
  achievement: UnlockedAchievement;
}

@Injectable({ providedIn: 'root' })
export class ProfileNotificationService {
  private readonly authStore = inject(AuthStore);
  private readonly wsService = inject(WebSocketService);
  private readonly injector = inject(Injector);
  private readonly seenCodes = new Set<string>();
  private readonly unlockedSubject = new Subject<UnlockedAchievement>();
  private subscription: Subscription | null = null;
  private started = false;

  readonly current = signal<AchievementNotification | null>(null);
  readonly achievementUnlocked$ = this.unlockedSubject.asObservable();

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.syncSubscription();

    effect(
      () => {
        this.authStore.isAuthenticated();
        this.authStore.isGuest();
        this.authStore.username();
        this.syncSubscription();
      },
      { injector: this.injector },
    );
  }

  dismiss(): void {
    this.current.set(null);
  }

  private subscribe(): void {
    if (this.subscription) {
      return;
    }

    this.wsService.connect();
    this.subscription = this.wsService
      .subscribe<ProfileWsEvent>('/user/queue/profile')
      .subscribe((event) => this.handleEvent(event));
  }

  private syncSubscription(): void {
    const shouldSubscribe =
      this.authStore.isAuthenticated() &&
      !this.authStore.isGuest() &&
      this.authStore.username() !== null;

    if (shouldSubscribe) {
      this.subscribe();
    } else {
      this.unsubscribe();
      this.current.set(null);
    }
  }

  private unsubscribe(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.seenCodes.clear();
  }

  private handleEvent(event: ProfileWsEvent): void {
    const code = event.payload.achievementCode;
    if (this.seenCodes.has(code)) {
      return;
    }

    this.seenCodes.add(code);
    const display = getAchievementDisplay(code);
    const notification: AchievementNotification = {
      name: display.name,
      description: display.description,
      achievement: event.payload,
    };
    this.current.set(notification);
    this.unlockedSubject.next(event.payload);
  }
}
