import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CampaignWsEvent } from '../../app/core/models/ws.models';

/**
 * Contract test — canal /user/queue/campaign (§9.6).
 * El front no calcula puntos ni posición: `pointsAwarded`, `totalPoints` y las
 * posiciones llegan del BE en el push `CAMPAIGN_MATCH_POINTS`.
 */
const _campaignMatchPoints = {
  eventType: 'CAMPAIGN_MATCH_POINTS',
  timestamp: 1772768158123,
  payload: {
    matchId: '8b9c5936-9a1f-45ec-a587-24306689f6f7',
    rivalId: 'c0000000-0000-0000-0000-000000000041',
    won: true,
    pointsAwarded: 300,
    totalPoints: 14230,
    previousPosition: 42,
    newPosition: 39,
  },
} satisfies CampaignWsEvent;

void _campaignMatchPoints;

function contract(): string {
  return readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
}

describe('Contract: Campaign WS points', () => {
  const content = contract();

  it('documenta el canal /user/queue/campaign', () => {
    expect(content).toContain('/user/queue/campaign');
  });

  it('CAMPAIGN_MATCH_POINTS tiene eventType, timestamp y payload esperado', () => {
    expect(Object.keys(_campaignMatchPoints).sort()).toEqual(['eventType', 'payload', 'timestamp']);
    expect(Object.keys(_campaignMatchPoints.payload).sort()).toEqual([
      'matchId',
      'newPosition',
      'pointsAwarded',
      'previousPosition',
      'rivalId',
      'totalPoints',
      'won',
    ]);
  });

  it('el contrato describe el evento de puntos de campaña', () => {
    expect(content).toContain('CAMPAIGN_MATCH_POINTS');
    expect(content).toContain('"pointsAwarded"');
    expect(content).toContain('"totalPoints"');
  });
});
