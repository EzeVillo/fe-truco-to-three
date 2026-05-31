export interface PlayerStats {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
}

export interface UnlockedAchievement {
  achievementCode: string;
  unlockedAt: number;
  matchId: string;
  gameNumber: number;
}

export interface PlayerProfile {
  achievements: UnlockedAchievement[];
  stats: PlayerStats;
}

export interface AchievementDefinition {
  code: string;
  name: string;
  description: string;
}

interface WsEventBase<TType extends string, TPayload> {
  eventType: TType;
  timestamp: number;
  payload: TPayload;
}

export type ProfileWsEvent = WsEventBase<'ACHIEVEMENT_UNLOCKED', UnlockedAchievement>;
