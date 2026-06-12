import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import type {
  AchievementView,
  PlayerProfile,
  UnlockedAchievement,
} from '../../../../core/models/profile.models';
import type { CampaignResponse } from '../../../../core/models/campaign.models';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import { CampaignApiService } from '../../../campaign/services/campaign-api.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { ProfileNotificationService } from '../../services/profile-notification.service';
import { formatUnlockedAt } from '../../utils/achievement-display';
import { mergeAchievements } from '../../utils/achievement-merge';
import { BackButtonComponent } from '../../../../shared/components/back-button';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [MatIconModule, BackButtonComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly profileApi = inject(ProfileApiService);
  private readonly campaignApi = inject(CampaignApiService);
  private readonly profileNotifications = inject(ProfileNotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleService = inject(Title);

  readonly username = signal<string>('');
  readonly profile = signal<PlayerProfile | null>(null);
  readonly campaign = signal<CampaignResponse | null>(null);
  readonly achievements = signal<AchievementView[]>([]);
  private catalogCodes: string[] = [];
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Resumen de campaña para el perfil. Puntos y posición vienen directos del BE;
   * jugadas/ganadas se agregan sumando los head-to-head (`record`) del ranking.
   * `null` cuando no hay datos (perfil ajeno o campaña sin cargar).
   */
  readonly campaignStats = computed(() => {
    const data = this.campaign();
    if (!data) {
      return null;
    }

    const totals = data.ranking.reduce(
      (acc, entry) => {
        if (entry.record) {
          acc.won += entry.record.wins;
          acc.played += entry.record.wins + entry.record.losses;
        }
        return acc;
      },
      { won: 0, played: 0 },
    );
    const winRate = totals.played === 0 ? 0 : Math.round((totals.won / totals.played) * 100);

    return {
      points: data.playerPoints,
      position: data.playerPosition,
      totalParticipants: data.totalBots + 1,
      played: totals.played,
      won: totals.won,
      winRate,
    };
  });

  ngOnInit(): void {
    const username = this.route.snapshot.paramMap.get('username') ?? '';
    this.username.set(username);
    this.titleService.setTitle(`Perfil de ${username} — Truco a 3`);
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

    // La campaña es del jugador autenticado (GET /api/campaign no recibe username),
    // así que solo la mostramos en el perfil propio de un usuario registrado.
    const isOwnProfile =
      this.authStore.isAuthenticated() &&
      !this.authStore.isGuest() &&
      this.authStore.username() === username;

    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      catalog: this.profileApi.getAchievementsCatalog().pipe(catchError(() => of(null))),
      profile: this.profileApi.getProfile(username),
      // Degradamos sin la sección de campaña si el endpoint falla.
      campaign: isOwnProfile
        ? this.campaignApi.getCampaign().pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: ({ catalog, profile, campaign }) => {
        this.profile.set(profile);
        this.campaign.set(campaign);
        // Si el catálogo falla, degradamos a mostrar solo los desbloqueados del perfil.
        this.catalogCodes =
          catalog?.achievements.map((entry) => entry.achievementCode) ??
          profile.achievements.map((entry) => entry.achievementCode);
        this.achievements.set(mergeAchievements(this.catalogCodes, profile.achievements));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.profile.set(null);
        this.campaign.set(null);
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
