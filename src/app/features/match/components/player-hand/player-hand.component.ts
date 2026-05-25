import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Card } from '../../../../core/models/match.models';
import { CardViewComponent } from '../card-view/card-view.component';

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
}
