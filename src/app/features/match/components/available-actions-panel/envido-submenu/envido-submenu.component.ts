import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { EnvidoCallOptions } from '../../../utils/derive-envido-call-options';

export interface EnvidoOption {
  label: string;
  shortLabel: string;
  stackedLines: string[];
  call: 'ENVIDO' | 'REAL_ENVIDO' | 'FALTA_ENVIDO';
  enabled: boolean;
}

const ALL_ENABLED: EnvidoCallOptions = {
  envido: true,
  realEnvido: true,
  faltaEnvido: true,
};

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
  readonly options = input<EnvidoCallOptions>(ALL_ENABLED);
  readonly backEnabled = input<boolean>(true);

  readonly optionClicked = output<EnvidoOption['call']>();
  readonly backClicked = output<void>();

  readonly items = computed<EnvidoOption[]>(() => {
    const opts = this.options();
    return [
      { label: 'Envido', shortLabel: 'Envido', stackedLines: ['Envido'], call: 'ENVIDO', enabled: opts.envido },
      { label: 'Real Envido', shortLabel: 'Real Env.', stackedLines: ['Real', 'Envido'], call: 'REAL_ENVIDO', enabled: opts.realEnvido },
      { label: 'Falta Envido', shortLabel: 'Falta Env.', stackedLines: ['Falta', 'Envido'], call: 'FALTA_ENVIDO', enabled: opts.faltaEnvido },
    ];
  });

  onOptionClick(opt: EnvidoOption): void {
    if (!opt.enabled) {return;}
    this.optionClicked.emit(opt.call);
  }

  onBackClick(): void {
    if (!this.backEnabled()) {return;}
    this.backClicked.emit();
  }
}
