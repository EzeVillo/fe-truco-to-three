/**
 * Helper para tests: moca localStorage con un objeto fake en memoria.
 * Usar en beforeEach con vi.restoreAllMocks() en afterEach.
 *
 * @example
 * import { vi } from 'vitest';
 * import { setupFakeStorage } from '../../testing/fake-storage';
 *
 * let fakeStorage: Record<string, string>;
 * beforeEach(() => { fakeStorage = setupFakeStorage(); });
 */
export function setupFakeStorage(): Record<string, string> {
  const storage: Record<string, string> = {};

  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
    return storage[key] ?? null;
  });

  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    storage[key] = String(value);
  });

  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
    delete storage[key];
  });

  vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  });

  return storage;
}

// eslint workaround: vi is a global in vitest
import type * as Vitest from 'vitest';
declare const vi: Vitest.VitestUtils;
