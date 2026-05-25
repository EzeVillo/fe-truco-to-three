import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import type { MatButtonToggleChange } from '@angular/material/button-toggle';
import { DEFAULT_SERIES_FORMAT, SERIES_FORMAT_LABELS } from '../../../../core/models/match.models';
import type { SeriesFormat } from '../../../../core/models/match.models';

const ORDER: SeriesFormat[] = ['BEST_OF_1', 'BEST_OF_3', 'BEST_OF_5'];

@Component({
  selector: 'app-series-format-selector',
  standalone: true,
  imports: [MatButtonToggleModule],
  templateUrl: './series-format-selector.component.html',
  styleUrl: './series-format-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesFormatSelectorComponent {
  readonly format = input<SeriesFormat>(DEFAULT_SERIES_FORMAT);
  readonly formatChange = output<SeriesFormat>();

  readonly options = ORDER.map((value) => ({ value, label: SERIES_FORMAT_LABELS[value] }));

  onChange(ev: MatButtonToggleChange): void {
    this.formatChange.emit(ev.value as SeriesFormat);
  }
}
