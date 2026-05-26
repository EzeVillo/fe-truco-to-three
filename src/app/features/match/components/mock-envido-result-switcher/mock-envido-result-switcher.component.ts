import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type EnvidoResultMockKey =
  | 'envido-win-mano'
  | 'envido-lose-pie'
  | 'envido-win-pie'
  | 'envido-lose-mano';

interface SwitcherOption {
  key: EnvidoResultMockKey;
  label: string;
}

const SWITCHER_OPTIONS: SwitcherOption[] = [
  { key: 'envido-win-mano', label: 'Envido: Ganaste (mano, rival Son buenas)' },
  { key: 'envido-lose-pie', label: 'Envido: Perdiste (pie, Son buenas)' },
  { key: 'envido-win-pie', label: 'Envido: Ganaste (pie, superaste al mano)' },
  { key: 'envido-lose-mano', label: 'Envido: Perdiste (mano, rival supero)' },
];

@Component({
  selector: 'app-mock-envido-result-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mock-envido-result-switcher.component.html',
  styleUrl: './mock-envido-result-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockEnvidoResultSwitcherComponent {
  readonly options = SWITCHER_OPTIONS;
  readonly selected = output<EnvidoResultMockKey>();
}
