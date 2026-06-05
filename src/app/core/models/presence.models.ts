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

export interface UserPresenceResponse {
  busy: boolean;
  match: PresenceMatch | null;
  league: PresenceTournament | null;
  cup: PresenceTournament | null;
  rematch: PresenceRematch | null;
}

export interface PresenceWsEvent {
  eventType: 'PRESENCE_UPDATED';
  timestamp: number;
  payload: UserPresenceResponse;
}

export type PresenceDestination =
  | { kind: 'match'; matchId: string }
  | { kind: 'rematch'; originMatchId: string }
  | { kind: 'none' };

export function derivePresenceDestination(
  presence: UserPresenceResponse,
): PresenceDestination {
  if (presence.match) {
    return { kind: 'match', matchId: presence.match.id };
  }

  if (presence.rematch) {
    return { kind: 'rematch', originMatchId: presence.rematch.originMatchId };
  }

  return { kind: 'none' };
}
