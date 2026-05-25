import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FixtureKey } from '../../mocks';

interface SwitcherOption {
  key: FixtureKey;
  label: string;
}

const SWITCHER_OPTIONS: SwitcherOption[] = [
  { key: 'viewer-player-one', label: 'Base P1' },
  { key: 'viewer-player-two', label: 'Base P2' },
  { key: 'empty-table', label: 'Mesa vacía' },
  { key: 'asymmetric-hand', label: 'Asimétrica' },
  { key: 'actions-common', label: 'Todo habilitado' },
  { key: 'actions-call-only', label: 'Solo cantos' },
  { key: 'actions-empty', label: 'Sin acciones' },
  { key: 'actions-retruco', label: 'Retruco' },
  { key: 'actions-vale-cuatro', label: 'Vale 4' },
  { key: 'actions-only-fold', label: 'Solo mazo' },
  { key: 'actions-respond-envido', label: 'Responder envido' },
  { key: 'actions-respond-truco', label: 'Responder truco' },
];

@Component({
  selector: 'app-mock-actions-state-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mock-actions-state-switcher.component.html',
  styleUrl: './mock-actions-state-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockActionsStateSwitcherComponent {
  readonly options = SWITCHER_OPTIONS;
  readonly selected = output<FixtureKey>();
}
