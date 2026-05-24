import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withHooks,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { inject } from '@angular/core';
import { SessionStorageService } from './session-storage.service';
import { AUTH_STORAGE_KEY } from './auth.tokens';
import type { AuthResponse, FullAuthResponse } from '../models/auth.models';

// ---------- Estado interno ----------

interface AuthState {
  playerId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isGuest: boolean;
  /** epochMs, calculado al recibir la respuesta. Solo en memoria, no se persiste. */
  accessTokenExpiresAt: number | null;
}

const ANON_STATE: AuthState = {
  playerId: null,
  accessToken: null,
  refreshToken: null,
  isGuest: false,
  accessTokenExpiresAt: null,
};

// ---------- Type guard para la sesión persistida ----------

interface PersistedSession {
  playerId: string;
  accessToken: string;
  refreshToken: string | null;
  isGuest: boolean;
}

function isPersistedSession(v: unknown): v is PersistedSession {
  if (typeof v !== 'object' || v === null) {
    return false;
  }
  const obj = v as Record<string, unknown>;
  return (
    typeof obj['playerId'] === 'string' &&
    typeof obj['accessToken'] === 'string' &&
    (obj['refreshToken'] === null || typeof obj['refreshToken'] === 'string') &&
    typeof obj['isGuest'] === 'boolean'
  );
}

// ---------- Helper para derivar AuthSession desde AuthResponse ----------

function deriveSession(response: AuthResponse): AuthState {
  const isGuest = !('refreshToken' in response);
  const fullResponse = response as FullAuthResponse;

  return {
    playerId: response.playerId,
    accessToken: response.accessToken,
    refreshToken: isGuest ? null : fullResponse.refreshToken,
    isGuest,
    accessTokenExpiresAt: Date.now() + response.accessTokenExpiresIn * 1000,
  };
}

// ---------- AuthStore ----------

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState<AuthState>(ANON_STATE),

  withComputed((store) => ({
    isAuthenticated: computed(() => !!store.playerId() && !!store.accessToken()),
  })),

  withMethods((store, sessionStorage = inject(SessionStorageService)) => ({
    /**
     * Deriva AuthSession desde AuthResponse, persiste en localStorage
     * y publica el nuevo estado. Operación atómica: storage primero.
     */
    setSession(response: AuthResponse): void {
      const newState = deriveSession(response);

      // Persistir (sin accessTokenExpiresAt — solo se guarda en memoria)
      const toSave: PersistedSession = {
        playerId: newState.playerId!,
        accessToken: newState.accessToken!,
        refreshToken: newState.refreshToken,
        isGuest: newState.isGuest,
      };
      sessionStorage.write(AUTH_STORAGE_KEY, toSave);

      patchState(store, newState);
    },

    /**
     * Actualiza solo los tokens (usado por refreshInterceptor tras un refresh exitoso).
     * Si llega refreshToken, lo rota; si no, lo mantiene.
     */
    updateAccessToken(token: string, expiresIn: number, refreshToken?: string): void {
      const update: Partial<AuthState> = {
        accessToken: token,
        accessTokenExpiresAt: Date.now() + expiresIn * 1000,
      };
      if (refreshToken !== undefined) {
        update.refreshToken = refreshToken;
      }
      patchState(store, update);
    },

    /**
     * Borra la sesión del storage y vuelve a estado ANON.
     * Operación atómica: storage primero.
     */
    clearSession(): void {
      sessionStorage.remove(AUTH_STORAGE_KEY);
      patchState(store, ANON_STATE);
    },
  })),

  withHooks({
    onInit(store, sessionStorage = inject(SessionStorageService)) {
      // Hidratación sincrónica desde localStorage al arrancar la app
      const saved = sessionStorage.read(AUTH_STORAGE_KEY, isPersistedSession);
      if (saved) {
        patchState(store, {
          playerId: saved.playerId,
          accessToken: saved.accessToken,
          refreshToken: saved.refreshToken,
          isGuest: saved.isGuest,
          accessTokenExpiresAt: null, // no se persiste; el refresh reactivo cubre expiraciones
        });
      }
    },
  }),
);
