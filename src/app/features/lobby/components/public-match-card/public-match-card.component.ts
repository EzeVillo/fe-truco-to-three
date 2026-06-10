import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PublicMatchLobbyItem } from '../../models/public-match-lobby.models';

const GAMES_TO_PLAY_LABELS: Record<1 | 3 | 5, string> = {
  1: 'Mejor de 1',
  3: 'Mejor de 3',
  5: 'Mejor de 5',
};

@Component({
  selector: 'app-public-match-card',
  standalone: true,
  imports: [],
  templateUrl: './public-match-card.component.html',
  styleUrl: './public-match-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicMatchCardComponent {
  readonly item = input.required<PublicMatchLobbyItem>();
  /** La partida fue creada por el usuario actual. */
  readonly own = input<boolean>(false);
  /** Esta card está ejecutando la acción de unirse. */
  readonly busy = input<boolean>(false);
  /** Bloqueo externo: otra operación de la página está en curso (sin cambiar el label). */
  readonly disabled = input<boolean>(false);

  /** Emite cuando el usuario toca la acción (unirse o ir a su partida). */
  readonly act = output<PublicMatchLobbyItem>();

  readonly formatLabel = computed(() => GAMES_TO_PLAY_LABELS[this.item().gamesToPlay]);
  readonly slots = computed(() => `${this.item().occupiedSlots}/${this.item().totalSlots}`);
  /** Sin joinCode (item solo conocido por WS) no se puede unir; salvo que sea la propia. */
  readonly canAct = computed(() => this.own() || this.item().joinCode !== null);
  readonly actionLabel = computed(() => (this.own() ? 'Ir a tu partida' : 'Unirse'));

  onAct(): void {
    if (this.busy() || this.disabled() || !this.canAct()) {
      return;
    }
    this.act.emit(this.item());
  }
}
