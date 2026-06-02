import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  protected readonly lobby = inject(PublicMatchLobbyStore);

  // ---- Lobby público ----
  readonly currentUsername = this.authStore.username;
  /** matchId de la partida a la que se está uniendo (deshabilita esa card). */
  readonly joiningId = signal<string | null>(null);

  // ---- Crear partida ----
  readonly seriesFormat = signal<SeriesFormat>(DEFAULT_SERIES_FORMAT);
  readonly visibility = signal<Visibility>(VISIBILITY.PRIVATE);
  readonly creating = signal<boolean>(false);
  readonly createError = signal<string | null>(null);

  readonly isPublicCreate = computed(() => this.visibility() === VISIBILITY.PUBLIC);
  readonly createCtaLabel = computed(() =>
    this.isPublicCreate() ? 'Crear partida pública' : 'Crear partida privada',
  );

  // ---- Unirse por código ----
  readonly joinCodeInput = signal<string>('');
  readonly joining = signal<boolean>(false);
  readonly joinError = signal<string | null>(null);
  readonly inviteJoinCode = signal<string | null>(null);

  readonly isInviteLink = computed(() => this.inviteJoinCode() !== null);

  readonly canJoin = computed(
    () => !this.joining() && this.joinCodeInput().trim().length > 0,
  );

  ngOnInit(): void {
    const joinCode = this.route.snapshot.paramMap.get('joinCode')?.trim() ?? '';
    if (joinCode) {
      // Llegada por enlace de invitación: no mostramos el lobby, vamos al join.
      this.inviteJoinCode.set(joinCode);
      this.joinCodeInput.set(joinCode);
      void this.onJoin();
      return;
    }

    // Vista normal de "Jugar online": arrancamos el lobby público.
    this.lobby.start();
  }

  // ---- Lobby público: acciones ----

  onLoadMorePublic(): void {
    this.lobby.loadMore();
  }

  onRetryPublic(): void {
    this.lobby.retry();
  }

  /**
   * Une al usuario a una partida pública del lobby. Si es su propia partida,
   * vuelve a la sala. Ante una race condition (la partida se llenó/cerró justo),
   * muestra un toast no bloqueante y lo deja en el lobby: la baja llega sola por
   * el delta WS (no forzamos refresco).
   */
  onJoinPublic(item: PublicMatchLobbyItem): void {
    if (this.joiningId() !== null) {
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
        // Toast no bloqueante; sin refresco forzado: la baja llega por delta WS.
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
    void this.router.navigateByUrl('/lobby');
  }

  onCreate(): void {
    if (this.creating()) {
      return;
    }
    this.creating.set(true);
    this.createError.set(null);

    this.api
      .createMatch({
        gamesToPlay: seriesFormatToGamesToPlay(this.seriesFormat()),
        visibility: this.visibility(),
      })
      .subscribe({
        next: ({ matchId, joinCode }) => {
          this.creating.set(false);
          // Persistir el código para recuperarlo en la sala tras recarga (D5).
          saveJoinCode(matchId, joinCode);
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
          // El MVP solo maneja partidas; un código de liga/copa no aplica acá.
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
