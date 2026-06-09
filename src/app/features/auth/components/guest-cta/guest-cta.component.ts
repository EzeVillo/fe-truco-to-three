import { Component, inject, signal, Input, Output, EventEmitter } from '@angular/core';
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

  /** Permite que el contenedor deshabilite el botón mientras otra acción de auth está en curso. */
  @Input() disabled = false;

  /** Notifica al contenedor cuando cambia el estado de carga (para deshabilitar otros botones). */
  @Output() loadingChange = new EventEmitter<boolean>();

  readonly loading = signal(false);
  readonly error = signal<UserFacingAuthError | null>(null);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  playAsGuest(): void {
    if (this.loading() || this.disabled) {
      return;
    }

    this.setLoading(true);
    this.error.set(null);

    this.authService.guest().subscribe({
      next: () => {
        this.setLoading(false);
        const target = this.returnUrl ?? '/lobby';
        void this.router.navigateByUrl(target);
      },
      error: (err: HttpErrorResponse) => {
        this.setLoading(false);
        this.error.set(mapApiError(err));
      },
    });
  }

  private setLoading(value: boolean): void {
    this.loading.set(value);
    this.loadingChange.emit(value);
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
