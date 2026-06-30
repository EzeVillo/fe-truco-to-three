import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { getErrorCopy } from './error-copy';

function httpErr(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { message: 'BE-secret-leak' } });
}

function httpErrWithCode(status: number, errorCode: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { errorCode, message: 'BE-secret-leak' } });
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
    expect(getErrorCopy('PROFILE', httpErr(0))).toBe('No pudimos cargar el perfil. Reintentá.');
    expect(getErrorCopy('PROFILE', httpErr(500))).toBe('No pudimos cargar el perfil. Reintentá.');
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

describe('spectateErrorCopy', () => {
  // Importar el helper
  const { spectateErrorCopy } = require('./error-copy');

  it('devuelve mensaje amigable sin exponer el rawError', () => {
    const copy: string = spectateErrorCopy('NotSpectatingException: blah');
    expect(copy).not.toContain('NotSpectatingException');
    expect(copy.length).toBeGreaterThan(0);
  });

  it('funciona sin argumento', () => {
    expect(spectateErrorCopy()).toContain('partida');
  });
});

describe('getErrorCopy — SPECTATE', () => {
  it('401 → string vacío', () => {
    expect(getErrorCopy('SPECTATE', httpErr(401))).toBe('');
  });

  it('404 → copy de partida no encontrada', () => {
    expect(getErrorCopy('SPECTATE', httpErr(404))).toBe('Esta partida no existe o ya terminó.');
  });

  it('422 → copy de no autorizado', () => {
    expect(getErrorCopy('SPECTATE', httpErr(422))).toBe('No podés entrar a mirar esta partida.');
  });

  it('0 y 5xx → copy de red', () => {
    const expected = 'No pudimos conectarnos. Reintentá en unos segundos.';
    expect(getErrorCopy('SPECTATE', httpErr(0))).toBe(expected);
    expect(getErrorCopy('SPECTATE', httpErr(500))).toBe(expected);
  });

  it('nunca expone el message crudo del backend', () => {
    for (const status of [404, 422, 500]) {
      expect(getErrorCopy('SPECTATE', httpErr(status))).not.toContain('BE-secret-leak');
    }
  });
});

describe('getErrorCopy — ADVANCE_BOT_VS_BOT_MATCH', () => {
  it('401 → string vacío', () => {
    expect(getErrorCopy('ADVANCE_BOT_VS_BOT_MATCH', httpErr(401))).toBe('');
  });

  it('404 → copy de partida inexistente/terminada', () => {
    expect(getErrorCopy('ADVANCE_BOT_VS_BOT_MATCH', httpErr(404))).toBe(
      'Esta partida ya no existe o terminó.',
    );
  });

  it('422 → copy de no autorizado a avanzar', () => {
    expect(getErrorCopy('ADVANCE_BOT_VS_BOT_MATCH', httpErr(422))).toBe(
      'No podés avanzar esta partida.',
    );
  });

  it('0 y 5xx → copy de reintento', () => {
    const expected = 'No pudimos avanzar la jugada. Reintentá.';
    expect(getErrorCopy('ADVANCE_BOT_VS_BOT_MATCH', httpErr(0))).toBe(expected);
    expect(getErrorCopy('ADVANCE_BOT_VS_BOT_MATCH', httpErr(500))).toBe(expected);
  });

  it('nunca expone el message crudo del backend', () => {
    for (const status of [404, 422, 500]) {
      expect(getErrorCopy('ADVANCE_BOT_VS_BOT_MATCH', httpErr(status))).not.toContain(
        'BE-secret-leak',
      );
    }
  });
});

describe('busyReasonCopy — SPECTATING', () => {
  const { busyReasonCopy } = require('./error-copy');

  it('SPECTATING → Mirando una partida', () => {
    expect(busyReasonCopy('SPECTATING')).toBe('Mirando una partida');
  });
});

describe('getErrorCopy — CHAT', () => {
  it('401 → string vacío (manejado por interceptor)', () => {
    expect(getErrorCopy('CHAT', httpErr(401))).toBe('');
  });

  it('404 → chat no disponible', () => {
    expect(getErrorCopy('CHAT', httpErr(404))).toBe('El chat ya no está disponible.');
  });

  it('422 → esperar cooldown', () => {
    expect(getErrorCopy('CHAT', httpErr(422))).toBe(
      'Esperá un momento antes de enviar otro mensaje.',
    );
  });

  it('0 (red/offline) y 5xx → copy de red', () => {
    expect(getErrorCopy('CHAT', httpErr(0))).toBe('No pudimos enviar el mensaje. Reintentá.');
    expect(getErrorCopy('CHAT', httpErr(503))).toBe('No pudimos enviar el mensaje. Reintentá.');
  });

  it('nunca expone el message crudo del backend', () => {
    for (const status of [404, 422, 500]) {
      expect(getErrorCopy('CHAT', httpErr(status))).not.toContain('BE-secret-leak');
    }
  });

  it('error no HttpErrorResponse → fallback', () => {
    expect(getErrorCopy('CHAT', new Error('boom'))).toBe('Ocurrió un error inesperado. Reintentá.');
  });
});

describe('getErrorCopy — SOCIAL', () => {
  it('401 → string vacío (manejado por interceptor)', () => {
    expect(getErrorCopy('SOCIAL', httpErr(401))).toBe('');
  });

  it('404 → usuario/solicitud no disponible', () => {
    expect(getErrorCopy('SOCIAL', httpErr(404))).toBe(
      'Ese usuario no existe o la solicitud ya no está disponible.',
    );
  });

  it('409 y 422 → revisar estado de la solicitud', () => {
    const expected = 'No se pudo completar la acción: revisá el estado de la solicitud.';
    expect(getErrorCopy('SOCIAL', httpErr(409))).toBe(expected);
    expect(getErrorCopy('SOCIAL', httpErr(422))).toBe(expected);
  });

  it('FriendshipAlreadyExistsException → copy de amistad ya existente', () => {
    expect(getErrorCopy('SOCIAL', httpErrWithCode(409, 'FriendshipAlreadyExistsException'))).toBe(
      'Ya son amigos.',
    );
    expect(getErrorCopy('SOCIAL', httpErrWithCode(422, 'FriendshipAlreadyExistsException'))).toBe(
      'Ya son amigos.',
    );
  });

  it('FriendshipRequestAlreadyPendingException → copy de solicitud pendiente', () => {
    const expected = 'Ya hay una solicitud de amistad pendiente con este usuario.';
    expect(
      getErrorCopy('SOCIAL', httpErrWithCode(409, 'FriendshipRequestAlreadyPendingException')),
    ).toBe(expected);
    expect(
      getErrorCopy('SOCIAL', httpErrWithCode(422, 'FriendshipRequestAlreadyPendingException')),
    ).toBe(expected);
  });

  it('FriendLimitReachedException → copy de máximo de amigos alcanzado', () => {
    expect(getErrorCopy('SOCIAL', httpErrWithCode(422, 'FriendLimitReachedException'))).toBe(
      'Alguno de los dos ya alcanzó el máximo de amigos permitido.',
    );
  });

  it('0 (red/offline) y 5xx → copy de red', () => {
    const expected = 'No pudimos conectarnos. Reintentá en unos segundos.';
    expect(getErrorCopy('SOCIAL', httpErr(0))).toBe(expected);
    expect(getErrorCopy('SOCIAL', httpErr(503))).toBe(expected);
  });

  it('nunca expone el message crudo del backend', () => {
    for (const status of [404, 409, 422, 500]) {
      expect(getErrorCopy('SOCIAL', httpErr(status))).not.toContain('BE-secret-leak');
    }
  });
});
