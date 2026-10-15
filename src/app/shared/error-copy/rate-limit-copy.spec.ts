import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { getErrorCopy, type ErrorCopyScope } from './error-copy';
import { RATE_LIMIT_COPY } from './rate-limit-copy';

describe('Rate limiting externo en acciones de juego', () => {
  const scopes: ErrorCopyScope[] = ['JOIN_MATCH', 'CHAT', 'PUBLIC_LOBBY', 'SOCIAL'];
  it.each(scopes)('mapea HTTP 429 en %s sin mostrar detalles del ingreso', (scope) => {
    expect(
      getErrorCopy(
        scope,
        new HttpErrorResponse({ status: 429, error: { message: 'private gateway detail' } }),
      ),
    ).toBe(RATE_LIMIT_COPY);
  });
});
