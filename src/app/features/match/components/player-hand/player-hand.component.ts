import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import type { Card } from '../../../../core/models/match.models';
import { CardViewComponent } from '../card-view/card-view.component';
import { MatchActionsService } from '../../services/match-actions.service';
import { CardFlightService } from '../../services/card-flight.service';
import { TapActionDirective } from '../../../../shared/directives/tap-action.directive';

@Component({
  selector: 'app-player-hand',
  standalone: true,
  imports: [CommonModule, CardViewComponent, TapActionDirective],
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
  private readonly cardFlight = inject(CardFlightService);
  readonly isPlayingCard = signal<boolean>(false);

  /** Lock optimista global: una acción del jugador en vuelo deshabilita las cartas. */
  readonly actionPending = this.matchActionsService.actionPending;

  onCardClick(card: Card, event?: Event): void {
    const matchId = this.matchId();
    if (
      !matchId ||
      !this.playCardsEnabled() ||
      this.isPlayingCard() ||
      this.isProcessingDelay() ||
      this.actionPending()
    ) {
      return;
    }

    // Registrar la posición de la carta en la mano para animar su vuelo a la mesa
    // (FLIP) cuando el backend confirme la jugada. El target es el <button>.
    const target = event?.currentTarget;
    if (target instanceof HTMLElement) {
      this.cardFlight.registerOrigin(card, target.getBoundingClientRect());
    }

    this.isPlayingCard.set(true);
    this.matchActionsService
      .playCard(matchId, { suit: card.suit, number: card.number })
      .pipe(finalize(() => this.isPlayingCard.set(false)))
      .subscribe();
  }
}
