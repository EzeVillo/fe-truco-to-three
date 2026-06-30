import type {
  MatchEndReason,
  MatchHistoryEntry,
  MatchOutcome,
} from '../../../core/models/match-history.models';

/** Fecha de fin (epoch millis) → formato local es-AR, igual que el perfil. */
export function formatEndedAt(endedAt: number): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(endedAt));
}

/** Resultado para el jugador, en copy del front. */
export function outcomeLabel(outcome: MatchOutcome): string {
  return outcome === 'WON' ? 'Ganaste' : 'Perdiste';
}

/**
 * Contexto del cierre cuando no fue una partida jugada hasta el final. El abandono /
 * forfeit cuenta como derrota para quien lo provocó y victoria para el rival, así que
 * el texto se adapta al `outcome` del usuario. `FINISHED` no agrega nota (null).
 */
export function endReasonNote(outcome: MatchOutcome, endReason: MatchEndReason): string | null {
  if (endReason === 'FINISHED') {
    return null;
  }
  const won = outcome === 'WON';
  switch (endReason) {
    case 'ABANDONED':
      return won ? 'Tu rival abandonó' : 'Abandonaste';
    case 'FORFEITED':
      return won ? 'Tu rival no se presentó' : 'No te presentaste';
    default:
      return null;
  }
}

/** Marcador "propio-rival" desde la perspectiva del usuario. */
export function scoreLabel(entry: MatchHistoryEntry): string {
  return `${entry.ownGamesWon}-${entry.opponentGamesWon}`;
}
