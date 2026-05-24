import { Component, inject, signal, Input } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapApiError } from '../../../../core/auth/map-api-error';
import type { UserFacingAuthError } from '../../../../core/models/auth.models';
import type { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-guest-cta',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './guest-cta.component.html',
  styleUrl: './guest-cta.component.scss',
})
export class GuestCtaComponent {
  /** URL de retorno opcional (por ejemplo desde un returnUrl de query params). */
  @Input() returnUrl: string | null = null;

  readonly loading = signal(false);
  readonly error = signal<UserFacingAuthError | null>(null);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  playAsGuest(): void {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.guest().subscribe({
      next: () => {
        this.loading.set(false);
        const target = this.returnUrl ?? '/lobby';
        void this.router.navigate([target]);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(mapApiError(err));
      },
    });
  }

  errorMessage(): string {
    const e = this.error();
    if (!e) {
      return '';
    }
    if (e.kind === 'network') {
      return 'No pudimos conectar con el servidor. Probá de nuevo en un momento.';
    }
    if (e.kind === 'server') {
      return e.message;
    }
    return 'Ocurrió un error al ingresar como invitado.';
  }
}
