import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SeatView } from '../../utils/derive-match-view';
import { PlayerHandComponent } from '../player-hand/player-hand.component';

@Component({
  selector: 'app-player-area',
  standalone: true,
  imports: [CommonModule, PlayerHandComponent],
  templateUrl: './player-area.component.html',
  styleUrl: './player-area.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerAreaComponent {
  readonly self = input.required<SeatView>();
}
