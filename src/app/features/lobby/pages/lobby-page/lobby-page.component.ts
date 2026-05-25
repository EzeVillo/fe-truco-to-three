import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './lobby-page.component.html',
  styleUrl: './lobby-page.component.scss',
})
export class LobbyPageComponent {
  private readonly router = inject(Router);

  goToBots(): void {
    void this.router.navigateByUrl('/lobby/vs-bots');
  }
}
