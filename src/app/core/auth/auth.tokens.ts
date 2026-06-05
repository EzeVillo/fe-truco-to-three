// Constantes de autenticación compartidas entre interceptores y store

/** Clave única bajo la que se persiste la sesión en localStorage */
export const AUTH_STORAGE_KEY = 'tt3.session';

/**
 * Paths de /api/auth que NO deben pasar por jwtInterceptor ni refreshInterceptor.
 * Son endpoints públicos (sin Bearer) y excluidos del flujo de refresh.
 */
export const AUTH_PUBLIC_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/guest',
  '/api/auth/refresh',
] as const;

/**
 * Margen (ms) antes de la expiración del accessToken a partir del cual el
 * jwtInterceptor refresca de forma proactiva, evitando el 401 + reintento.
 */
export const ACCESS_TOKEN_REFRESH_SKEW_MS = 10_000;
