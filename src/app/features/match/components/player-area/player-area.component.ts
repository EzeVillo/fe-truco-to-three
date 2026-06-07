import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SeatView } from '../../utils/derive-match-view';
import { PlayerHandComponent } from '../player-hand/player-hand.component';
import { CardViewComponent } from '../card-view/card-view.component';

@Component({
  selector: 'app-player-area',
  standalone: true,
  imports: [CommonModule, PlayerHandComponent, CardViewComponent],
  templateUrl: './player-area.component.html',
  styleUrl: './player-area.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerAreaComponent {
  readonly self = input.required<SeatView>();
  readonly matchId = input.required<string>();
  readonly playCardsEnabled = input<boolean>(true);
  readonly isProcessingDelay = input<boolean>(false);
  /** Modo espectador: muestra el nombre y las cartas propias dadas vuelta. */
  readonly spectator = input<boolean>(false);
}
