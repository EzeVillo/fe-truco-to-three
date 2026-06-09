import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProfileWsEvent } from '../../app/core/models/profile.models';

const _achievementUnlocked = {
  eventType: 'ACHIEVEMENT_UNLOCKED',
  timestamp: 1772768158123,
  payload: {
    achievementCode: 'WIN_RETRUCO_FROM_0_0_TO_3',
    unlockedAt: 1772768158123,
    matchId: '8b9c5936-9a1f-45ec-a587-24306689f6f7',
    gameNumber: 1,
  },
} satisfies ProfileWsEvent;

void _achievementUnlocked;

function contract(): string {
  return readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
}

describe('Contract: Profile WS achievements', () => {
  const content = contract();

  it('documenta el canal /user/queue/profile', () => {
    expect(content).toContain('/user/queue/profile');
  });

  it('ACHIEVEMENT_UNLOCKED tiene eventType, timestamp y payload esperado', () => {
    expect(Object.keys(_achievementUnlocked).sort()).toEqual(['eventType', 'payload', 'timestamp']);
    expect(Object.keys(_achievementUnlocked.payload).sort()).toEqual([
      'achievementCode',
      'gameNumber',
      'matchId',
      'unlockedAt',
    ]);
  });

  it('el contrato excluye bots del tracking de logros', () => {
    expect(content).toContain('ACHIEVEMENT_UNLOCKED');
    expect(content).toMatch(
      /el bot no recibe logros|bots no generan tracking ni unlocks|partidas contra bots no generan tracking ni unlocks/i,
    );
  });
});
