import { Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { AudioPlaybackService } from './core/services/audio-playback.service';
import { PresenceCoordinatorService } from './core/services/presence-coordinator.service';
import { ServerWakeService } from './core/services/server-wake.service';
import { UiClickSoundService } from './core/services/ui-click-sound.service';
import { ProfileNotificationService } from './features/profile/services/profile-notification.service';
import { SocialStore } from './features/social/services/social.store';
import { InvitationToastComponent } from './features/social/components/invitation-toast/invitation-toast.component';
import { GlobalHeaderComponent } from './shared/components/global-header/global-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GlobalHeaderComponent, InvitationToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authService = inject(AuthService);
  readonly presenceCoordinator = inject(PresenceCoordinatorService);
  readonly profileNotifications = inject(ProfileNotificationService);
  readonly social = inject(SocialStore);
  private readonly uiClickSound = inject(UiClickSoundService);
  private readonly audioPlayback = inject(AudioPlaybackService);
  readonly serverWake = inject(ServerWakeService);

  private backendBooted = false;

  constructor() {
    // Despierta Render + Neon antes que nada y muestra la overlay si tarda.
    this.serverWake.start();

    // Los servicios que pegan al backend arrancan recién cuando readiness da 200.
    // Si no, en cada cold-start se dispararían como una tormenta de requests que
    // fallan (presencia, social, WebSocket) antes de que el server esté arriba.
    effect(() => {
      if (this.serverWake.isReady()) {
        untracked(() => this.bootBackendServices());
      }
    });

    // Audio: no toca el backend y debe anclar el desbloqueo de iOS al primer
    // gesto desde el bootstrap, así que arranca de inmediato.
    this.uiClickSound.start();
    this.audioPlayback.start();
  }

  private bootBackendServices(): void {
    if (this.backendBooted) {
      return;
    }

    this.backendBooted = true;
    this.authService.rehydrateIdentityIfNeeded().subscribe();
    this.presenceCoordinator.start();
    this.profileNotifications.start();
    this.social.start();
  }
}
