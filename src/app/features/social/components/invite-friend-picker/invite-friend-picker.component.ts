import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { SocialStore } from '../../services/social.store';
import { busyReasonCopy } from '../../../../shared/error-copy/error-copy';
import type { FriendSummary } from '../../../../core/models/social.models';

/**
 * Selector reutilizable de amigo a invitar a partida (feature 025, US1/US1b).
 *
 * Muestra TODOS los amigos del store; sólo habilita la acción de invitar de
 * los `AVAILABLE` que además estén `online`. Si están offline se muestra
 * "Desconectado"; si están `online` pero `BUSY` se muestra el motivo.
 * Emite `invite(friendUsername)`; el contenedor decide el `targetId`.
 *
 * Bloquea múltiples invitaciones simultáneas: una vez que se envía (o está en
 * vuelo) una invitación para la partida indicada por `matchId`, todos los
 * demás botones quedan deshabilitados hasta que la invitación se resuelva
 * o se cancele.
 */
@Component({
  selector: 'app-invite-friend-picker',
  standalone: true,
  templateUrl: './invite-friend-picker.component.html',
  styleUrl: './invite-friend-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteFriendPickerComponent implements OnInit {
  readonly store = inject(SocialStore);

  /** Emite el username del amigo a invitar. */
  readonly invite = output<string>();

  /** Id de la partida a la que se invita; usado para bloquear múltiples invitaciones. */
  readonly matchId = input<string | null>(null);

  /** Username del amigo al que se está invitando en este momento (feedback inmediato). */
  readonly invitingUsername = signal<string | null>(null);
  private inviteTimeoutId: number | null = null;

  /** ¿Ya hay una invitación pendiente para esta partida? */
  readonly hasPendingInvitationForMatch = computed(() => {
    const id = this.matchId();
    if (!id) {
      return false;
    }
    return this.store.outgoingInvitations().some((i) => i.targetId === id);
  });

  constructor() {
    // Si hay un error de invitación, limpiar el estado local de in-flight.
    effect(() => {
      if (this.store.inviteActionError() !== null) {
        this.clearInviting();
      }
    });

    // Si la invitación ya aparece en el store, limpiar el estado local.
    effect(() => {
      const id = this.matchId();
      const username = this.invitingUsername();
      if (id === null || username === null) {
        return;
      }
      const invited = this.store
        .outgoingInvitations()
        .some(
          (i) => i.targetId === id && i.recipientUsername.toLowerCase() === username.toLowerCase(),
        );
      if (invited) {
        this.clearInviting();
      }
    });
  }

  ngOnInit(): void {
    // Garantiza la suscripción social y la carga de amigos con disponibilidad
    // cuando el picker se abre fuera de la página de amigos (p. ej. sala de espera).
    this.store.start();
    this.store.bootstrap();
    this.store.clearInviteActionError();
  }

  canInvite(friend: FriendSummary): boolean {
    if (!friend.online || friend.availability !== 'AVAILABLE') {
      return false;
    }
    if (this.invitingUsername() !== null) {
      return false;
    }
    if (this.hasPendingInvitationForMatch()) {
      return false;
    }
    return true;
  }

  reasonLabel(friend: FriendSummary): string {
    const inviting = this.invitingUsername();
    if (inviting !== null && inviting.toLowerCase() === friend.friendUsername.toLowerCase()) {
      return 'Invitando…';
    }
    if (this.hasPendingInvitationForMatch() || inviting !== null) {
      return 'Invitación enviada';
    }
    if (!friend.online) {
      return '';
    }
    return busyReasonCopy(friend.busyReason);
  }

  onInvite(friend: FriendSummary): void {
    if (this.canInvite(friend)) {
      this.invitingUsername.set(friend.friendUsername);
      this.invite.emit(friend.friendUsername);
      this.inviteTimeoutId = window.setTimeout(() => {
        this.invitingUsername.set(null);
      }, 8000);
    }
  }

  private clearInviting(): void {
    this.invitingUsername.set(null);
    if (this.inviteTimeoutId !== null) {
      clearTimeout(this.inviteTimeoutId);
      this.inviteTimeoutId = null;
    }
  }
}
