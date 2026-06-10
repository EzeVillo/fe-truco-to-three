import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PublicMatchCardComponent } from '../public-match-card/public-match-card.component';
import type { PublicMatchLobbyItem } from '../../models/public-match-lobby.models';
import type { PublicLobbyStatus } from '../../../../shared/public-lobby/public-lobby.types';

@Component({
  selector: 'app-public-match-list',
  standalone: true,
  imports: [MatProgressSpinnerModule, PublicMatchCardComponent],
  templateUrl: './public-match-list.component.html',
  styleUrl: './public-match-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicMatchListComponent {
  readonly items = input.required<PublicMatchLobbyItem[]>();
  readonly status = input.required<PublicLobbyStatus>();
  readonly hasMore = input<boolean>(false);
  /** matchId de la partida a la que se está uniendo (deshabilita esa card). */
  readonly joiningId = input<string | null>(null);
  /** Bloqueo externo: otra operación de la página está en curso (deshabilita todas las cards). */
  readonly disabled = input<boolean>(false);
  /** Username actual, para marcar las partidas propias. */
  readonly currentUsername = input<string | null>(null);
  /** Copy de error controlado del front (cuando status === 'error'). */
  readonly errorText = input<string>('No pudimos cargar las partidas. Reintentá.');

  readonly act = output<PublicMatchLobbyItem>();
  readonly loadMore = output<void>();
  readonly retry = output<void>();

  readonly isInitialLoading = computed(
    () => this.status() === 'loading' && this.items().length === 0,
  );
  readonly isInitialError = computed(() => this.status() === 'error' && this.items().length === 0);
  readonly isEmpty = computed(() => this.status() === 'ready' && this.items().length === 0);
  readonly isLoadingMore = computed(() => this.status() === 'loading' && this.items().length > 0);

  isOwn(item: PublicMatchLobbyItem): boolean {
    const me = this.currentUsername();
    return me !== null && item.host === me;
  }
}
