import { Component, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import type { FormGroup } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapApiError } from '../../../../core/auth/map-api-error';
import { minLettersValidator, passwordStrengthValidator } from '../../../../core/auth/validators';
import type { UserFacingAuthError } from '../../../../core/models/auth.models';
import type { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatProgressSpinnerModule],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal<UserFacingAuthError | null>(null);
  returnUrl: string | null = null;

  registerForm!: FormGroup;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly titleService = inject(Title);

  ngOnInit(): void {
    this.titleService.setTitle('Crear cuenta — Truco a 3');
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    this.registerForm = this.fb.group({
      username: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[A-Za-z0-9]+$/), // solo letras y números
          minLettersValidator(3), // mínimo 3 letras ASCII
        ],
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(5),
          passwordStrengthValidator, // ≥1 número, ≥1 símbolo
        ],
      ],
    });
  }

  submit(): void {
    if (this.registerForm.invalid || this.loading()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { username, password } = this.registerForm.value as {
      username: string;
      password: string;
    };

    this.authService.register({ username, password }).subscribe({
      next: () => {
        // No apagamos loading acá: el componente se destruye al navegar.
        // Si la navegación se cancela (p. ej. un guard), re-habilitamos el botón.
        void this.router.navigateByUrl(this.returnUrl ?? '/lobby').then((ok) => {
          if (!ok) {
            this.loading.set(false);
          }
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const mappedError = mapApiError(err);
        this.error.set(mappedError);

        // Marcar el campo username con error si el backend reporta username-taken
        if (mappedError.kind === 'username-taken') {
          this.registerForm.get('username')?.setErrors({ usernameTaken: true });
        }
      },
    });
  }

  errorMessage(): string {
    const e = this.error();
    if (!e) {
      return '';
    }
    if (e.kind === 'username-taken') {
      return 'Ese usuario ya está en uso.';
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
