import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthService } from '../../../core/auth/auth.service';
import { PresenceCoordinatorService } from '../../../core/services/presence-coordinator.service';
import { SpectatorCountStore } from '../../services/spectator-count.store';
import { MatchActionsService } from '../../../features/match/services/match-actions.service';
import { BackgroundMusicService } from '../../../features/match/services/background-music.service';
import { ConfirmLogoutDialogComponent } from '../confirm-logout-dialog/confirm-logout-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

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
  private readonly presenceCoordinator = inject(PresenceCoordinatorService);
  private readonly spectatorCountStore = inject(SpectatorCountStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly matchActions = inject(MatchActionsService);
  readonly backgroundMusic = inject(BackgroundMusicService);

  readonly menuOpen = signal(false);

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
  /** Estando como espectador (`/spectate/:id`), se ofrece "Dejar de ver" en el menú. */
  readonly isSpectating = computed(() => /^\/spectate\//.test(this.currentUrl()));
  readonly busy = computed(() => this.inMatch() || this.presenceCoordinator.busy());

  /** Conteo de espectadores de la partida en curso (jugador o espectador). */
  readonly spectatorCount = this.spectatorCountStore.count;
  /** El badge `👁 N` se muestra dentro de una partida y sólo cuando hay ≥ 1 espectador. */
  readonly showSpectatorBadge = computed(
    () => (this.inMatch() || this.isSpectating()) && this.spectatorCount() > 0,
  );

  /** El acceso a Amigos es sólo para usuarios registrados (no guests) y fuera de partida. */
  readonly showFriends = computed(
    () => this.authStore.isAuthenticated() && !this.authStore.isGuest() && !this.busy(),
  );

  readonly currentMatchId = computed(() => {
    const url = this.currentUrl();
    const match = /^\/match\/([^\/]+)/.exec(url);
    return match ? match[1] : null;
  });

  readonly showAbandonMatch = computed(() => this.inMatch() && this.currentMatchId() !== null);

  /** El control de música sólo aplica donde suena: partida o modo espectador. */
  readonly showMusicControl = computed(() => this.inMatch() || this.isSpectating());

  /** Porcentaje de volumen (0-100) para el input range del menú. */
  readonly musicVolumePercent = computed(() => Math.round(this.backgroundMusic.volume() * 100));

  toggleMusic(): void {
    this.backgroundMusic.toggleEnabled();
  }

  onMusicVolumeInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.backgroundMusic.setVolume(value / 100);
  }

  userLabel(): string {
    return this.authStore.isGuest() ? 'Invitado' : (this.authStore.username() ?? 'Jugador');
  }

  profileLink(): string | null {
    const username = this.authStore.username();
    return this.authStore.isGuest() || !username ? null : `/profile/${username}`;
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  /** Deja de mirar: vuelve a Amigos. SpectateScreenComponent.ngOnDestroy libera la sesión. */
  leaveSpectate(): void {
    this.closeMenu();
    void this.router.navigate(['/friends']);
  }

  onAbandonClick(): void {
    this.closeMenu();
    const matchId = this.currentMatchId();
    if (!matchId) {
      return;
    }
    const ref = this.dialog.open<ConfirmDialogComponent, unknown, boolean>(ConfirmDialogComponent, {
      data: {
        title: '¿Abandonar partida?',
        message: 'Si abandonás, perdés la partida.',
        variant: 'destructive',
        confirmLabel: 'Abandonar',
        cancelLabel: 'Cancelar',
      },
      panelClass: 't3-confirm-dialog',
      backdropClass: 't3-confirm-backdrop',
      autoFocus: 'button',
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed === true) {
        this.matchActions.abandon(matchId).subscribe({
          next: () => {
            void this.router.navigateByUrl('/lobby');
          },
          error: () => {
            // Error silencioso; el usuario permanece en la pantalla del match.
          },
        });
      }
    });
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  onLogoutClick(): void {
    this.closeMenu();
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) {
      return;
    }

    const target = event.target;
    if (target instanceof Node && !this.host.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }
}
