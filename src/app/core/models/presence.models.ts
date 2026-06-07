import type { MatchStatus } from './enums';

export type PresenceMatchStatus = Extract<
  MatchStatus,
  'WAITING_FOR_PLAYERS' | 'READY' | 'IN_PROGRESS'
>;

export interface PresenceMatch {
  id: string;
  status: PresenceMatchStatus;
}

export interface PresenceTournament {
  id: string;
  status: PresenceMatchStatus;
  currentMatchId: string | null;
}

export interface PresenceRematch {
  id: string;
  originMatchId: string;
}

export interface PresenceQuickMatch {
  status: 'SEARCHING';
  enqueuedAt: string;
}

/** Partida que el usuario está mirando como espectador (§7.6, feature 026). */
export interface PresenceSpectating {
  matchId: string;
}

export interface UserPresenceResponse {
  busy: boolean;
  match: PresenceMatch | null;
  league: PresenceTournament | null;
  cup: PresenceTournament | null;
  rematch: PresenceRematch | null;
  quickMatch: PresenceQuickMatch | null;
  /** No-nulo mientras el usuario tenga ≥1 suscripción de spectate activa (§7.6). */
  spectating: PresenceSpectating | null;
}

export interface PresenceWsEvent {
  eventType: 'PRESENCE_UPDATED';
  timestamp: number;
  payload: UserPresenceResponse;
}

export type PresenceDestination =
  | { kind: 'match'; matchId: string }
  | { kind: 'rematch'; originMatchId: string }
  | { kind: 'spectate'; matchId: string }
  | { kind: 'none' };

export function derivePresenceDestination(presence: UserPresenceResponse): PresenceDestination {
  if (presence.match) {
    return { kind: 'match', matchId: presence.match.id };
  }

  if (presence.rematch) {
    return { kind: 'rematch', originMatchId: presence.rematch.originMatchId };
  }

  if (presence.spectating) {
    return { kind: 'spectate', matchId: presence.spectating.matchId };
  }

  return { kind: 'none' };
}
