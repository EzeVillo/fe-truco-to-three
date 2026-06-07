// Adapter puro: SpectateMatchState → MatchState (entrada de deriveMatchView).
// Research D3: viewerSeat = PLAYER_ONE como perspectiva neutra de render;
// myCards y availableActions siempre vacíos (solo-lectura, SC-003).

import type { SpectateMatchState, SpectateRoundState } from '../../../core/models/spectate.models';
import type { MatchState, RoundState } from '../../../core/models/match.models';

function adaptRound(round: SpectateRoundState): RoundState {
  return {
    status: round.status,
    currentTurn: round.currentTurn,
    myCards: [],
    roundStatus: round.roundStatus,
    currentTrucoCall: round.currentTrucoCall,
    currentEnvidoCall: round.currentEnvidoCall,
    winner: round.winner,
    availableActions: [],
    playedHands: round.playedHands,
    currentHand: round.currentHand,
    actionDeadline: round.actionDeadline,
    turnDurationMillis: round.turnDurationMillis,
    actionDeadlineSeat: round.actionDeadlineSeat,
  };
}

export function adaptSpectateToMatchState(state: SpectateMatchState): MatchState {
  return {
    matchId: state.matchId,
    status: state.status,
    viewerSeat: 'PLAYER_ONE',
    playerOneUsername: state.playerOneUsername,
    playerTwoUsername: state.playerTwoUsername,
    gamesToPlay: state.gamesToPlay,
    scorePlayerOne: state.scorePlayerOne,
    scorePlayerTwo: state.scorePlayerTwo,
    gamesWonPlayerOne: state.gamesWonPlayerOne,
    gamesWonPlayerTwo: state.gamesWonPlayerTwo,
    matchWinner: state.matchWinner,
    roundGame: state.currentRound ? adaptRound(state.currentRound) : null,
  };
}
