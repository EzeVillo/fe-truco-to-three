import {
  ApplicationRef,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthService } from '../../../core/auth/auth.service';
import { GuestRegisterPromptService } from '../../../core/auth/guest-register-prompt.service';
import { PresenceCoordinatorService } from '../../../core/services/presence-coordinator.service';
import { NavigationLockService } from '../../../core/services/navigation-lock.service';
import { SpectatorCountStore } from '../../services/spectator-count.store';
import { MatchActionsService } from '../../../features/match/services/match-actions.service';
import { BotsApiService } from '../../../features/lobby/services/bots-api.service';
import { BackgroundMusicService } from '../../../features/match/services/background-music.service';
import { EffectsVolumeService } from '../../../core/services/effects-volume.service';
import { MatchesApiService } from '../../../features/lobby/services/matches-api.service';
import { ConfirmLogoutDialogComponent } from '../confirm-logout-dialog/confirm-logout-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { ChatStore } from '../../../features/chat/services/chat.store';

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
  private readonly guestRegisterPrompt = inject(GuestRegisterPromptService);
  private readonly presenceCoordinator = inject(PresenceCoordinatorService);
  private readonly navigationLock = inject(NavigationLockService);
  private readonly spectatorCountStore = inject(SpectatorCountStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly matchActions = inject(MatchActionsService);
  private readonly botsApi = inject(BotsApiService);
  private readonly matchesApi = inject(MatchesApiService);
  readonly backgroundMusic = inject(BackgroundMusicService);
  readonly effectsVolume = inject(EffectsVolumeService);

  readonly chatStore = inject(ChatStore);
  private readonly appRef = inject(ApplicationRef);

  readonly menuOpen = signal(false);
  readonly soundOpen = signal(false);

  /** El ítem "Chat" sólo se muestra dentro de una partida online activa. */
  readonly showChat = computed(() => this.chatStore.available() && this.inMatch());

  /** Badge "!" en la hamburguesa cuando hay un mensaje de chat sin leer. */
  readonly showChatBadge = computed(() => this.showChat() && this.chatStore.unread());

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

  /** matchId actual cuando se está espectando (`/spectate/:id`). */
  readonly currentSpectateMatchId = computed(() => {
    const url = this.currentUrl();
    const match = /^\/spectate\/([^\/]+)/.exec(url);
    return match ? match[1] : null;
  });

  /**
   * El espectador es el dueño de la bot-match (§9.2b) que está mirando. En ese
   * caso no se puede "dejar de ver" (ocupación por autoría): la única salida es
   * abandonar la partida, igual que un jugador, con el mismo contrato.
   */
  readonly isOwnedBotMatchSpectate = computed(() => {
    const owned = this.presenceCoordinator.presence()?.ownedBotMatch ?? null;
    const spectateId = this.currentSpectateMatchId();
    return (
      this.isSpectating() && owned !== null && spectateId !== null && owned.matchId === spectateId
    );
  });
  readonly busy = computed(
    () => this.inMatch() || this.presenceCoordinator.busy() || this.navigationLock.locked(),
  );

  /** Conteo de espectadores de la partida en curso (jugador o espectador). */
  readonly spectatorCount = this.spectatorCountStore.count;
  /** El badge `👁 N` se muestra dentro de una partida y sólo cuando hay ≥ 1 espectador. */
  readonly showSpectatorBadge = computed(
    () => (this.inMatch() || this.isSpectating()) && this.spectatorCount() > 0,
  );

  /**
   * "Amigos" se muestra a cualquier usuario logueado (incluidos invitados) fuera
   * de partida. Los invitados ven el ítem pero al tocarlo reciben el modal de
   * registro en vez de navegar (ver onGuestFriendsClick).
   */
  readonly showFriends = computed(() => this.authStore.isAuthenticated() && !this.busy());

  readonly currentMatchId = computed(() => {
    const url = this.currentUrl();
    const match = /^\/match\/([^\/]+)/.exec(url);
    return match ? match[1] : null;
  });

  readonly currentPresenceMatch = computed(() => {
    const id = this.currentMatchId();
    const match = this.presenceCoordinator.presence()?.match ?? null;
    return id !== null && match?.id === id ? match : null;
  });

  readonly isActiveMatch = computed(
    () => this.inMatch() && this.currentPresenceMatch()?.status === 'IN_PROGRESS',
  );

  readonly isWaitingMatch = computed(() => {
    const status = this.currentPresenceMatch()?.status;
    return this.inMatch() && (status === 'WAITING_FOR_PLAYERS' || status === 'READY');
  });

  readonly showAbandonMatch = computed(
    () =>
      (this.currentMatchId() !== null && this.isActiveMatch()) || this.isOwnedBotMatchSpectate(),
  );

  /** Id de la partida abandonable: la del match activo o, si no, la bot-match propia espectada. */
  readonly abandonableMatchId = computed(
    () => this.currentMatchId() ?? this.currentSpectateMatchId(),
  );
  readonly showLeaveWaitingRoom = computed(
    () => this.currentMatchId() !== null && this.isWaitingMatch(),
  );

  /** El control de música sólo aplica donde suena: partida o modo espectador. */
  readonly showMusicControl = computed(() => this.isActiveMatch() || this.isSpectating());

  /** Porcentaje de volumen (0-100) para el input range del menú. */
  readonly musicVolumePercent = computed(() => Math.round(this.backgroundMusic.volume() * 100));

  toggleMusic(): void {
    this.backgroundMusic.toggleEnabled();
  }

  onMusicVolumeInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.backgroundMusic.setVolume(value / 100);
  }

  /** Porcentaje de volumen (0-100) de los efectos para el input range del menú. */
  readonly effectsVolumePercent = computed(() => Math.round(this.effectsVolume.volume() * 100));

  toggleEffects(): void {
    this.effectsVolume.toggleEnabled();
  }

  onEffectsVolumeInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.effectsVolume.setVolume(value / 100);
  }

  userLabel(): string {
    return this.authStore.isGuest() ? 'Invitado' : (this.authStore.username() ?? 'Jugador');
  }

  profileLink(): string | null {
    const username = this.authStore.username();
    return this.authStore.isGuest() || !username ? null : `/profile/${username}`;
  }

  /**
   * Invitado tocando "Mi perfil": el perfil exige cuenta. Abre el modal de
   * registro (mismo que campaña) en vez de navegar.
   */
  onGuestProfileClick(): void {
    this.closeMenu();
    this.guestRegisterPrompt.prompt({ returnUrl: '/lobby' });
  }

  /**
   * Invitado tocando "Historial": el historial exige cuenta (los guests no lo
   * acumulan). Abre el modal de registro, igual que "Mi perfil".
   */
  onGuestHistoryClick(): void {
    this.closeMenu();
    this.guestRegisterPrompt.prompt({ returnUrl: '/history' });
  }

  /**
   * Invitado tocando "Amigos": la sección de amigos exige cuenta. Abre el modal
   * de registro y, al confirmar, vuelve a /friends ya registrado.
   */
  onGuestFriendsClick(): void {
    this.closeMenu();
    this.guestRegisterPrompt.prompt({ returnUrl: '/friends' });
  }

  toggleMenu(): void {
    this.soundOpen.set(false);
    this.menuOpen.update((open) => !open);
  }

  /** Popover de sonido: vive al lado de la hamburguesa y es mutuamente excluyente con ella. */
  toggleSound(): void {
    this.menuOpen.set(false);
    this.soundOpen.update((open) => !open);
  }

  closeSound(): void {
    this.soundOpen.set(false);
  }

  /** Deja de mirar: vuelve a Amigos. SpectateScreenComponent.ngOnDestroy libera la sesión. */
  leaveSpectate(): void {
    this.closeMenu();
    void this.router.navigate(['/friends']);
  }

  onAbandonClick(): void {
    this.closeMenu();
    const matchId = this.abandonableMatchId();
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
    // La bot-match propia (§9.2b) se abandona por su endpoint dedicado
    // (POST /api/matches/bot-vs-bot/{id}/abandon), distinto del abandono de
    // partida con humanos (§4.12). El creador la corta desde el modo espectador.
    const isBotMatch = this.isOwnedBotMatchSpectate();
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed === true) {
        const abandon$ = isBotMatch
          ? this.botsApi.abandonBotVsBotMatch(matchId)
          : this.matchActions.abandon(matchId);
        abandon$.subscribe({
          next: () => {
            // El evento MATCH_ABANDONED abre el modal de resultado (partida o espectador).
          },
          error: () => {
            // Error silencioso; el usuario permanece en la pantalla actual.
          },
        });
      }
    });
  }

  onLeaveWaitingRoomClick(): void {
    this.closeMenu();
    const matchId = this.currentMatchId();
    if (!matchId) {
      return;
    }
    const ref = this.dialog.open<ConfirmDialogComponent, unknown, boolean>(ConfirmDialogComponent, {
      data: {
        title: '¿Salir de la sala?',
        message: 'Vas a dejar esta sala antes de que empiece.',
        variant: 'primary',
        confirmLabel: 'Salir de la sala',
        cancelLabel: 'Cancelar',
      },
      panelClass: 't3-confirm-dialog',
      backdropClass: 't3-confirm-backdrop',
      autoFocus: 'button',
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed === true) {
        this.matchesApi.leaveMatch(matchId).subscribe({
          next: () => {
            void this.router.navigateByUrl('/lobby');
          },
          error: () => {
            // Error silencioso; el usuario permanece en la sala.
          },
        });
      }
    });
  }

  openChat(): void {
    this.closeMenu();
    this.chatStore.togglePanel();
    // Forzar change detection de toda la app para que Angular inserte el panel
    // en el DOM de forma sincrónica, dentro del mismo gesto del usuario.
    // Así iOS permite mostrar el teclado al hacer focus programático.
    this.appRef.tick();
    const textarea = document.querySelector('.chat-panel__textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.focus();
    }
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
    if (!this.menuOpen() && !this.soundOpen()) {
      return;
    }

    const target = event.target;
    if (target instanceof Node && !this.host.nativeElement.contains(target)) {
      this.closeMenu();
      this.closeSound();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
    this.closeSound();
  }
}
