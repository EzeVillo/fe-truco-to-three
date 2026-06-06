import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmLogoutDialogComponent } from '../confirm-logout-dialog/confirm-logout-dialog.component';

@Component({
  selector: 'app-global-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './global-header.component.html',
  styleUrl: './global-header.component.scss',
})
export class GlobalHeaderComponent {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Estando dentro de una partida, la navegación del header se bloquea (salvo "Salir"). */
  readonly inMatch = computed(() => /^\/match\//.test(this.currentUrl()));

  /** El acceso a Amigos es sólo para usuarios registrados (no guests) y fuera de partida. */
  readonly showFriends = computed(
    () => this.authStore.isAuthenticated() && !this.authStore.isGuest() && !this.inMatch(),
  );

  userLabel(): string {
    return this.authStore.isGuest() ? 'Invitado' : (this.authStore.username() ?? 'Jugador');
  }

  profileLink(): string | null {
    const username = this.authStore.username();
    return this.authStore.isGuest() || !username ? null : `/profile/${username}`;
  }

  onLogoutClick(): void {
    const ref = this.dialog.open<ConfirmLogoutDialogComponent, void, boolean>(
      ConfirmLogoutDialogComponent,
      { autoFocus: false, restoreFocus: true },
    );
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed === true) {
        this.authService.logout().subscribe();
        void this.router.navigateByUrl('/login');
      }
    });
  }
}
