import { describe, it, expect } from 'vitest';
import {
  canAccept,
  waitingForOpponent,
  opponentWants,
  opponentLeft,
  expired,
  confirmedMatchId,
  computeRematchCountdown,
  offerVisible,
} from './rematch-view';
import type { RematchSession } from '../models/rematch.models';

function makeSession(overrides: Partial<RematchSession> = {}): RematchSession {
  return {
    sessionId: 'sid-1',
    originMatchId: 'mid-1',
    status: 'OPEN',
    selfChoice: 'UNDECIDED',
    opponentChoice: 'UNDECIDED',
    expiresAt: Date.now() + 30_000,
    resultMatchId: null,
    ...overrides,
  };
}

describe('rematch-view — offerVisible', () => {
  it('devuelve false si no hay sesión', () => {
    expect(offerVisible(null)).toBe(false);
  });
  it('devuelve true si hay sesión', () => {
    expect(offerVisible(makeSession())).toBe(true);
  });
});

describe('rematch-view — canAccept', () => {
  it('true si OPEN + UNDECIDED', () => {
    expect(canAccept(makeSession({ status: 'OPEN', selfChoice: 'UNDECIDED' }))).toBe(true);
  });
  it('false si ya aceptó', () => {
    expect(canAccept(makeSession({ status: 'OPEN', selfChoice: 'WANTS_REMATCH' }))).toBe(false);
  });
  it('false si sesión no está OPEN', () => {
    expect(canAccept(makeSession({ status: 'EXPIRED', selfChoice: 'UNDECIDED' }))).toBe(false);
  });
  it('false si session es null', () => {
    expect(canAccept(null)).toBe(false);
  });
});

describe('rematch-view — waitingForOpponent', () => {
  it('true si OPEN + WANTS_REMATCH propio', () => {
    expect(waitingForOpponent(makeSession({ status: 'OPEN', selfChoice: 'WANTS_REMATCH' }))).toBe(true);
  });
  it('false si OPEN + UNDECIDED', () => {
    expect(waitingForOpponent(makeSession({ status: 'OPEN', selfChoice: 'UNDECIDED' }))).toBe(false);
  });
  it('false si null', () => {
    expect(waitingForOpponent(null)).toBe(false);
  });
});

describe('rematch-view — opponentWants', () => {
  it('true si OPEN + opponentChoice WANTS_REMATCH', () => {
    expect(opponentWants(makeSession({ status: 'OPEN', opponentChoice: 'WANTS_REMATCH' }))).toBe(true);
  });
  it('false si CLOSED_BY_LEAVE aunque opponentChoice fuera WANTS_REMATCH', () => {
    expect(opponentWants(makeSession({ status: 'CLOSED_BY_LEAVE', opponentChoice: 'WANTS_REMATCH' }))).toBe(false);
  });
  it('false si null', () => {
    expect(opponentWants(null)).toBe(false);
  });
});

describe('rematch-view — opponentLeft', () => {
  it('true si CLOSED_BY_LEAVE', () => {
    expect(opponentLeft(makeSession({ status: 'CLOSED_BY_LEAVE' }))).toBe(true);
  });
  it('false si OPEN', () => {
    expect(opponentLeft(makeSession({ status: 'OPEN' }))).toBe(false);
  });
  it('false si null', () => {
    expect(opponentLeft(null)).toBe(false);
  });
});

describe('rematch-view — expired', () => {
  it('true si EXPIRED', () => {
    expect(expired(makeSession({ status: 'EXPIRED' }))).toBe(true);
  });
  it('false si OPEN', () => {
    expect(expired(makeSession({ status: 'OPEN' }))).toBe(false);
  });
  it('false si null', () => {
    expect(expired(null)).toBe(false);
  });
});

describe('rematch-view — confirmedMatchId', () => {
  it('devuelve resultMatchId si CONFIRMED', () => {
    const id = confirmedMatchId(makeSession({ status: 'CONFIRMED', resultMatchId: 'new-match-99' }));
    expect(id).toBe('new-match-99');
  });
  it('null si no CONFIRMED', () => {
    expect(confirmedMatchId(makeSession({ status: 'OPEN', resultMatchId: null }))).toBeNull();
  });
  it('null si session es null', () => {
    expect(confirmedMatchId(null)).toBeNull();
  });
});

describe('rematch-view — computeRematchCountdown', () => {
  it('devuelve 0 si session es null', () => {
    expect(computeRematchCountdown(null, 0, Date.now())).toBe(0);
  });

  it('devuelve 0 si expiresAt es null', () => {
    const s = makeSession({ expiresAt: null });
    expect(computeRematchCountdown(s, 0, Date.now())).toBe(0);
  });

  it('devuelve tiempo restante positivo si no venció', () => {
    const now = Date.now();
    const expiresAt = now + 10_000;
    const s = makeSession({ expiresAt });
    const remaining = computeRematchCountdown(s, 0, now);
    expect(remaining).toBeGreaterThan(9_000);
    expect(remaining).toBeLessThanOrEqual(10_000);
  });

  it('devuelve 0 si ya venció', () => {
    const now = Date.now();
    const expiresAt = now - 5_000;
    const s = makeSession({ expiresAt });
    expect(computeRematchCountdown(s, 0, now)).toBe(0);
  });

  it('aplica serverClockOffsetMs para corregir desfase de reloj', () => {
    const now = Date.now();
    const expiresAt = now + 10_000;
    const s = makeSession({ expiresAt });
    // Con offset +5s el servidor va adelantado → quedan 5s menos
    const remaining = computeRematchCountdown(s, 5_000, now);
    expect(remaining).toBeLessThanOrEqual(5_000);
  });
});
