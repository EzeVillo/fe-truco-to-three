import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree, UrlSegment } from '@angular/router';
import type { Route } from '@angular/router';
import { publicOnlyGuard } from './public-only.guard';
import { AuthStore } from '../auth/auth.store';
import { SessionStorageService } from '../auth/session-storage.service';
import type { FullAuthResponse } from '../models/auth.models';

const FULL_AUTH: FullAuthResponse = {
  playerId: 'player-abc',
  username: 'juancho',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

describe('publicOnlyGuard', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    const fakeStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      return fakeStorage[key] ?? null;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    TestBed.configureTestingModule({
      providers: [provideRouter([]), SessionStorageService, AuthStore],
    });

    store = TestBed.inject(AuthStore);
  });

  function runGuard(segments: UrlSegment[] = [new UrlSegment('login', {})]) {
    return TestBed.runInInjectionContext(() => {
      const route = {} as Route;
      return publicOnlyGuard(route, segments);
    });
  }

  it('permite el acceso si el usuario NO está autenticado', () => {
    const result = runGuard();
    expect(result).toBe(true);
  });

  it('redirige a /lobby si el usuario YA está autenticado', () => {
    store.setSession(FULL_AUTH);
    const result = runGuard([new UrlSegment('login', {})]);
    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/lobby');
  });
});
