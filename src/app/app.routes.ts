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
    path: 'lobby/quick-match',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/lobby/pages/quick-match-page/quick-match-page.component').then(
        (m) => m.QuickMatchPageComponent,
      ),
  },
  {
    path: 'lobby/reglas',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/lobby/pages/rules-page/rules-page.component').then(
        (m) => m.RulesPageComponent,
      ),
  },
  {
    path: 'join/:joinCode',
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
  {
    path: 'profile/:username',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/profile/pages/profile-page/profile-page.component').then(
        (m) => m.ProfilePageComponent,
      ),
  },
  {
    path: 'friends',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/social/pages/friends-page/friends-page.component').then(
        (m) => m.FriendsPageComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
