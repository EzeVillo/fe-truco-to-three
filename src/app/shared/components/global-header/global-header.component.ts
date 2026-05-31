import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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

  userLabel(): string {
    return this.authStore.isGuest() ? 'Invitado' : 'Jugador';
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
