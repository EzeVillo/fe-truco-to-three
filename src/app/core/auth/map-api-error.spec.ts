import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { mapApiError } from './map-api-error';
import { RATE_LIMIT_COPY } from '../../shared/error-copy/rate-limit-copy';

describe('Errores de autenticación del ingreso de producción', () => {
  it('muestra copia controlada cuando Cloudflare responde 429', () => {
    const result = mapApiError(
      new HttpErrorResponse({
        status: 429,
        error: { errorCode: 'RateLimitExceededException', message: 'private gateway detail' },
      }),
    );
    expect(result).toEqual({ kind: 'server', message: RATE_LIMIT_COPY });
  });

  it.each([400, 403, 418, 503])('ignora el mensaje crudo para HTTP %s', (status) => {
    const result = mapApiError(
      new HttpErrorResponse({ status, error: { message: 'private backend detail' } }),
    );
    expect(JSON.stringify(result)).not.toContain('private backend detail');
  });

  it('conserva los errores de red, credenciales y usuario ocupado', () => {
    expect(mapApiError(new HttpErrorResponse({ status: 0 }))).toEqual({ kind: 'network' });
    expect(mapApiError(new HttpErrorResponse({ status: 401 }))).toEqual({
      kind: 'invalid-credentials',
    });
    expect(mapApiError(new HttpErrorResponse({ status: 422 }))).toEqual({ kind: 'username-taken' });
  });
});
