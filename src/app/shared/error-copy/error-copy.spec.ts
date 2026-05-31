import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { getErrorCopy } from './error-copy';

function httpErr(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { message: 'BE-secret-leak' } });
}

describe('getErrorCopy — BOT_CATALOG', () => {
  it('401 → string vacío (manejado por interceptor)', () => {
    expect(getErrorCopy('BOT_CATALOG', httpErr(401))).toBe('');
  });

  it('403 → copy de permiso', () => {
    expect(getErrorCopy('BOT_CATALOG', httpErr(403))).toBe('No tenés permiso para ver los bots.');
  });

  it('404 → fallback (no catalogado)', () => {
    expect(getErrorCopy('BOT_CATALOG', httpErr(404))).toBe(
      'Ocurrió un error inesperado. Reintentá.',
    );
  });

  it('409 → fallback', () => {
    expect(getErrorCopy('BOT_CATALOG', httpErr(409))).toBe(
      'Ocurrió un error inesperado. Reintentá.',
    );
  });

  it('422 → fallback', () => {
    expect(getErrorCopy('BOT_CATALOG', httpErr(422))).toBe(
      'Ocurrió un error inesperado. Reintentá.',
    );
  });

  it('0 (red/offline) → copy de red', () => {
    expect(getErrorCopy('BOT_CATALOG', httpErr(0))).toBe('No pudimos cargar los bots. Reintentá.');
  });

  it('500/502/503 → copy de red', () => {
    expect(getErrorCopy('BOT_CATALOG', httpErr(500))).toBe(
      'No pudimos cargar los bots. Reintentá.',
    );
    expect(getErrorCopy('BOT_CATALOG', httpErr(503))).toBe(
      'No pudimos cargar los bots. Reintentá.',
    );
  });

  it('error no HttpErrorResponse → fallback', () => {
    expect(getErrorCopy('BOT_CATALOG', new Error('boom'))).toBe(
      'Ocurrió un error inesperado. Reintentá.',
    );
  });
});

describe('getErrorCopy - PROFILE', () => {
  it('401 devuelve string vacio', () => {
    expect(getErrorCopy('PROFILE', httpErr(401))).toBe('');
  });

  it('404 devuelve perfil no encontrado', () => {
    expect(getErrorCopy('PROFILE', httpErr(404))).toBe('No encontramos ese perfil.');
  });

  it('red y servidor devuelven copy de reintento', () => {
    expect(getErrorCopy('PROFILE', httpErr(0))).toBe('No pudimos cargar el perfil. ReintentÃ¡.');
    expect(getErrorCopy('PROFILE', httpErr(500))).toBe(
      'No pudimos cargar el perfil. ReintentÃ¡.',
    );
  });

  it('no filtra el mensaje del backend', () => {
    expect(getErrorCopy('PROFILE', httpErr(418))).not.toContain('BE-secret-leak');
  });
});

describe('getErrorCopy — CREATE_BOT_MATCH', () => {
  it('401 → string vacío', () => {
    expect(getErrorCopy('CREATE_BOT_MATCH', httpErr(401))).toBe('');
  });

  it('403 → copy de permiso', () => {
    expect(getErrorCopy('CREATE_BOT_MATCH', httpErr(403))).toBe(
      'No tenés permiso para crear esta partida.',
    );
  });

  it('404 → copy de bot no disponible', () => {
    expect(getErrorCopy('CREATE_BOT_MATCH', httpErr(404))).toBe(
      'El bot ya no está disponible, actualizá la lista.',
    );
  });

  it('409 y 422 → copy de configuración inválida', () => {
    expect(getErrorCopy('CREATE_BOT_MATCH', httpErr(409))).toBe(
      'La configuración elegida no es válida.',
    );
    expect(getErrorCopy('CREATE_BOT_MATCH', httpErr(422))).toBe(
      'La configuración elegida no es válida.',
    );
  });

  it('0 (red/offline) → copy de reintento', () => {
    expect(getErrorCopy('CREATE_BOT_MATCH', httpErr(0))).toBe(
      'No pudimos crear la partida. Reintentá en unos segundos.',
    );
  });

  it('5xx → copy de reintento', () => {
    expect(getErrorCopy('CREATE_BOT_MATCH', httpErr(502))).toBe(
      'No pudimos crear la partida. Reintentá en unos segundos.',
    );
  });

  it('otro código (418) → fallback', () => {
    expect(getErrorCopy('CREATE_BOT_MATCH', httpErr(418))).toBe(
      'Ocurrió un error inesperado. Reintentá.',
    );
  });

  it('error no HttpErrorResponse → fallback', () => {
    expect(getErrorCopy('CREATE_BOT_MATCH', null)).toBe('Ocurrió un error inesperado. Reintentá.');
  });
});
