import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from './auth.service';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';

/** Opciones del modal de registro para invitados. */
export interface GuestRegisterPromptOptions {
  /** A dónde volver tras registrarse (queryParam returnUrl). Default: '/lobby'. */
  returnUrl?: string;
  /** Título del modal. Default: 'Solo para jugadores registrados'. */
  title?: string;
  /** Mensaje del modal. */
  message?: string;
}

/**
 * Modal compartido para invitados que intentan entrar a secciones que exigen
 * cuenta (campaña, perfil, amigos…). Si confirman, cierra la sesión de invitado
 * y los manda al registro con `returnUrl` para volver al lugar ya registrados.
 */
@Injectable({ providedIn: 'root' })
export class GuestRegisterPromptService {
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  prompt(options: GuestRegisterPromptOptions = {}): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: options.title ?? 'Solo para jugadores registrados',
          message:
            options.message ??
            'Esta sección es solo para jugadores registrados. ¿Querés crear una cuenta?',
          confirmLabel: 'Crear cuenta',
          cancelLabel: 'Ahora no',
          variant: 'primary',
        },
        panelClass: 't3-confirm-dialog',
        backdropClass: 't3-confirm-backdrop',
        autoFocus: 'button',
        restoreFocus: true,
      },
    );

    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed !== true) {
        return;
      }
      // logout() limpia la sesión de forma sincrónica antes de emitir, así que al
      // navegar el publicOnlyGuard de /register ya ve al usuario como anónimo.
      this.authService.logout().subscribe(() => {
        void this.router.navigate(['/register'], {
          queryParams: { returnUrl: options.returnUrl ?? '/lobby' },
        });
      });
    });
  }
}
