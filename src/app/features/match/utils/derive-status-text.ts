import type { MatchState } from '../../../core/models/match.models';

export function deriveStatusText(state: MatchState): string {
  if (state.status !== 'IN_PROGRESS' || state.roundGame === null) {
    return 'Esperando inicio';
  }

  const round = state.roundGame;
  const selfUsername =
    state.viewerSeat === 'PLAYER_ONE' ? state.playerOneUsername : state.playerTwoUsername;
  const opponentUsername =
    state.viewerSeat === 'PLAYER_ONE' ? state.playerTwoUsername : state.playerOneUsername;

  const handNumber = Math.min(Math.max(round.playedHands.length + 1, 1), 3);
  const handText = `Mano ${handNumber} de 3`;

  if (round.roundStatus === 'FINISHED') {
    return 'Fin de la mano';
  }

  if (round.currentTurn === selfUsername) {
    return `Tu turno \u00b7 ${handText}`;
  }

  if (round.currentTurn === opponentUsername) {
    return `Turno de ${opponentUsername} \u00b7 ${handText}`;
  }

  return handText;
}
