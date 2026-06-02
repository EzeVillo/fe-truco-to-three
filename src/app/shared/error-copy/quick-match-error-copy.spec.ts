import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { getErrorCopy } from './error-copy';

function httpErr(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { message: 'BE-secret-leak' } });
}

describe('getErrorCopy - QUICK_MATCH', () => {
  it('401 devuelve string vacio', () => {
    expect(getErrorCopy('QUICK_MATCH', httpErr(401))).toBe('');
  });

  it('409 y 422 devuelven copy de disponibilidad sin filtrar mensaje crudo', () => {
    expect(getErrorCopy('QUICK_MATCH', httpErr(409))).toBe(
      'Ya estás en una partida, una revancha pendiente o una búsqueda activa.',
    );
    expect(getErrorCopy('QUICK_MATCH', httpErr(422))).toBe(
      'Ya estás en una partida, una revancha pendiente o una búsqueda activa.',
    );
    expect(getErrorCopy('QUICK_MATCH', httpErr(422))).not.toContain('BE-secret-leak');
  });

  it('red y servidor devuelven copy de reintento', () => {
    expect(getErrorCopy('QUICK_MATCH', httpErr(0))).toBe(
      'No pudimos buscar rival. Reintentá en unos segundos.',
    );
    expect(getErrorCopy('QUICK_MATCH', httpErr(500))).toBe(
      'No pudimos buscar rival. Reintentá en unos segundos.',
    );
  });

  it('otro codigo devuelve fallback sin filtrar mensaje crudo', () => {
    expect(getErrorCopy('QUICK_MATCH', httpErr(418))).toBe(
      'Ocurrió un error inesperado. Reintentá.',
    );
    expect(getErrorCopy('QUICK_MATCH', httpErr(418))).not.toContain('BE-secret-leak');
  });
});
