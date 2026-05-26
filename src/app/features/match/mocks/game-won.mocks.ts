import type { GameWonDialogData } from '../components/game-won-dialog/game-won-dialog.component';

// Caso 1: Primer partida ganada, mejor de 3. Vas 1–0. Serie continúa.
export const mockGameWonFirstGame: GameWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerGamesWon: 1,
  opponentGamesWon: 0,
  gamesToPlay: 3,
  gameNumber: 1,
  matchFinished: false,
  localWonMatch: false,
};

// Caso 2: Empatas la serie, mejor de 3. Queda una partida.
export const mockGameWonTieSeries: GameWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerGamesWon: 1,
  opponentGamesWon: 1,
  gamesToPlay: 3,
  gameNumber: 2,
  matchFinished: false,
  localWonMatch: false,
};

// Caso 3: Ganás la partida decisiva, mejor de 3. Serie definida 2–1.
export const mockGameWonDecisive: GameWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerGamesWon: 2,
  opponentGamesWon: 1,
  gamesToPlay: 3,
  gameNumber: 3,
  matchFinished: true,
  localWonMatch: true,
};

// Caso 4: Partida única (mejor de 1). Ganar la partida = ganar la serie.
export const mockGameWonSingleGame: GameWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerGamesWon: 1,
  opponentGamesWon: 0,
  gamesToPlay: 1,
  gameNumber: 1,
  matchFinished: true,
  localWonMatch: true,
};

// Caso 5: Perdiste la partida decisiva, mejor de 3. Serie perdida 1–2.
export const mockGameLostDecisive: GameWonDialogData = {
  playerName: 'Yo',
  opponentName: 'Hans',
  playerGamesWon: 1,
  opponentGamesWon: 2,
  gamesToPlay: 3,
  gameNumber: 3,
  matchFinished: true,
  localWonMatch: false,
};
