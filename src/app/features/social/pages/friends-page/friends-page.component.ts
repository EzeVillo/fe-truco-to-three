import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog';
import { SocialStore } from '../../services/social.store';
import { AddFriendFormComponent } from '../../components/add-friend-form/add-friend-form.component';
import { FriendRowComponent } from '../../components/friend-row/friend-row.component';
import { IncomingRequestRowComponent } from '../../components/incoming-request-row/incoming-request-row.component';
import { OutgoingRequestRowComponent } from '../../components/outgoing-request-row/outgoing-request-row.component';

type FriendsTab = 'friends' | 'incoming' | 'outgoing';

@Component({
  selector: 'app-friends-page',
  standalone: true,
  imports: [
    BackButtonComponent,
    MatIconModule,
    AddFriendFormComponent,
    FriendRowComponent,
    IncomingRequestRowComponent,
    OutgoingRequestRowComponent,
  ],
  templateUrl: './friends-page.component.html',
  styleUrl: './friends-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly titleService = inject(Title);
  readonly store = inject(SocialStore);

  readonly activeTab = signal<FriendsTab>('friends');
  readonly creatingMatchFor = signal<string | null>(null);

  private readonly addFriendForm = viewChild(AddFriendFormComponent);

  ngOnInit(): void {
    this.titleService.setTitle('Amigos — Truco a 3');
    this.store.start();
    this.store.bootstrap();
  }

  selectTab(tab: FriendsTab): void {
    this.activeTab.set(tab);
  }

  goBack(): void {
    void this.router.navigateByUrl('/lobby');
  }

  onSend(username: string): void {
    const started = this.store.sendRequest(username);
    if (started) {
      this.addFriendForm()?.reset();
    }
  }

  onAccept(username: string): void {
    this.confirm(
      {
        title: `¿Aceptar a ${username}?`,
        message: 'Pasarán a ser amigos y podrán invitarse a partidas.',
        confirmLabel: 'Aceptar',
        cancelLabel: 'Cancelar',
        variant: 'primary',
      },
      () => this.store.acceptRequest(username),
    );
  }

  onDecline(username: string): void {
    this.confirm(
      {
        title: `¿Rechazar la solicitud de ${username}?`,
        message: 'Se descartará la solicitud. Podrán volver a enviarte una más adelante.',
        confirmLabel: 'Rechazar',
        cancelLabel: 'Cancelar',
        variant: 'destructive',
      },
      () => this.store.declineRequest(username),
    );
  }

  onCancel(username: string): void {
    this.confirm(
      {
        title: `¿Cancelar la solicitud a ${username}?`,
        message: 'Se retirará la solicitud enviada. Podés volver a enviarla más adelante.',
        confirmLabel: 'Cancelar solicitud',
        cancelLabel: 'Volver',
        variant: 'destructive',
      },
      () => this.store.cancelRequest(username),
    );
  }

  onSpectateMatch(matchId: string): void {
    void this.router.navigate(['/spectate', matchId]);
  }

  onInviteToMatch(username: string): void {
    if (this.creatingMatchFor() !== null) {
      return;
    }

    this.creatingMatchFor.set(username);
    void this.router
      .navigate(['/lobby/online'], { queryParams: { inviteFriend: username } })
      .finally(() => this.creatingMatchFor.set(null));
  }

  /** Confirma el cambio de `acceptsFriendRequests` antes de aplicarlo (toggle). */
  onOpenPreferences(): void {
    const current = this.store.preferences()?.acceptsFriendRequests ?? true;
    const next = !current;
    this.confirm(
      next
        ? {
            title: '¿Volver a aceptar solicitudes de amistad?',
            message: 'Otros jugadores van a poder enviarte solicitudes de amistad de nuevo.',
            confirmLabel: 'Aceptar solicitudes',
            cancelLabel: 'Cancelar',
            variant: 'primary',
          }
        : {
            title: '¿Dejar de aceptar solicitudes de amistad?',
            message:
              'Nadie va a poder enviarte nuevas solicitudes. Las pendientes no se ven afectadas y vos podés seguir enviando solicitudes a otros.',
            confirmLabel: 'Dejar de aceptar',
            cancelLabel: 'Cancelar',
            variant: 'destructive',
          },
      () => this.store.setAcceptsFriendRequests(next),
    );
  }

  onRemove(username: string): void {
    this.confirm(
      {
        title: `¿Eliminar a ${username}?`,
        message: 'Dejarán de ser amigos. Podés volver a enviar una solicitud más adelante.',
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        variant: 'destructive',
      },
      () => this.store.removeFriend(username),
    );
  }

  /** Abre el diálogo de confirmación y ejecuta `onConfirmed` sólo si el usuario confirma. */
  private confirm(data: ConfirmDialogData, onConfirmed: () => void): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { data, autoFocus: false, restoreFocus: true },
    );
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed === true) {
        onConfirmed();
      }
    });
  }
}
