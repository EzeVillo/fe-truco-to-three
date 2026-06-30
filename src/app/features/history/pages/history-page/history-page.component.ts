import { Component, DestroyRef, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import type { MatchHistoryEntry } from '../../../../core/models/match-history.models';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import { MatchHistoryApiService } from '../../services/match-history-api.service';
import {
  endReasonNote,
  formatEndedAt,
  outcomeLabel,
  scoreLabel,
} from '../../utils/history-display';
import { BackButtonComponent } from '../../../../shared/components/back-button';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [BackButtonComponent],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
})
export class HistoryPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly historyApi = inject(MatchHistoryApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleService = inject(Title);

  readonly entries = signal<MatchHistoryEntry[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.titleService.setTitle('Historial de partidas — Truco a 3');
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading.set(true);
    this.error.set(null);
    this.historyApi
      .getHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ entries }) => {
          this.entries.set(entries);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.entries.set([]);
          this.error.set(getErrorCopy('MATCH_HISTORY', err));
          this.loading.set(false);
        },
      });
  }

  goBack(): void {
    void this.router.navigateByUrl('/lobby');
  }

  outcomeLabel(entry: MatchHistoryEntry): string {
    return outcomeLabel(entry.outcome);
  }

  endReasonNote(entry: MatchHistoryEntry): string | null {
    return endReasonNote(entry.outcome, entry.endReason);
  }

  scoreLabel(entry: MatchHistoryEntry): string {
    return scoreLabel(entry);
  }

  endedAt(entry: MatchHistoryEntry): string {
    return formatEndedAt(entry.endedAt);
  }
}
