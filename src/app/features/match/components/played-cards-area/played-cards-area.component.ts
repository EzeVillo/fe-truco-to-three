import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Card } from '../../../../core/models/match.models';
import { CardViewComponent } from '../card-view/card-view.component';
import { CardFlightDirective } from '../../directives/card-flight.directive';

@Component({
  selector: 'app-played-cards-area',
  standalone: true,
  imports: [CommonModule, CardViewComponent, CardFlightDirective],
  templateUrl: './played-cards-area.component.html',
  styleUrl: './played-cards-area.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayedCardsAreaComponent {
  readonly selfPlayedInCurrentHand = input<Card | null>(null);
  readonly opponentPlayedInCurrentHand = input<Card | null>(null);
  readonly selfPlayedInPreviousHands = input<(Card | null)[]>([]);
  readonly opponentPlayedInPreviousHands = input<(Card | null)[]>([]);
  /** Ganador de cada mano resuelta (paralelo a `*PlayedInPreviousHands`). */
  readonly handWinners = input<('self' | 'opponent' | 'tie')[]>([]);

  readonly selfRow = computed(() =>
    [...this.selfPlayedInPreviousHands(), this.selfPlayedInCurrentHand()].slice(0, 3),
  );

  readonly opponentRow = computed(() =>
    [...this.opponentPlayedInPreviousHands(), this.opponentPlayedInCurrentHand()].slice(0, 3),
  );

  readonly selfPadding = computed(() => Math.max(0, 3 - this.selfRow().length));
  readonly opponentPadding = computed(() => Math.max(0, 3 - this.opponentRow().length));

  /** Por cada slot de la fila propia, si esa carta ganó su mano (no aplica a la mano en curso). */
  readonly selfWinnerFlags = computed(() =>
    this.selfRow().map((_, i) => this.handWinners()[i] === 'self'),
  );

  /** Ídem para la fila del rival. */
  readonly opponentWinnerFlags = computed(() =>
    this.opponentRow().map((_, i) => this.handWinners()[i] === 'opponent'),
  );
}
