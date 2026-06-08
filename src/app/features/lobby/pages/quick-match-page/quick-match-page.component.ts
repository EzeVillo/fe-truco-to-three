import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  DEFAULT_SERIES_FORMAT,
  SERIES_FORMAT_LABELS,
  seriesFormatToGamesToPlay,
} from '../../../../core/models/match.models';
import type { QuickMatchResponse, SeriesFormat } from '../../../../core/models/match.models';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import type { MatchWsEvent } from '../../../match/models/match-ws-events';
import { SeriesFormatSelectorComponent } from '../../components/series-format-selector/series-format-selector.component';
import { MatchesApiService } from '../../services/matches-api.service';

type QuickMatchUiState = 'idle' | 'submitting' | 'searching' | 'cancelling' | 'matched' | 'error';

@Component({
  selector: 'app-quick-match-page',
  standalone: true,
  imports: [BackButtonComponent, MatProgressSpinnerModule, SeriesFormatSelectorComponent],
  templateUrl: './quick-match-page.component.html',
  styleUrl: './quick-match-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickMatchPageComponent {
  private readonly api = inject(MatchesApiService);
  private readonly router = inject(Router);
  private readonly webSocket = inject(WebSocketService);

  readonly seriesFormat = signal<SeriesFormat>(DEFAULT_SERIES_FORMAT);
  readonly state = signal<QuickMatchUiState>('idle');
  readonly enqueuedAt = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly selectedFormatLabel = computed(() => SERIES_FORMAT_LABELS[this.seriesFormat()]);
  readonly canSearch = computed(() => {
    const current = this.state();
    return current === 'idle' || current === 'error';
  });
  readonly isBusy = computed(() => {
    const current = this.state();
    return current === 'submitting' || current === 'cancelling' || current === 'matched';
  });

  constructor() {
    inject(Title).setTitle('Partida rápida — Truco a 3');
    this.webSocket.connect();
    this.webSocket
      .subscribe<MatchWsEvent>('/user/queue/match')
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.onMatchEvent(event));
  }

  onChangeFormat(format: SeriesFormat): void {
    this.seriesFormat.set(format);
    this.error.set(null);
  }

  onSearch(): void {
    if (!this.canSearch()) {
      return;
    }

    this.state.set('submitting');
    this.error.set(null);

    this.api
      .enterQuickMatch({
        gamesToPlay: seriesFormatToGamesToPlay(this.seriesFormat()),
      })
      .subscribe({
        next: (response) => this.handleQuickMatchResponse(response),
        error: (err: unknown) => {
          console.error('[QuickMatchPage] error buscando rival', err);
          this.error.set(getErrorCopy('QUICK_MATCH', err));
          this.state.set('error');
        },
      });
  }

  cancelSearch(navigateAfterCancel = false): void {
    if (this.state() !== 'searching') {
      if (navigateAfterCancel) {
        void this.router.navigateByUrl('/lobby');
      }
      return;
    }

    this.state.set('cancelling');
    this.error.set(null);

    this.api.cancelQuickMatch().subscribe({
      next: () => {
        this.enqueuedAt.set(null);
        this.state.set('idle');
        if (navigateAfterCancel) {
          void this.router.navigateByUrl('/lobby');
        }
      },
      error: (err: unknown) => {
        console.error('[QuickMatchPage] error cancelando busqueda', err);
        this.error.set(getErrorCopy('QUICK_MATCH', err));
        this.state.set('error');
      },
    });
  }

  goBack(): void {
    if (this.state() === 'searching') {
      this.cancelSearch(true);
      return;
    }

    void this.router.navigateByUrl('/lobby');
  }

  private handleQuickMatchResponse(response: QuickMatchResponse): void {
    this.enqueuedAt.set(response.enqueuedAt);

    if (response.status === 'MATCHED' && response.matchId) {
      this.navigateToMatch(response.matchId);
      return;
    }

    this.state.set('searching');
  }

  private onMatchEvent(event: MatchWsEvent): void {
    if (this.state() !== 'searching') {
      return;
    }

    if (event.eventType !== 'GAME_STARTED' || !event.matchId) {
      return;
    }

    this.navigateToMatch(event.matchId);
  }

  private navigateToMatch(matchId: string): void {
    this.state.set('matched');
    void this.router.navigate(['/match', matchId]);
  }
}
