import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import type { Card } from '../../../../core/models/match.models';
import { CardViewComponent } from '../card-view/card-view.component';
import { MatchActionsService } from '../../services/match-actions.service';

@Component({
  selector: 'app-player-hand',
  standalone: true,
  imports: [CommonModule, CardViewComponent],
  templateUrl: './player-hand.component.html',
  styleUrl: './player-hand.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerHandComponent {
  readonly cards = input<Card[] | null>(null);
  readonly matchId = input.required<string>();
  readonly playCardsEnabled = input<boolean>(true);
  readonly isProcessingDelay = input<boolean>(false);

  private readonly matchActionsService = inject(MatchActionsService);
  readonly isPlayingCard = signal<boolean>(false);

  onCardClick(card: Card): void {
    const matchId = this.matchId();
    if (!matchId || !this.playCardsEnabled() || this.isPlayingCard() || this.isProcessingDelay()) {
      return;
    }

    this.isPlayingCard.set(true);
    this.matchActionsService
      .playCard(matchId, { suit: card.suit, number: card.number })
      .pipe(finalize(() => this.isPlayingCard.set(false)))
      .subscribe();
  }
}
