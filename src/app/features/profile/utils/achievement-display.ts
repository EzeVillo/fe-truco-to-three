import type { AchievementDefinition } from '../../../core/models/profile.models';
import { ACHIEVEMENT_CATALOG } from '../models/achievement-catalog';

const UNKNOWN_ACHIEVEMENT: AchievementDefinition = {
  code: 'UNKNOWN',
  name: 'Logro desbloqueado',
  description: 'Conseguiste un nuevo hito en partidas contra otros jugadores.',
};

export function getAchievementDisplay(code: string): AchievementDefinition {
  return ACHIEVEMENT_CATALOG[code] ?? { ...UNKNOWN_ACHIEVEMENT, code };
}

export function getAchievementContext(payload: { matchId: string; gameNumber: number }): string {
  return `Game ${payload.gameNumber} · Partida ${payload.matchId}`;
}

export function formatUnlockedAt(unlockedAt: number): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unlockedAt));
}
