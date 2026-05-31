import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SeriesFormatSelectorComponent } from '../../components/series-format-selector/series-format-selector.component';
import { MatchesApiService } from '../../services/matches-api.service';
import {
  DEFAULT_SERIES_FORMAT,
  seriesFormatToGamesToPlay,
} from '../../../../core/models/match.models';
import type { SeriesFormat } from '../../../../core/models/match.models';
import { saveJoinCode } from '../../../match/utils/join-code-store';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';

@Component({
  selector: 'app-online-match-page',
  standalone: true,
  imports: [SeriesFormatSelectorComponent, MatProgressSpinnerModule],
  templateUrl: './online-match-page.component.html',
  styleUrl: './online-match-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlineMatchPageComponent implements OnInit {
  private readonly api = inject(MatchesApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ---- Crear partida ----
  readonly seriesFormat = signal<SeriesFormat>(DEFAULT_SERIES_FORMAT);
  readonly creating = signal<boolean>(false);
  readonly createError = signal<string | null>(null);

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
    if (!joinCode) {
      return;
    }

    this.inviteJoinCode.set(joinCode);
    this.joinCodeInput.set(joinCode);
    void this.onJoin();
  }

  onChangeFormat(format: SeriesFormat): void {
    this.seriesFormat.set(format);
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
      .createPrivateMatch({
        gamesToPlay: seriesFormatToGamesToPlay(this.seriesFormat()),
        visibility: 'PRIVATE',
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
