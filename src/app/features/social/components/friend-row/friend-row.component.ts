import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { FriendAvailability, FriendBusyReason } from '../../../../core/models/social.models';

/**
 * Fila de un amigo confirmado. Permite eliminar la amistad (US3 de 024),
 * invitar a partida (feature 025) y mirar la partida del amigo (feature 026).
 */
@Component({
  selector: 'app-friend-row',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './friend-row.component.html',
  styleUrl: './friend-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendRowComponent {
  /** Username del amigo. */
  readonly friendUsername = input.required<string>();
  /** Presencia aproximada; gatea junto con `availability` la acción de invitar. */
  readonly online = input<boolean>(false);
  /** Disponibilidad para invitar. */
  readonly availability = input<FriendAvailability>('AVAILABLE');
  /** Motivo de ocupación (si `BUSY`). */
  readonly busyReason = input<FriendBusyReason | null>(null);
  /** Bloquea acciones mientras se crea/invita para evitar dobles envíos. */
  readonly inviting = input<boolean>(false);
  /** matchId de la partida espectable del amigo; null si no hay. */
  readonly spectatableMatchId = input<string | null>(null);

  /** Emite el username a eliminar. */
  readonly remove = output<string>();
  /** Emite el username a invitar a partida. */
  readonly invite = output<string>();
  /** Emite el matchId a espectar. */
  readonly spectate = output<string>();

  readonly canInvite = computed(() => this.online() && this.availability() === 'AVAILABLE');
  readonly canSpectate = computed(() => this.spectatableMatchId() !== null);
  readonly isOnlineAvailable = computed(() => this.online() && this.availability() === 'AVAILABLE');
  readonly isBusy = computed(() => this.online() && this.availability() === 'BUSY');
  readonly dotAriaLabel = computed(() => {
    if (!this.online()) return 'Desconectado';
    if (this.isBusy()) return 'En partida';
    return 'En línea';
  });

  onRemove(): void {
    this.remove.emit(this.friendUsername());
  }

  onInvite(): void {
    if (this.canInvite() && !this.inviting()) {
      this.invite.emit(this.friendUsername());
    }
  }

  onSpectate(): void {
    const matchId = this.spectatableMatchId();
    if (matchId !== null) {
      this.spectate.emit(matchId);
    }
  }
}
