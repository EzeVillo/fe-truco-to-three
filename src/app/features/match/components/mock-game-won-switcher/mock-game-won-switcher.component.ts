import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type GameWonMockKey =
  | 'game-won-first'
  | 'game-won-tie'
  | 'game-lost-intermediate'
  | 'game-won-decisive'
  | 'game-won-single'
  | 'game-lost-decisive';

const OPTIONS: { key: GameWonMockKey; label: string }[] = [
  { key: 'game-won-first', label: 'Partida ganada: 1–0 (mejor de 3)' },
  { key: 'game-won-tie', label: 'Partida ganada: Empata la serie 1–1' },
  { key: 'game-lost-intermediate', label: 'Partida perdida: 0–1 (mejor de 3)' },
  { key: 'game-won-decisive', label: 'Partida ganada: Serie definida 2–1' },
  { key: 'game-won-single', label: 'Partida ganada: Partida única' },
  { key: 'game-lost-decisive', label: 'Serie perdida: 1–2 (mejor de 3)' },
];

@Component({
  selector: 'app-mock-game-won-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mock-game-won-switcher.component.html',
  styleUrl: './mock-game-won-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockGameWonSwitcherComponent {
  readonly options = OPTIONS;
  readonly selected = output<GameWonMockKey>();

  select(key: GameWonMockKey): void {
    this.selected.emit(key);
  }
}
