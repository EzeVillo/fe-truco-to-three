import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SeatView } from '../../utils/derive-match-view';
import { CardViewComponent } from '../card-view/card-view.component';

@Component({
  selector: 'app-opponent-area',
  standalone: true,
  imports: [CommonModule, CardViewComponent],
  templateUrl: './opponent-area.component.html',
  styleUrl: './opponent-area.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpponentAreaComponent {
  readonly opponent = input.required<SeatView>();
}
