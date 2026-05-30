export type RematchSessionStatus = 'OPEN' | 'CONFIRMED' | 'CLOSED_BY_LEAVE' | 'EXPIRED';

export type RematchChoice = 'UNDECIDED' | 'WANTS_REMATCH' | 'LEFT';

/** DTO del snapshot REST — GET /api/matches/{matchId}/rematch (§4.17.3).
 *  expiresAt llega en ISO-8601; normalizar a epochMillis antes de usar. */
export interface RematchSessionResponse {
  sessionId: string;
  originMatchId: string;
  status: RematchSessionStatus;
  playerOneChoice: RematchChoice;
  playerTwoChoice: RematchChoice;
  expiresAt: string;
  resultMatchId: string | null;
}

/** Vista de cliente mantenida por RematchStateService.
 *  expiresAt ya normalizado a epochMillis. */
export interface RematchSession {
  sessionId: string;
  originMatchId: string;
  status: RematchSessionStatus;
  selfChoice: RematchChoice;
  opponentChoice: RematchChoice;
  expiresAt: number | null;
  resultMatchId: string | null;
}
