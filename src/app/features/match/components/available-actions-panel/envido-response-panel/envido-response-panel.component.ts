import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { EnvidoCall } from '../../../../../core/models/enums';
import type { EnvidoResponseOptions } from '../../../utils/derive-envido-response-options';

export type { EnvidoResponseOptions };

@Component({
  selector: 'app-envido-response-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './envido-response-panel.component.html',
  styleUrl: './envido-response-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnvidoResponsePanelComponent {
  readonly options = input.required<EnvidoResponseOptions>();

  readonly quieroClicked = output<void>();
  readonly noQuieroClicked = output<void>();
  readonly envidoOptionClicked = output<EnvidoCall>();
}
