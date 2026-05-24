import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

/**
 * Guard que bloquea rutas públicas (/login, /register) cuando ya hay sesión.
 * Redirige al lobby si el usuario ya está autenticado.
 */
export const publicOnlyGuard: CanMatchFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/lobby']);
};
