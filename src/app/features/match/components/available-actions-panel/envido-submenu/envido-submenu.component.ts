import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface EnvidoOption {
  label: string;
  shortLabel: string;
  stackedLines: string[];
  call: 'ENVIDO' | 'REAL_ENVIDO' | 'FALTA_ENVIDO';
}

const ENVIDO_OPTIONS: EnvidoOption[] = [
  { label: 'Envido', shortLabel: 'Envido', stackedLines: ['Envido'], call: 'ENVIDO' },
  { label: 'Real Envido', shortLabel: 'Real Env.', stackedLines: ['Real', 'Envido'], call: 'REAL_ENVIDO' },
  { label: 'Falta Envido', shortLabel: 'Falta Env.', stackedLines: ['Falta', 'Envido'], call: 'FALTA_ENVIDO' },
];

@Component({
  selector: 'app-envido-submenu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './envido-submenu.component.html',
  styleUrl: './envido-submenu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnvidoSubmenuComponent {
  readonly envidoCall = input<EnvidoOption['call'] | null>(null);

  readonly optionClicked = output<EnvidoOption['call']>();
  readonly backClicked = output<void>();

  readonly options = ENVIDO_OPTIONS;
}
