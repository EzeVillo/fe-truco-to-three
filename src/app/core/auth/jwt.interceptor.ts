import { inject } from '@angular/core';
import type { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { catchError, switchMap } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { AUTH_PUBLIC_PATHS, ACCESS_TOKEN_REFRESH_SKEW_MS } from './auth.tokens';

/**
 * Interceptor funcional que añade el header Authorization: Bearer <accessToken>
 * a todas las requests protegidas.
 *
 * Excluye los paths de AUTH_PUBLIC_PATHS (endpoints de /api/auth/*) para
 * evitar interferir con el flujo de autenticación.
 *
 * Refresh proactivo: si el accessToken ya venció (o está dentro del margen de
 * skew) y hay refreshToken disponible, refresca ANTES de mandar la request.
 * Así se evita el 401 + reintento del refreshInterceptor, que queda como red
 * de seguridad para tokens que vencen en vuelo.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);

  // Excluir endpoints públicos de auth
  const isPublicPath = AUTH_PUBLIC_PATHS.some((path) => req.url.includes(path));
  if (isPublicPath) {
    return next(req);
  }

  const token = authStore.accessToken();
  if (!token) {
    return next(req);
  }

  if (shouldRefreshProactively(authStore)) {
    return authService.refresh().pipe(
      switchMap((freshToken) => next(withBearer(req, freshToken))),
      // Si el refresh proactivo falla, mandamos con el token actual y dejamos
      // que el refreshInterceptor reactivo maneje el 401 (logout/redirect).
      catchError(() => next(withBearer(req, token))),
    );
  }

  return next(withBearer(req, token));
};

function shouldRefreshProactively(authStore: InstanceType<typeof AuthStore>): boolean {
  const expiresAt = authStore.accessTokenExpiresAt();
  if (expiresAt === null || !authStore.refreshToken()) {
    return false;
  }
  return Date.now() >= expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS;
}

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
