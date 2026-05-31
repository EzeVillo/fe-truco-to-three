import { Component, DestroyRef, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthStore } from '../../../../core/auth/auth.store';
import type { PlayerProfile, UnlockedAchievement } from '../../../../core/models/profile.models';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import { ProfileApiService } from '../../services/profile-api.service';
import { ProfileNotificationService } from '../../services/profile-notification.service';
import { formatUnlockedAt, getAchievementDisplay } from '../../utils/achievement-display';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly profileApi = inject(ProfileApiService);
  private readonly profileNotifications = inject(ProfileNotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly username = signal<string>('');
  readonly profile = signal<PlayerProfile | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const username = this.route.snapshot.paramMap.get('username') ?? '';
    this.username.set(username);
    this.loadProfile();
    this.profileNotifications.achievementUnlocked$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((achievement) => this.addUnlockedAchievement(achievement));
  }

  loadProfile(): void {
    const username = this.username();
    if (!username) {
      this.error.set('No encontramos ese perfil.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.profileApi.getProfile(username).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.profile.set(null);
        this.error.set(getErrorCopy('PROFILE', err));
        this.loading.set(false);
      },
    });
  }

  achievementName(achievement: UnlockedAchievement): string {
    return getAchievementDisplay(achievement.achievementCode).name;
  }

  achievementDescription(achievement: UnlockedAchievement): string {
    return getAchievementDisplay(achievement.achievementCode).description;
  }

  unlockedAt(achievement: UnlockedAchievement): string {
    return formatUnlockedAt(achievement.unlockedAt);
  }

  goBack(): void {
    void this.router.navigateByUrl('/lobby');
  }

  private addUnlockedAchievement(achievement: UnlockedAchievement): void {
    if (this.authStore.username() !== this.username()) {
      return;
    }

    const current = this.profile();
    if (
      !current ||
      current.achievements.some((item) => item.achievementCode === achievement.achievementCode)
    ) {
      return;
    }

    this.profile.set({
      ...current,
      achievements: [achievement, ...current.achievements],
    });
  }
}
