// Historial de partidas — contrato docs/contratos/07-perfil-presencia.md §"Historial de partidas"
// GET /api/match-history: hasta 5 partidas terminadas del usuario autenticado, más reciente primero.

export type MatchOutcome = 'WON' | 'LOST';
export type MatchEndReason = 'FINISHED' | 'ABANDONED' | 'FORFEITED';

export interface MatchHistoryEntry {
  matchId: string;
  opponentName: string;
  opponentIsBot: boolean;
  outcome: MatchOutcome;
  endReason: MatchEndReason;
  ownGamesWon: number;
  opponentGamesWon: number;
  endedAt: number;
}

export interface MatchHistoryResponse {
  entries: MatchHistoryEntry[];
}
