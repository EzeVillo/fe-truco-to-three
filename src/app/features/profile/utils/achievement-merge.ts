import type { AchievementView, UnlockedAchievement } from '../../../core/models/profile.models';
import { getAchievementDisplay } from './achievement-display';

/**
 * Cruza el catálogo completo de logros (códigos) con los logros desbloqueados del perfil y devuelve
 * un view-model ordenado: desbloqueados primero (por fecha de desbloqueo descendente), luego los
 * bloqueados; desempate estable por código ascendente.
 *
 * - Une los códigos del catálogo con los del perfil para no perder un desbloqueado fuera de catálogo.
 * - Resuelve nombre/descripción por código vía `getAchievementDisplay` (con fallback genérico).
 */
export function mergeAchievements(
  catalogCodes: readonly string[],
  unlocked: readonly UnlockedAchievement[],
): AchievementView[] {
  const unlockedByCode = new Map<string, UnlockedAchievement>(
    unlocked.map((item) => [item.achievementCode, item]),
  );
  const codes = new Set<string>([...catalogCodes, ...unlockedByCode.keys()]);

  const views: AchievementView[] = [...codes].map((code) => {
    const display = getAchievementDisplay(code);
    const match = unlockedByCode.get(code);
    if (match) {
      return {
        code,
        name: display.name,
        description: display.description,
        unlocked: true,
        unlockedAt: match.unlockedAt,
        matchId: match.matchId,
        gameNumber: match.gameNumber,
      };
    }
    return { code, name: display.name, description: display.description, unlocked: false };
  });

  return views.sort(compareAchievements);
}

function compareAchievements(a: AchievementView, b: AchievementView): number {
  if (a.unlocked !== b.unlocked) {
    return a.unlocked ? -1 : 1;
  }
  if (a.unlocked && b.unlocked) {
    const byDate = (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0);
    if (byDate !== 0) {
      return byDate;
    }
  }
  return a.code.localeCompare(b.code);
}
