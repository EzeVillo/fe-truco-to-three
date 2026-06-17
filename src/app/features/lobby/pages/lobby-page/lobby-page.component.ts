import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NavPendingDirective } from '../../../../shared/directives/nav-pending.directive';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [NavPendingDirective],
  templateUrl: './lobby-page.component.html',
  styleUrl: './lobby-page.component.scss',
})
export class LobbyPageComponent {
  private readonly router = inject(Router);

  constructor() {
    inject(Title).setTitle('Lobby — Truco a 3');
  }

  goToBots(): void {
    void this.router.navigateByUrl('/lobby/vs-bots');
  }

  goToBotsDuel(): void {
    void this.router.navigateByUrl('/lobby/bots-duel');
  }

  goToCampaign(): void {
    void this.router.navigateByUrl('/lobby/campaign');
  }

  goToQuickMatch(): void {
    void this.router.navigateByUrl('/lobby/quick-match');
  }

  goToOnline(): void {
    void this.router.navigateByUrl('/lobby/online');
  }

  goToRules(): void {
    void this.router.navigateByUrl('/reglas');
  }
}
