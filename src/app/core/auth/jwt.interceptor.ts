import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { AuthStore } from './auth.store';
import { AUTH_PUBLIC_PATHS } from './auth.tokens';

/**
 * Interceptor funcional que añade el header Authorization: Bearer <accessToken>
 * a todas las requests protegidas.
 *
 * Excluye los paths de AUTH_PUBLIC_PATHS (endpoints de /api/auth/*) para
 * evitar interferir con el flujo de autenticación.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);

  // Excluir endpoints públicos de auth
  const isPublicPath = AUTH_PUBLIC_PATHS.some((path) => req.url.includes(path));
  if (isPublicPath) {
    return next(req);
  }

  const token = authStore.accessToken();
  if (!token) {
    return next(req);
  }

  const clonedReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(clonedReq);
};
