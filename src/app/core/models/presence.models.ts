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

/**
 * Partida bot-vs-bot (§9.2b) de la que el usuario es dueño y que aún no terminó.
 * Marca ocupación por autoría, independiente de `spectating` (mirar es opcional):
 * permite redirigir al dueño a la partida al reconectar aunque no esté suscripto.
 */
export interface PresenceOwnedBotMatch {
  matchId: string;
  status: PresenceMatchStatus;
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
  /** No-nulo mientras el usuario sea dueño de una bot-match en curso (§9.2b). */
  ownedBotMatch: PresenceOwnedBotMatch | null;
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

  // Dueño de una bot-match en curso que todavía no la está espectando (típico al
  // reconectar): lo llevamos a mirarla. Si ya la espectaba, `spectating` ya cubrió
  // este id arriba.
  if (presence.ownedBotMatch) {
    return { kind: 'spectate', matchId: presence.ownedBotMatch.matchId };
  }

  return { kind: 'none' };
}
