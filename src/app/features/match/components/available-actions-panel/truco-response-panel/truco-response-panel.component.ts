import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TapActionDirective } from '../../../../../shared/directives/tap-action.directive';
import type { TrucoResponseOptions } from '../../../utils/derive-truco-response-options';

const ALL_ENABLED: TrucoResponseOptions = {
  quiero: true,
  noQuiero: true,
  quieroYMazo: true,
};

@Component({
  selector: 'app-truco-response-panel',
  standalone: true,
  imports: [CommonModule, TapActionDirective],
  templateUrl: './truco-response-panel.component.html',
  styleUrl: './truco-response-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrucoResponsePanelComponent {
  readonly options = input<TrucoResponseOptions>(ALL_ENABLED);

  readonly quieroClicked = output<void>();
  readonly noQuieroClicked = output<void>();
  readonly quieroYMazoClicked = output<void>();

  onQuiero(): void {
    if (!this.options().quiero) {
      return;
    }
    this.quieroClicked.emit();
  }

  onNoQuiero(): void {
    if (!this.options().noQuiero) {
      return;
    }
    this.noQuieroClicked.emit();
  }

  onQuieroYMazo(): void {
    if (!this.options().quieroYMazo) {
      return;
    }
    this.quieroYMazoClicked.emit();
  }
}
