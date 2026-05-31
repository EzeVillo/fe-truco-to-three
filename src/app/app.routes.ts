import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { publicOnlyGuard } from './core/guards/public-only.guard';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [publicOnlyGuard],
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page.component').then(
        (m) => m.LoginPageComponent,
      ),
  },
  {
    path: 'register',
    canMatch: [publicOnlyGuard],
    loadComponent: () =>
      import('./features/auth/pages/register-page/register-page.component').then(
        (m) => m.RegisterPageComponent,
      ),
  },
  {
    path: 'lobby',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/lobby/pages/lobby-page/lobby-page.component').then(
        (m) => m.LobbyPageComponent,
      ),
  },
  {
    path: 'lobby/vs-bots',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/lobby/pages/bots-config-page/bots-config-page.component').then(
        (m) => m.BotsConfigPageComponent,
      ),
  },
  {
    path: 'lobby/online',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/lobby/pages/online-match-page/online-match-page.component').then(
        (m) => m.OnlineMatchPageComponent,
      ),
  },
  {
    path: 'match/:matchId',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/match/pages/match-screen/match-screen.component').then(
        (m) => m.MatchScreenComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
