import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MatchView } from '../../utils/derive-match-view';

@Component({
  selector: 'app-match-status-panel',
  standalone: true,
  templateUrl: './match-status-panel.component.html',
  styleUrl: './match-status-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchStatusPanelComponent {
  readonly view = input.required<MatchView>();
  readonly selfCallText = input<string | null>(null);
  readonly opponentCallText = input<string | null>(null);

  readonly totalGamesWon = computed(() => this.view().self.gamesWon + this.view().opponent.gamesWon);

  /**
   * Slots de la serie en formato "tug of war": las victorias propias se llenan
   * desde la izquierda (dorado) y las del rival desde la derecha (rojo apagado).
   * Los slots centrales quedan vacíos (games aún no jugados). No representa el
   * orden cronológico real porque el backend solo expone conteos, no historial.
   */
  readonly seriesSlots = computed<('self' | 'opponent' | 'empty')[]>(() => {
    const v = this.view();
    const total = v.gamesToPlay;
    const selfWon = v.self.gamesWon;
    const oppWon = v.opponent.gamesWon;
    return Array.from({ length: total }, (_, i) => {
      if (i < selfWon) return 'self';
      if (i >= total - oppWon) return 'opponent';
      return 'empty';
    });
  });
}
