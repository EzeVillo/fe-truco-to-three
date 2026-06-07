import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { PresenceCoordinatorService } from './core/services/presence-coordinator.service';
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

  constructor() {
    this.authService.rehydrateIdentityIfNeeded().subscribe();
    this.presenceCoordinator.start();
    this.profileNotifications.start();
    this.social.start();
    this.uiClickSound.start();
  }
}
