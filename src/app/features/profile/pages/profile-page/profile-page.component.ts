import { Component, DestroyRef, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import type {
  AchievementView,
  PlayerProfile,
  UnlockedAchievement,
} from '../../../../core/models/profile.models';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import { ProfileApiService } from '../../services/profile-api.service';
import { ProfileNotificationService } from '../../services/profile-notification.service';
import { formatUnlockedAt } from '../../utils/achievement-display';
import { mergeAchievements } from '../../utils/achievement-merge';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [MatIconModule],
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
  readonly achievements = signal<AchievementView[]>([]);
  private catalogCodes: string[] = [];
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
    forkJoin({
      catalog: this.profileApi.getAchievementsCatalog().pipe(catchError(() => of(null))),
      profile: this.profileApi.getProfile(username),
    }).subscribe({
      next: ({ catalog, profile }) => {
        this.profile.set(profile);
        // Si el catálogo falla, degradamos a mostrar solo los desbloqueados del perfil.
        this.catalogCodes =
          catalog?.achievements.map((entry) => entry.achievementCode) ??
          profile.achievements.map((entry) => entry.achievementCode);
        this.achievements.set(mergeAchievements(this.catalogCodes, profile.achievements));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.profile.set(null);
        this.achievements.set([]);
        this.error.set(getErrorCopy('PROFILE', err));
        this.loading.set(false);
      },
    });
  }

  unlockedAt(achievement: AchievementView): string {
    return achievement.unlockedAt === undefined ? '' : formatUnlockedAt(achievement.unlockedAt);
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

    const updated: PlayerProfile = {
      ...current,
      achievements: [achievement, ...current.achievements],
    };
    this.profile.set(updated);
    this.achievements.set(mergeAchievements(this.catalogCodes, updated.achievements));
  }
}
