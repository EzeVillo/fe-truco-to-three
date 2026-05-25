import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DEFAULT_SERIES_FORMAT, SERIES_FORMAT_LABELS } from '../../../../core/models/match.models';
import type { SeriesFormat } from '../../../../core/models/match.models';

const ARIA_LABELS: Record<SeriesFormat, string> = {
  BEST_OF_1: 'Mejor de 1 partida',
  BEST_OF_3: 'Mejor de 3 partidas',
  BEST_OF_5: 'Mejor de 5 partidas',
};

const ORDER: SeriesFormat[] = ['BEST_OF_1', 'BEST_OF_3', 'BEST_OF_5'];

@Component({
  selector: 'app-series-format-selector',
  standalone: true,
  imports: [],
  templateUrl: './series-format-selector.component.html',
  styleUrl: './series-format-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesFormatSelectorComponent {
  readonly format = input<SeriesFormat>(DEFAULT_SERIES_FORMAT);
  readonly formatChange = output<SeriesFormat>();

  readonly options = ORDER.map((value) => ({
    value,
    label: SERIES_FORMAT_LABELS[value],
    ariaLabel: ARIA_LABELS[value],
  }));

  select(value: SeriesFormat): void {
    this.formatChange.emit(value);
  }
}
