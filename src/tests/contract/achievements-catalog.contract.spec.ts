import { describe, it, expect } from 'vitest';
import type {
  AchievementCatalogEntry,
  AchievementsCatalogResponse,
} from '../../app/core/models/profile.models';
import { readContrato } from './_docs';

const _catalog = {
  achievements: [
    { achievementCode: 'WIN_GAME_AS_PIE_MANO_BUSTS_ON_ENVIDO_WITH_0_0_AT_2_2' },
    { achievementCode: 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO' },
  ],
} satisfies AchievementsCatalogResponse;

const _entry: AchievementCatalogEntry = _catalog.achievements[0];

void _catalog;
void _entry;

function contract(): string {
  return readContrato('07-perfil-presencia.md');
}

describe('Contract: Catálogo de logros', () => {
  const content = contract();

  it('GET /api/achievements está documentado', () => {
    expect(content).toContain('GET /api/achievements');
  });

  it('cada entrada del catálogo expone solo achievementCode', () => {
    expect(Object.keys(_entry)).toEqual(['achievementCode']);
    expect(content).toContain('achievementCode');
  });

  it('la respuesta envuelve las entradas bajo achievements', () => {
    expect(Object.keys(_catalog)).toEqual(['achievements']);
    expect(Array.isArray(_catalog.achievements)).toBe(true);
  });
});
