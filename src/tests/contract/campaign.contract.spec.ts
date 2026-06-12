/**
 * Contract test - Modo campaña (§7.7)
 *
 * GET /api/campaign (§7.7.1) y POST /api/campaign/challenges (§7.7.2).
 * El FE no deriva progresión: `challengeable`, posiciones y puntos llegan del BE.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  CampaignRankingEntry,
  CampaignRecord,
  CampaignResponse,
  CreateCampaignChallengeRequest,
  CreateCampaignChallengeResponse,
} from '../../app/core/models/campaign.models';

const _recordCheck = {
  wins: 0,
  losses: 0,
} satisfies Record<keyof CampaignRecord, number>;

const _entryCheck: CampaignRankingEntry = {
  position: 41,
  participantId: 'c41',
  displayName: 'Cacho Toledo',
  points: 14600,
  player: false,
  challengeable: true,
  record: { wins: 0, losses: 1 },
};

const _resCheck: CampaignResponse = {
  playerPosition: 42,
  playerPoints: 14230,
  totalBots: 100,
  defeatedRivals: 58,
  topOneReached: false,
  allRivalsDefeated: false,
  pointsToNextPosition: 370,
  activeChallengeMatchId: null,
  ranking: [_entryCheck],
};

const _challengeReqCheck: CreateCampaignChallengeRequest = { botId: 'c41' };

const _challengeResCheck: CreateCampaignChallengeResponse = {
  matchId: 'm1',
  rivalId: 'c41',
  rivalName: 'Cacho Toledo',
  rivalPosition: 41,
};

void _recordCheck;

function campaignSection(): string {
  const docsPath = resolve(process.cwd(), 'docs/CONTRATOS_API.md');
  const content = readFileSync(docsPath, 'utf-8');
  const sectionMatch = content.match(/##\s*7\.7\s+Modo Campaña[\s\S]*?(?=\n##\s*8\.|$)/);
  expect(sectionMatch, 'Sección §7.7 Modo Campaña no encontrada en CONTRATOS_API.md').toBeTruthy();
  return sectionMatch![0];
}

describe('Contract: Modo Campaña §7.7', () => {
  it('CampaignResponse contiene exactamente los campos de §7.7.1', () => {
    expect(Object.keys(_resCheck).sort()).toEqual(
      [
        'activeChallengeMatchId',
        'allRivalsDefeated',
        'defeatedRivals',
        'playerPoints',
        'playerPosition',
        'pointsToNextPosition',
        'ranking',
        'totalBots',
        'topOneReached',
      ].sort(),
    );
  });

  it('CampaignRankingEntry contiene exactamente los campos del item de ranking', () => {
    expect(Object.keys(_entryCheck).sort()).toEqual([
      'challengeable',
      'displayName',
      'participantId',
      'player',
      'points',
      'position',
      'record',
    ]);
  });

  it('CreateCampaignChallengeRequest/Response coinciden con §7.7.2', () => {
    expect(Object.keys(_challengeReqCheck)).toEqual(['botId']);
    expect(Object.keys(_challengeResCheck).sort()).toEqual([
      'matchId',
      'rivalId',
      'rivalName',
      'rivalPosition',
    ]);
  });

  it('docs/CONTRATOS_API.md §7.7 documenta endpoints, reglas y errores', () => {
    const section = campaignSection();

    expect(section).toContain('GET /api/campaign');
    expect(section).toContain('POST /api/campaign/challenges');
    expect(section).toContain('"activeChallengeMatchId"');
    expect(section).toContain('"challengeable"');
    expect(section).toContain('"pointsToNextPosition"');
    // Reglas de negocio (viven en el BE; el FE solo las refleja)
    expect(section).toContain('mejor de 5');
    expect(section).toMatch(/\*\*no\*\* ofrecen\s+revancha/);
    expect(section).toContain('REACH_CAMPAIGN_TOP_ONE');
    expect(section).toContain('DEFEAT_ALL_CAMPAIGN_RIVALS');
    // El desafío puntual por botId solo vale tras alcanzar el #1
    expect(section).toContain('botId');
    expect(section).toMatch(/solo se acepta cuando el jugador ya alcanzó el `#1`/);
  });

  it('los logros de campaña están en la lista de achievementCode (§8)', () => {
    const content = readFileSync(resolve(process.cwd(), 'docs/CONTRATOS_API.md'), 'utf-8');
    expect(content).toContain('- `REACH_CAMPAIGN_TOP_ONE`');
    expect(content).toContain('- `DEFEAT_ALL_CAMPAIGN_RIVALS`');
  });
});
