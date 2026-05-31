import { Component, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import type { FormGroup } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GuestCtaComponent } from '../../components/guest-cta/guest-cta.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapApiError } from '../../../../core/auth/map-api-error';
import type { UserFacingAuthError } from '../../../../core/models/auth.models';
import type { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatProgressSpinnerModule,
    GuestCtaComponent,
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal<UserFacingAuthError | null>(null);
  returnUrl: string | null = null;

  loginForm!: FormGroup;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    // US2: FormGroup tipado (se completa en US2 — aquí se deja la base)
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  submit(): void {
    if (this.loginForm.invalid || this.loading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { username, password } = this.loginForm.value as { username: string; password: string };

    this.authService.login({ username, password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl(this.returnUrl ?? '/lobby');
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
    if (e.kind === 'invalid-credentials') {
      return 'Usuario o contraseña incorrectos.';
    }
    if (e.kind === 'network') {
      return 'No pudimos conectar con el servidor. Probá de nuevo en un momento.';
    }
    if (e.kind === 'server') {
      return e.message;
    }
    return 'Ocurrió un error. Intentá de nuevo.';
  }
}
