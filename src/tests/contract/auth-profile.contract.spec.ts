import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  CurrentIdentityResponse,
  FullAuthResponse,
  GuestAuthResponse,
} from '../../app/core/models/auth.models';
import type { PlayerProfile } from '../../app/core/models/profile.models';

const _fullAuth = {
  playerId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  username: 'juancho',
  accessToken: '<jwt>',
  refreshToken: '<opaque-refresh-token>',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
} satisfies FullAuthResponse;

const _guestAuth = {
  playerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  accessToken: '<jwt>',
  accessTokenExpiresIn: 604800,
} satisfies GuestAuthResponse;

const _currentIdentity = {
  playerId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  username: 'juancho',
  tokenUse: 'user',
} satisfies CurrentIdentityResponse;

const _profile = {
  achievements: [
    {
      achievementCode: 'WIN_RETRUCO_FROM_0_0_TO_3',
      unlockedAt: 1772768158123,
      matchId: '550e8400-e29b-41d4-a716-446655440001',
      gameNumber: 1,
    },
  ],
  stats: {
    matchesPlayed: 42,
    matchesWon: 24,
    matchesLost: 18,
    winRate: 57,
  },
} satisfies PlayerProfile;

void _fullAuth;
void _guestAuth;
void _currentIdentity;
void _profile;

function contract(): string {
  return readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
}

describe('Contract: Auth y perfil de jugador', () => {
  const content = contract();

  it('auth registrado incluye username en register/login/refresh', () => {
    expect(Object.keys(_fullAuth).sort()).toEqual([
      'accessToken',
      'accessTokenExpiresIn',
      'playerId',
      'refreshToken',
      'refreshTokenExpiresIn',
      'username',
    ]);
    expect(content).toContain('"username": "juancho"');
  });

  it('auth guest no incluye username ni refreshToken', () => {
    expect(Object.keys(_guestAuth).sort()).toEqual([
      'accessToken',
      'accessTokenExpiresIn',
      'playerId',
    ]);
  });

  it('GET /api/auth/me expone playerId, username y tokenUse', () => {
    expect(Object.keys(_currentIdentity).sort()).toEqual(['playerId', 'tokenUse', 'username']);
    expect(content).toContain('GET /api/auth/me');
    expect(content).toContain('"tokenUse": "user"');
    expect(content).toContain('"tokenUse": "guest"');
  });

  it('GET /api/profile/{username} devuelve achievements y stats sin playerId', () => {
    expect(Object.keys(_profile).sort()).toEqual(['achievements', 'stats']);
    expect('playerId' in _profile).toBe(false);
    expect(content).toContain('GET /api/profile/{username}');
    expect(content).toContain('matchesPlayed');
    expect(content).toContain('achievementCode');
  });
});
