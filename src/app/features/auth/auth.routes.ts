import type { Routes } from '@angular/router';
import { publicOnlyGuard } from '../../core/guards/public-only.guard';

/**
 * Rutas de la feature de autenticación.
 * Exportadas por simetría — permite evolucionar hacia loadChildren si se necesita.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    canMatch: [publicOnlyGuard],
    loadComponent: () =>
      import('./pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    canMatch: [publicOnlyGuard],
    loadComponent: () =>
      import('./pages/register-page/register-page.component').then((m) => m.RegisterPageComponent),
  },
];
