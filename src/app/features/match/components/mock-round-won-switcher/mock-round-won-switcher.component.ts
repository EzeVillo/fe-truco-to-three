import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type RoundWonMockKey =
  | 'round-won-first'
  | 'round-won-tie'
  | 'round-won-decisive'
  | 'round-won-single'
  | 'round-lost-decisive';

const OPTIONS: { key: RoundWonMockKey; label: string }[] = [
  { key: 'round-won-first', label: 'Ronda ganada: 1–0 (mejor de 3)' },
  { key: 'round-won-tie', label: 'Ronda ganada: Empata la serie 1–1' },
  { key: 'round-won-decisive', label: 'Ronda ganada: Serie definida 2–1' },
  { key: 'round-won-single', label: 'Ronda ganada: Partida única' },
  { key: 'round-lost-decisive', label: 'Serie perdida: 1–2 (mejor de 3)' },
];

@Component({
  selector: 'app-mock-round-won-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mock-round-won-switcher.component.html',
  styleUrl: './mock-round-won-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockRoundWonSwitcherComponent {
  readonly options = OPTIONS;
  readonly selected = output<RoundWonMockKey>();

  select(key: RoundWonMockKey): void {
    this.selected.emit(key);
  }
}
