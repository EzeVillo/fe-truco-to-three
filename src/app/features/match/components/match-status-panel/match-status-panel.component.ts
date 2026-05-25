import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { MatchView } from '../../utils/derive-match-view';

@Component({
  selector: 'app-match-status-panel',
  standalone: true,
  templateUrl: './match-status-panel.component.html',
  styleUrl: './match-status-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchStatusPanelComponent {
  readonly view = input.required<MatchView>();
}
