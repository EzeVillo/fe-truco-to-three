import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: localStorage.getItem('auth_token'),
  username: localStorage.getItem('auth_username'),
  isAuthenticated: !!localStorage.getItem('auth_token'),
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(initialState),
  withMethods((store) => ({
    setCredentials(token: string, username: string): void {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_username', username);
      patchState(store, { token, username, isAuthenticated: true });
    },
    clearCredentials(): void {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_username');
      patchState(store, { token: null, username: null, isAuthenticated: false });
    },
  })),
);
