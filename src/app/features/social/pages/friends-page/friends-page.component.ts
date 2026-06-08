import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
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
    this.store.acceptRequest(username);
  }

  onDecline(username: string): void {
    this.store.declineRequest(username);
  }

  onCancel(username: string): void {
    this.store.cancelRequest(username);
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

  onRemove(username: string): void {
    const data: ConfirmDialogData = {
      title: `¿Eliminar a ${username}?`,
      message: 'Dejarán de ser amigos. Podés volver a enviar una solicitud más adelante.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    };
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { data, autoFocus: false, restoreFocus: true },
    );
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed === true) {
        this.store.removeFriend(username);
      }
    });
  }
}
