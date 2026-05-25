import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SessionStorageService } from './session-storage.service';

// Type guard auxiliar para tests
function isString(v: unknown): v is string {
  return typeof v === 'string';
}

interface SimpleObj {
  id: string;
  value: number;
}

function isSimpleObj(v: unknown): v is SimpleObj {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as SimpleObj).id === 'string' &&
    typeof (v as SimpleObj).value === 'number'
  );
}

describe('SessionStorageService', () => {
  let service: SessionStorageService;
  let fakeStorage: Record<string, string>;

  beforeEach(() => {
    fakeStorage = {};

    // Reemplazar localStorage con un fake controlable
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return fakeStorage[key] ?? null;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionStorageService);
  });

  describe('read()', () => {
    it('devuelve null cuando la clave no existe', () => {
      const result = service.read('no-existe', isString);
      expect(result).toBeNull();
    });

    it('devuelve el valor cuando el JSON es válido y pasa el type guard', () => {
      fakeStorage['mi-clave'] = JSON.stringify({ id: 'abc', value: 42 });
      const result = service.read('mi-clave', isSimpleObj);
      expect(result).toEqual({ id: 'abc', value: 42 });
    });

    it('devuelve null y purga la clave cuando el JSON es inválido (corrupto)', () => {
      fakeStorage['corrupto'] = '{"id": "abc", "value": 42'; // JSON incompleto
      const result = service.read('corrupto', isSimpleObj);
      expect(result).toBeNull();
      expect(fakeStorage['corrupto']).toBeUndefined();
    });

    it('devuelve null y purga la clave cuando el type guard falla', () => {
      fakeStorage['invalido'] = JSON.stringify({ id: 123, value: 'no-es-number' }); // tipos incorrectos
      const result = service.read('invalido', isSimpleObj);
      expect(result).toBeNull();
      expect(fakeStorage['invalido']).toBeUndefined();
    });
  });

  describe('write()', () => {
    it('serializa y escribe el valor en localStorage', () => {
      const obj: SimpleObj = { id: 'xyz', value: 99 };
      service.write('mi-clave', obj);
      expect(fakeStorage['mi-clave']).toBe(JSON.stringify(obj));
    });

    it('no lanza excepción ante QuotaExceededError', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(() => service.write('clave', { id: 'test', value: 1 })).not.toThrow();
    });
  });

  describe('remove()', () => {
    it('elimina la clave de localStorage', () => {
      fakeStorage['a-borrar'] = 'valor';
      service.remove('a-borrar');
      expect(fakeStorage['a-borrar']).toBeUndefined();
    });

    it('no lanza excepción si la clave no existe', () => {
      expect(() => service.remove('no-existe')).not.toThrow();
    });
  });
});
