import { describe, it, expect } from 'vitest';
import { readJwtExpiry } from './jwt.utils';

/** Construye un JWT de juguete (header.payload.signature) con el payload dado. */
function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>): string =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('readJwtExpiry', () => {
  it('devuelve exp en epochMs cuando el JWT es válido', () => {
    const token = makeJwt({ sub: 'player-1', exp: 1_700_000_000 });
    expect(readJwtExpiry(token)).toBe(1_700_000_000_000);
  });

  it('decodifica payloads con caracteres no ASCII (base64url + UTF-8)', () => {
    const token = makeJwt({ name: 'Martín', exp: 1_700_000_000 });
    expect(readJwtExpiry(token)).toBe(1_700_000_000_000);
  });

  it('devuelve null si el token no tiene 3 segmentos', () => {
    expect(readJwtExpiry('not-a-jwt')).toBeNull();
    expect(readJwtExpiry('my-access-token')).toBeNull();
  });

  it('devuelve null si el payload no es base64/JSON válido', () => {
    expect(readJwtExpiry('aaa.@@@.ccc')).toBeNull();
  });

  it('devuelve null si falta el claim exp o no es numérico', () => {
    expect(readJwtExpiry(makeJwt({ sub: 'player-1' }))).toBeNull();
    expect(readJwtExpiry(makeJwt({ exp: 'soon' }))).toBeNull();
  });
});
