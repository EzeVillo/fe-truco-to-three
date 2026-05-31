// Modelos de autenticación
// Fuente: specs/001-auth-models-foundation/data-model.md §1

// ---------- Requests ----------

export interface RegisterRequest {
  username: string; // [A-Za-z0-9]+, ≥3 letras
  password: string; // ≥5 chars, ≥1 número, ≥1 símbolo
}

export interface LoginRequest {
  username: string;
  password: string;
}

// GuestRequest no existe: POST /api/auth/guest no lleva body.

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

// ---------- Responses ----------

/** Respuesta de register, login y refresh. */
export interface FullAuthResponse {
  playerId: string; // UUID
  username: string;
  accessToken: string; // JWT
  refreshToken: string; // token opaco
  accessTokenExpiresIn: number; // segundos
  refreshTokenExpiresIn: number; // segundos
}

/** Respuesta de POST /api/auth/guest (sin refreshToken). */
export interface GuestAuthResponse {
  playerId: string;
  accessToken: string;
  accessTokenExpiresIn: number;
}

export type AuthResponse = FullAuthResponse | GuestAuthResponse;

export interface CurrentIdentityResponse {
  playerId: string;
  username: string | null;
  tokenUse: 'user' | 'guest';
}

// ---------- Estado de sesión persistido ----------

export interface AuthSession {
  playerId: string;
  username: string | null;
  accessToken: string;
  refreshToken: string | null; // null si es guest
  isGuest: boolean;
  /** epochMs, derivado al recibir la respuesta. Solo en memoria, no se persiste. */
  accessTokenExpiresAt: number;
}

// ---------- Errores tipados ----------

/** ErrorResponse de docs/CONTRATOS_API.md §2 */
export interface ApiError {
  errorCode: string;
  message: string;
  timestamp: string;
  requestId?: string;
}

export type UserFacingAuthError =
  | { kind: 'invalid-credentials' }
  | { kind: 'username-taken' }
  | { kind: 'validation'; field?: string; message: string }
  | { kind: 'network' }
  | { kind: 'server'; message: string };
