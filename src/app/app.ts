import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ProfileNotificationService } from './features/profile/services/profile-notification.service';
import { GlobalHeaderComponent } from './shared/components/global-header/global-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GlobalHeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authService = inject(AuthService);
  readonly profileNotifications = inject(ProfileNotificationService);

  constructor() {
    this.authService.rehydrateIdentityIfNeeded().subscribe();
    this.profileNotifications.start();
  }
}
