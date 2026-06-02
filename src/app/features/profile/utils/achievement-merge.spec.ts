import { describe, it, expect } from 'vitest';
import { mergeAchievements } from './achievement-merge';
import { getAchievementDisplay } from './achievement-display';
import type { UnlockedAchievement } from '../../../core/models/profile.models';

function unlocked(code: string, unlockedAt: number): UnlockedAchievement {
  return { achievementCode: code, unlockedAt, matchId: `match-${code}`, gameNumber: 1 };
}

describe('mergeAchievements', () => {
  it('incluye todos los códigos del catálogo, marcando el estado de desbloqueo', () => {
    const result = mergeAchievements(
      ['FOLD_BEFORE_ANY_CARD_IS_PLAYED', 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO'],
      [unlocked('WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO', 1000)],
    );

    expect(result).toHaveLength(2);
    const byCode = Object.fromEntries(result.map((v) => [v.code, v]));
    expect(byCode['WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO'].unlocked).toBe(true);
    expect(byCode['FOLD_BEFORE_ANY_CARD_IS_PLAYED'].unlocked).toBe(false);
  });

  it('no duplica un código presente en catálogo y perfil', () => {
    const code = 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO';
    const result = mergeAchievements([code], [unlocked(code, 1000)]);

    expect(result.filter((v) => v.code === code)).toHaveLength(1);
  });

  it('conserva un desbloqueado que no está en el catálogo', () => {
    const result = mergeAchievements([], [unlocked('CODE_OUT_OF_CATALOG', 1000)]);

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('CODE_OUT_OF_CATALOG');
    expect(result[0].unlocked).toBe(true);
  });

  it('copia unlockedAt/matchId/gameNumber en los desbloqueados y los omite en bloqueados', () => {
    const code = 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO';
    const result = mergeAchievements([code, 'FOLD_BEFORE_ANY_CARD_IS_PLAYED'], [unlocked(code, 1234)]);
    const byCode = Object.fromEntries(result.map((v) => [v.code, v]));

    expect(byCode[code].unlockedAt).toBe(1234);
    expect(byCode[code].matchId).toBe(`match-${code}`);
    expect(byCode['FOLD_BEFORE_ANY_CARD_IS_PLAYED'].unlockedAt).toBeUndefined();
  });

  it('resuelve nombre/descripción por código vía getAchievementDisplay', () => {
    const code = 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO';
    const [view] = mergeAchievements([code], []);

    expect(view.name).toBe(getAchievementDisplay(code).name);
    expect(view.description).toBe(getAchievementDisplay(code).description);
  });

  it('usa el copy de fallback para un código desconocido', () => {
    const [view] = mergeAchievements(['UNKNOWN_CODE_XYZ'], []);

    expect(view.name).toBe(getAchievementDisplay('UNKNOWN_CODE_XYZ').name);
  });

  it('ordena los desbloqueados antes que los bloqueados', () => {
    const result = mergeAchievements(
      ['FOLD_BEFORE_ANY_CARD_IS_PLAYED', 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO'],
      [unlocked('WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO', 1000)],
    );

    expect(result[0].unlocked).toBe(true);
    expect(result[1].unlocked).toBe(false);
  });

  it('ordena los desbloqueados por unlockedAt descendente', () => {
    const result = mergeAchievements(
      ['WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO', 'FOLD_BEFORE_ANY_CARD_IS_PLAYED'],
      [
        unlocked('WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO', 1000),
        unlocked('FOLD_BEFORE_ANY_CARD_IS_PLAYED', 5000),
      ],
    );

    expect(result[0].code).toBe('FOLD_BEFORE_ANY_CARD_IS_PLAYED');
    expect(result[1].code).toBe('WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO');
  });

  it('desempata de forma estable por código ascendente (misma fecha o ambos bloqueados)', () => {
    const sameDate = mergeAchievements(
      [],
      [unlocked('B_CODE', 1000), unlocked('A_CODE', 1000)],
    );
    expect(sameDate.map((v) => v.code)).toEqual(['A_CODE', 'B_CODE']);

    const bothLocked = mergeAchievements(['B_LOCKED', 'A_LOCKED'], []);
    expect(bothLocked.map((v) => v.code)).toEqual(['A_LOCKED', 'B_LOCKED']);
  });
});
