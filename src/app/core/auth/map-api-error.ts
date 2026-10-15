import type { HttpErrorResponse } from '@angular/common/http';
import type { UserFacingAuthError } from '../models/auth.models';
import { RATE_LIMIT_COPY } from '../../shared/error-copy/rate-limit-copy';

/**
 * Convierte un HttpErrorResponse del backend en un UserFacingAuthError tipado.
 * Fuente: specs/001-auth-models-foundation/contracts/auth-endpoints.md (tabla de errores)
 */
export function mapApiError(err: HttpErrorResponse): UserFacingAuthError {
  if (!err.status || err.status === 0) {
    // Error de red (sin respuesta del servidor)
    return { kind: 'network' };
  }

  const body = err.error as { errorCode?: string } | null | undefined;
  const errorCode = typeof body?.errorCode === 'string' ? body.errorCode : '';

  if (err.status === 429) {
    return { kind: 'server', message: RATE_LIMIT_COPY };
  }

  if (err.status === 401) {
    return { kind: 'invalid-credentials' };
  }

  if (err.status === 422) {
    return { kind: 'username-taken' };
  }

  if (err.status === 400) {
    return {
      kind: 'validation',
      message: 'Revisá los datos ingresados e intentá de nuevo.',
      field: errorCode.includes('Field') ? errorCode : undefined,
    };
  }

  if (err.status >= 500) {
    return {
      kind: 'server',
      message: 'No pudimos conectar con el servidor. Probá de nuevo en un momento.',
    };
  }

  return { kind: 'server', message: 'Ocurrió un error. Intentá de nuevo.' };
}
