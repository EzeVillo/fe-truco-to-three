import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SocialStore } from '../../services/social.store';

/**
 * Toast de invitación a partida recibida (feature 025, US2).
 *
 * Se muestra a nivel app cuando hay una invitación pendiente recibida. Aceptar
 * delega el join al backend; la navegación la maneja la presencia y, como
 * fallback, este componente navega al target tras el 204. No hay lista
 * persistente: sólo el toast (D5).
 */
@Component({
  selector: 'app-invitation-toast',
  standalone: true,
  templateUrl: './invitation-toast.component.html',
  styleUrl: './invitation-toast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitationToastComponent {
  readonly store = inject(SocialStore);
  private readonly router = inject(Router);

  onAccept(invitationId: string): void {
    this.store.acceptInvitation(invitationId, (targetId) => {
      void this.router.navigate(['/match', targetId]);
    });
  }

  onDecline(invitationId: string): void {
    this.store.declineInvitation(invitationId);
  }
}
