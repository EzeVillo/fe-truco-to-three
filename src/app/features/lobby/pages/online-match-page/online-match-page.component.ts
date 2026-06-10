import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SeriesFormatSelectorComponent } from '../../components/series-format-selector/series-format-selector.component';
import { VisibilitySelectorComponent } from '../../components/visibility-selector/visibility-selector.component';
import { PublicMatchListComponent } from '../../components/public-match-list/public-match-list.component';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import { MatchesApiService } from '../../services/matches-api.service';
import { PublicMatchLobbyStore } from '../../services/public-match-lobby.store';
import { AuthStore } from '../../../../core/auth/auth.store';
import {
  DEFAULT_SERIES_FORMAT,
  seriesFormatToGamesToPlay,
} from '../../../../core/models/match.models';
import type { SeriesFormat } from '../../../../core/models/match.models';
import { VISIBILITY } from '../../../../core/models/enums';
import type { Visibility } from '../../../../core/models/enums';
import type { PublicMatchLobbyItem } from '../../models/public-match-lobby.models';
import { saveJoinCode } from '../../../match/utils/join-code-store';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import { SocialStore } from '../../../social/services/social.store';
import { NavigationLockService } from '../../../../core/services/navigation-lock.service';

@Component({
  selector: 'app-online-match-page',
  standalone: true,
  imports: [
    SeriesFormatSelectorComponent,
    VisibilitySelectorComponent,
    PublicMatchListComponent,
    MatProgressSpinnerModule,
    BackButtonComponent,
  ],
  providers: [PublicMatchLobbyStore],
  templateUrl: './online-match-page.component.html',
  styleUrl: './online-match-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlineMatchPageComponent implements OnInit {
  private readonly api = inject(MatchesApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authStore = inject(AuthStore);
  private readonly socialStore = inject(SocialStore);
  private readonly titleService = inject(Title);
  private readonly navigationLock = inject(NavigationLockService);
  protected readonly lobby = inject(PublicMatchLobbyStore);

  constructor() {
    // Bloquea el logo del header mientras hay un POST en vuelo (crear/unirse).
    effect(() => this.navigationLock.set(this.busy()));
    inject(DestroyRef).onDestroy(() => this.navigationLock.set(false));
  }

  readonly currentUsername = this.authStore.username;
  readonly joiningId = signal<string | null>(null);

  readonly seriesFormat = signal<SeriesFormat>(DEFAULT_SERIES_FORMAT);
  readonly visibility = signal<Visibility>(VISIBILITY.PRIVATE);
  readonly creating = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  readonly inviteFriendUsername = signal<string | null>(null);

  readonly isPublicCreate = computed(() => this.visibility() === VISIBILITY.PUBLIC);
  readonly isFriendInviteFlow = computed(() => this.inviteFriendUsername() !== null);
  readonly createCtaLabel = computed(() =>
    this.isFriendInviteFlow()
      ? 'Crear e invitar'
      : this.isPublicCreate()
        ? 'Crear partida pública'
        : 'Crear partida privada',
  );

  readonly joinCodeInput = signal<string>('');
  readonly joining = signal<boolean>(false);
  readonly joinError = signal<string | null>(null);
  readonly inviteJoinCode = signal<string | null>(null);

  readonly isInviteLink = computed(() => this.inviteJoinCode() !== null);

  /**
   * Cualquier operación de la página en vuelo (crear, unirse por código o unirse a
   * una pública) bloquea TODOS los controles: selectores, ambos CTAs, las cards
   * públicas y el botón de volver. Evita disparar flujos en paralelo o navegar a
   * mitad de una creación/unión.
   */
  readonly busy = computed(() => this.creating() || this.joining() || this.joiningId() !== null);

  readonly canJoin = computed(() => !this.busy() && this.joinCodeInput().trim().length > 0);

  ngOnInit(): void {
    this.titleService.setTitle('Partida online — Truco a 3');
    const joinCode = this.route.snapshot.paramMap.get('joinCode')?.trim() ?? '';
    if (joinCode) {
      this.inviteJoinCode.set(joinCode);
      this.joinCodeInput.set(joinCode);
      void this.onJoin();
      return;
    }

    const inviteFriend = this.route.snapshot.queryParamMap.get('inviteFriend')?.trim() ?? '';
    if (inviteFriend) {
      this.inviteFriendUsername.set(inviteFriend);
      this.visibility.set(VISIBILITY.PRIVATE);
      return;
    }

    this.lobby.start();
  }

  onLoadMorePublic(): void {
    this.lobby.loadMore();
  }

  onRetryPublic(): void {
    this.lobby.retry();
  }

  onJoinPublic(item: PublicMatchLobbyItem): void {
    if (this.busy()) {
      return;
    }

    if (this.currentUsername() !== null && item.host === this.currentUsername()) {
      void this.router.navigate(['/match', item.matchId]);
      return;
    }

    if (!item.joinCode) {
      return;
    }

    this.joiningId.set(item.matchId);
    this.api.joinByCode(item.joinCode).subscribe({
      next: ({ targetType, targetId }) => {
        this.joiningId.set(null);
        if (targetType !== 'MATCH') {
          this.snackBar.open('Ese código no corresponde a una partida.', 'Cerrar', {
            duration: 4000,
            panelClass: 'public-lobby-snackbar',
          });
          return;
        }
        void this.router.navigate(['/match', targetId]);
      },
      error: (err: unknown) => {
        console.error('[OnlineMatchPage] error uniéndose a partida pública', err);
        this.joiningId.set(null);
        this.snackBar.open(getErrorCopy('JOIN_MATCH', err), 'Cerrar', {
          duration: 4000,
          panelClass: 'public-lobby-snackbar',
        });
      },
    });
  }

  onChangeFormat(format: SeriesFormat): void {
    this.seriesFormat.set(format);
  }

  onChangeVisibility(visibility: Visibility): void {
    this.visibility.set(visibility);
  }

  onJoinCodeInput(value: string): void {
    this.joinCodeInput.set(value);
    if (this.inviteJoinCode()) {
      this.inviteJoinCode.set(null);
    }
    if (this.joinError()) {
      this.joinError.set(null);
    }
  }

  goBack(): void {
    if (this.busy()) {
      return;
    }
    void this.router.navigateByUrl(this.isFriendInviteFlow() ? '/friends' : '/lobby');
  }

  onCreate(): void {
    if (this.busy()) {
      return;
    }
    this.creating.set(true);
    this.createError.set(null);

    const inviteFriend = this.inviteFriendUsername();
    this.api
      .createMatch({
        gamesToPlay: seriesFormatToGamesToPlay(this.seriesFormat()),
        visibility: inviteFriend ? VISIBILITY.PRIVATE : this.visibility(),
      })
      .subscribe({
        next: ({ matchId, joinCode }) => {
          this.creating.set(false);
          saveJoinCode(matchId, joinCode);
          if (inviteFriend) {
            this.socialStore.inviteFriend(inviteFriend, matchId);
          }
          void this.router.navigate(['/match', matchId], { state: { joinCode } });
        },
        error: (err: unknown) => {
          console.error('[OnlineMatchPage] error creando partida', err);
          this.createError.set(getErrorCopy('CREATE_MATCH', err));
          this.creating.set(false);
        },
      });
  }

  onJoin(): void {
    if (!this.canJoin()) {
      return;
    }
    const code = this.joinCodeInput().trim();
    this.joining.set(true);
    this.joinError.set(null);

    this.api.joinByCode(code).subscribe({
      next: ({ targetType, targetId }) => {
        this.joining.set(false);
        if (targetType !== 'MATCH') {
          this.joinError.set('Ese código no corresponde a una partida.');
          return;
        }
        void this.router.navigate(['/match', targetId]);
      },
      error: (err: unknown) => {
        console.error('[OnlineMatchPage] error uniéndose', err);
        this.joinError.set(getErrorCopy('JOIN_MATCH', err));
        this.joining.set(false);
      },
    });
  }
}
