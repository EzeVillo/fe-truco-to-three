import { inject } from '@angular/core';
import type { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, Subject, take, filter } from 'rxjs';
import type { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { AUTH_PUBLIC_PATHS } from './auth.tokens';

// Estado de módulo compartido entre todas las llamadas al interceptor
let isRefreshing = false;
const newToken$ = new Subject<string | null>();

function retryWithToken(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  token: string,
): Observable<HttpEvent<unknown>> {
  const cloned = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(cloned);
}

/**
 * Interceptor funcional que maneja el refresh transparente de tokens.
 *
 * Para requests NO excluidas que reciben un 401:
 * 1. Si ya hay un refresh en vuelo → espera el resultado (single-flight).
 * 2. Si no hay refresh → dispara authService.refresh().
 * 3. Con el nuevo token, reintenta la request original UNA sola vez.
 * 4. Si el refresh falla → clearSession, navega a /login?returnUrl=..., propaga el 401.
 *
 * Algoritmo basado en research.md §3.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        AUTH_PUBLIC_PATHS.some((path) => req.url.includes(path))
      ) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        // Otro refresh ya está en vuelo — esperar su resultado
        return newToken$.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((token) => retryWithToken(req, next, token)),
          catchError(() => throwError(() => error)),
        );
      }

      // Iniciar refresh
      isRefreshing = true;

      return authService.refresh().pipe(
        switchMap((newToken) => {
          isRefreshing = false;
          newToken$.next(newToken);
          return retryWithToken(req, next, newToken);
        }),
        catchError((refreshError: unknown) => {
          isRefreshing = false;
          newToken$.next(null);

          authStore.clearSession();
          void router.navigate(['/login'], {
            queryParams: { returnUrl: router.url },
          });

          return throwError(() =>
            refreshError instanceof HttpErrorResponse ? refreshError : error,
          );
        }),
      );
    }),
  );
};
