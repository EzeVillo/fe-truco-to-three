import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { VISIBILITY } from '../../../../core/models/enums';
import type { Visibility } from '../../../../core/models/enums';

interface VisibilityOption {
  value: Visibility;
  label: string;
  ariaLabel: string;
}

const OPTIONS: VisibilityOption[] = [
  { value: VISIBILITY.PUBLIC, label: 'Pública', ariaLabel: 'Partida pública, visible en el lobby' },
  { value: VISIBILITY.PRIVATE, label: 'Privada', ariaLabel: 'Partida privada, solo por código' },
];

@Component({
  selector: 'app-visibility-selector',
  standalone: true,
  imports: [],
  templateUrl: './visibility-selector.component.html',
  styleUrl: './visibility-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisibilitySelectorComponent {
  readonly visibility = input<Visibility>(VISIBILITY.PRIVATE);
  readonly visibilityChange = output<Visibility>();

  readonly options = OPTIONS;

  select(value: Visibility): void {
    this.visibilityChange.emit(value);
  }
}
