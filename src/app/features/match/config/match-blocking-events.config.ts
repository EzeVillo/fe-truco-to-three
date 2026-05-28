import type { MatchEventType } from '../models/match-ws-events';

export const BLOCKING_MATCH_EVENT_TYPES: ReadonlySet<MatchEventType> = new Set<MatchEventType>([
  'ENVIDO_RESOLVED',
  'GAME_SCORE_CHANGED',
  'MATCH_FINISHED',
  'MATCH_ABANDONED',
  'MATCH_FORFEITED',
]);

export function isBlockingEvent(eventType: MatchEventType): boolean {
  return BLOCKING_MATCH_EVENT_TYPES.has(eventType);
}
