import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SpectatorCountStore } from './spectator-count.store';

describe('SpectatorCountStore', () => {
  let store: SpectatorCountStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SpectatorCountStore] });
    store = TestBed.inject(SpectatorCountStore);
  });

  it('arranca en 0', () => {
    expect(store.count()).toBe(0);
  });

  it('set actualiza el conteo', () => {
    store.set(3);
    expect(store.count()).toBe(3);
  });

  it('reset vuelve a 0', () => {
    store.set(5);
    store.reset();
    expect(store.count()).toBe(0);
  });
});
