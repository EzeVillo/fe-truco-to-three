import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  type OnDestroy,
} from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RematchStateService } from '../../services/rematch-state.service';
import {
  canAccept,
  waitingForOpponent,
  opponentWants,
  opponentLeft,
  expired,
  confirmedMatchId,
  computeRematchCountdown,
} from '../../utils/rematch-view';
import { MatchStateService } from '../../services/match-state.service';

export interface RematchDialogResult {
  confirmedMatchId: string | null;
}

@Component({
  selector: 'app-rematch-dialog',
  standalone: true,
  imports: [MatDialogModule],
  templateUrl: './rematch-dialog.component.html',
  styleUrl: './rematch-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RematchDialogComponent implements OnDestroy {
  private readonly rematchState = inject(RematchStateService);
  private readonly matchState = inject(MatchStateService);
  private readonly dialogRef = inject<MatDialogRef<RematchDialogComponent, RematchDialogResult>>(MatDialogRef);

  private readonly nowMs = signal(Date.now());
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  readonly session = this.rematchState.session;
  readonly errorMessage = this.rematchState.errorMessage;

  readonly canAccept = computed(() => canAccept(this.session()));
  readonly waitingForOpponent = computed(() => waitingForOpponent(this.session()));
  readonly opponentWants = computed(() => opponentWants(this.session()));
  readonly opponentLeft = computed(() => opponentLeft(this.session()));
  readonly expired = computed(() => expired(this.session()));
  readonly confirmedId = computed(() => confirmedMatchId(this.session()));

  readonly remainingMs = computed(() =>
    computeRematchCountdown(
      this.session(),
      this.matchState.serverClockOffsetMs(),
      this.nowMs(),
    ),
  );

  readonly remainingSeconds = computed(() => Math.ceil(this.remainingMs() / 1000));

  readonly isOpen = computed(() => this.session()?.status === 'OPEN');

  constructor() {
    // Tick activo solo mientras la oferta está OPEN
    effect(() => {
      if (this.isOpen()) {
        if (!this.tickInterval) {
          this.tickInterval = setInterval(() => this.nowMs.set(Date.now()), 220);
        }
      } else {
        this.clearTick();
      }
    });

    // Navegación automática al confirmar
    effect(() => {
      const id = this.confirmedId();
      if (id) {
        this.dialogRef.close({ confirmedMatchId: id });
      }
    });
  }

  onAccept(): void {
    this.rematchState.accept();
  }

  onLeave(): void {
    this.rematchState.leave();
    this.dialogRef.close({ confirmedMatchId: null });
  }

  ngOnDestroy(): void {
    this.clearTick();
  }

  private clearTick(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
