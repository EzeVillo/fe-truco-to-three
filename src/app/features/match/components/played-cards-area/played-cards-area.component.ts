import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Card } from '../../../../core/models/match.models';
import { CardViewComponent } from '../card-view/card-view.component';

@Component({
  selector: 'app-played-cards-area',
  standalone: true,
  imports: [CommonModule, CardViewComponent],
  templateUrl: './played-cards-area.component.html',
  styleUrl: './played-cards-area.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayedCardsAreaComponent {
  readonly selfPlayedInCurrentHand = input<Card | null>(null);
  readonly opponentPlayedInCurrentHand = input<Card | null>(null);
  readonly selfPlayedInPreviousHands = input<(Card | null)[]>([]);
  readonly opponentPlayedInPreviousHands = input<(Card | null)[]>([]);

  readonly selfRow = computed(() =>
    [...this.selfPlayedInPreviousHands(), this.selfPlayedInCurrentHand()].slice(0, 3)
  );

  readonly opponentRow = computed(() =>
    [...this.opponentPlayedInPreviousHands(), this.opponentPlayedInCurrentHand()].slice(0, 3)
  );

  readonly selfPadding = computed(() => Math.max(0, 3 - this.selfRow().length));
  readonly opponentPadding = computed(() => Math.max(0, 3 - this.opponentRow().length));
}
