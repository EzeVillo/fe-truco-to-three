// Modelos de la vista de espectador — feature 026-spectate-friends
// Fuente autoritativa: docs/CONTRATOS_API.md §4.15/§4.16/§7.4.5/§9.6

import type { MatchStatus, RoundStatus, TrucoCall, EnvidoCall } from './enums';
import type { PlayedHand, CurrentHand, ViewerSeat } from './match.models';

/** Partida espectable de un amigo (§7.4.5). Llega en la lista de amigos y sus deltas. */
export interface SpectatableMatch {
  id: string;
  status: 'IN_PROGRESS';
}

/** Ronda en la vista pública del espectador (§4.15 `currentRound`). Sin `myCards` ni `availableActions`. */
export interface SpectateRoundState {
  status: 'IN_PROGRESS' | 'FINISHED';
  currentTurn: string | null;
  roundStatus: RoundStatus;
  currentTrucoCall: TrucoCall | null;
  currentEnvidoCall: EnvidoCall | null;
  winner: string | null;
  playedHands: PlayedHand[];
  currentHand: CurrentHand;
  actionDeadline: number | null;
  turnDurationMillis: number | null;
  actionDeadlineSeat: ViewerSeat | null;
}

/** Snapshot público del match visible al espectador (§4.15 + SPECTATE_STATE §9.6). */
export interface SpectateMatchState {
  matchId: string;
  status: MatchStatus;
  scorePlayerOne: number;
  scorePlayerTwo: number;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
  matchWinner: string | null;
  stateVersion: number;
  currentRound: SpectateRoundState | null;
  spectatorCount: number;
  playerOneUsername: string;
  playerTwoUsername: string | null;
  gamesToPlay: 1 | 3 | 5;
}
