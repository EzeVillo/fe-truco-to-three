import type { RoundWonDialogData } from '../components/round-won-dialog/round-won-dialog.component';

// Caso 1: Primer ronda ganada, mejor de 3. Vas 1–0. Serie continúa.
export const mockRoundWonFirstRound: RoundWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerRoundsWon: 1,
  opponentRoundsWon: 0,
  roundsToPlay: 3,
  roundNumber: 1,
  matchFinished: false,
  localWonMatch: false,
};

// Caso 2: Empatas la serie, mejor de 3. Queda una ronda.
export const mockRoundWonTieSeries: RoundWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerRoundsWon: 1,
  opponentRoundsWon: 1,
  roundsToPlay: 3,
  roundNumber: 2,
  matchFinished: false,
  localWonMatch: false,
};

// Caso 3: Ganás la ronda decisiva, mejor de 3. Serie definida 2–1.
export const mockRoundWonDecisive: RoundWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerRoundsWon: 2,
  opponentRoundsWon: 1,
  roundsToPlay: 3,
  roundNumber: 3,
  matchFinished: true,
  localWonMatch: true,
};

// Caso 4: Partida única (mejor de 1). Ganar la ronda = ganar la partida.
export const mockRoundWonSingleRound: RoundWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerRoundsWon: 1,
  opponentRoundsWon: 0,
  roundsToPlay: 1,
  roundNumber: 1,
  matchFinished: true,
  localWonMatch: true,
};

// Caso 5: Perdiste la ronda decisiva, mejor de 3. Serie perdida 1–2.
export const mockRoundLostDecisive: RoundWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerRoundsWon: 1,
  opponentRoundsWon: 2,
  roundsToPlay: 3,
  roundNumber: 3,
  matchFinished: true,
  localWonMatch: false,
};
