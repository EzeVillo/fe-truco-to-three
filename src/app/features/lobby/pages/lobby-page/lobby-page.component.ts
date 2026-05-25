import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [],
  templateUrl: './lobby-page.component.html',
  styleUrl: './lobby-page.component.scss',
})
export class LobbyPageComponent {
  private readonly router = inject(Router);

  goToBots(): void {
    void this.router.navigateByUrl('/lobby/vs-bots');
  }
}
