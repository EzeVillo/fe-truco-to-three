import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { busyReasonCopy } from '../../../../shared/error-copy/error-copy';
import type { FriendAvailability, FriendBusyReason } from '../../../../core/models/social.models';

/**
 * Fila de un amigo confirmado. Permite eliminar la amistad (US3 de 024) e
 * invitar a partida (feature 025, US1b). La acción de invitar se habilita sólo
 * si el amigo está `online` y `AVAILABLE`; si está offline se muestra
 * "Desconectado", y si está `BUSY` se muestra el motivo.
 */
@Component({
  selector: 'app-friend-row',
  standalone: true,
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

  /** Emite el username a eliminar. */
  readonly remove = output<string>();
  /** Emite el username a invitar a partida. */
  readonly invite = output<string>();

  readonly canInvite = computed(() => this.online() && this.availability() === 'AVAILABLE');
  readonly reasonLabel = computed(() =>
    !this.online() ? '' : busyReasonCopy(this.busyReason()),
  );

  onRemove(): void {
    this.remove.emit(this.friendUsername());
  }

  onInvite(): void {
    if (this.canInvite() && !this.inviting()) {
      this.invite.emit(this.friendUsername());
    }
  }
}
