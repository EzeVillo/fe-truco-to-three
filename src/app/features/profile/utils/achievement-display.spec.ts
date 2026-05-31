import { describe, expect, it } from 'vitest';
import { getAchievementContext, getAchievementDisplay } from './achievement-display';

describe('achievement-display', () => {
  it('devuelve nombre y descripcion para WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO', () => {
    const display = getAchievementDisplay('WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO');

    expect(display.name).toBe('One Shot I');
    expect(display.description).toContain('3 a 0');
  });

  it('usa fallback seguro para codigos desconocidos', () => {
    const display = getAchievementDisplay('NEW_BACKEND_CODE');

    expect(display.code).toBe('NEW_BACKEND_CODE');
    expect(display.name).toBe('Logro desbloqueado');
  });

  it('formatea contexto de partida y game', () => {
    expect(getAchievementContext({ matchId: 'match-1', gameNumber: 2 })).toBe(
      'Game 2 · Partida match-1',
    );
  });
});
