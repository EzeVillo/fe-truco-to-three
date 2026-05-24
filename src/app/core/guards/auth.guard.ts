import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

/**
 * Guard que protege rutas que requieren autenticación.
 * Usa CanMatchFn para que Angular no descargue el chunk lazy si el guard rechaza.
 */
export const authGuard: CanMatchFn = (_route, segments) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
};
