// Modelos de partida — definidos pero no consumidos en esta feature
// Sirven de cimiento para features de lobby y partida
// Fuente: docs/CONTRATOS_API.md §4.14 y §8

import type { Suit, MatchStatus, RoundStatus, TrucoCall, AvailableActionType } from './enums';

export interface Card {
  suit: Suit; // 'ESPADA' | 'BASTO' | 'COPA' | 'ORO'
  number: number; // 1..12 según el contrato
}

export interface PlayedHand {
  cardPlayerOne: Card | null;
  cardPlayerTwo: Card | null;
  winner: string | null; // username del ganador de la mano
}

export interface CurrentHand {
  cardPlayerOne: Card | null;
  cardPlayerTwo: Card | null;
  mano: string; // username del "mano" de la ronda
}

export interface AvailableAction {
  type: AvailableActionType;
}

export interface RoundState {
  status: 'IN_PROGRESS' | 'FINISHED';
  currentTurn: string | null; // username
  myCards: Card[]; // solo se popula en GET /matches/{id} (no en spectate)
  roundStatus: RoundStatus;
  currentTrucoCall: TrucoCall | null;
  winner: string | null;
  availableActions: AvailableAction[];
  playedHands: PlayedHand[];
  currentHand: CurrentHand;
}

export interface MatchState {
  matchId: string;
  status: MatchStatus;
  scorePlayerOne: number;
  scorePlayerTwo: number;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
  matchWinner: string | null;
  roundGame: RoundState | null; // null si status !== 'IN_PROGRESS'
}
