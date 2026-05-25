import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-truco-response-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './truco-response-panel.component.html',
  styleUrl: './truco-response-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrucoResponsePanelComponent {
  readonly quieroClicked = output<void>();
  readonly noQuieroClicked = output<void>();
  readonly quieroYMazoClicked = output<void>();
}
