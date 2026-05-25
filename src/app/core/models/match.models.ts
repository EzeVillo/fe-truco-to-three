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

// ---------- Feature 003-lobby-bots: formato de serie + creación vs bots ----------
// Fuente: specs/003-lobby-bots/data-model.md §SeriesFormat / §CreateBotMatch*

export type SeriesFormat = 'BEST_OF_1' | 'BEST_OF_3' | 'BEST_OF_5';

export const DEFAULT_SERIES_FORMAT: SeriesFormat = 'BEST_OF_3';

export const SERIES_FORMAT_LABELS: Record<SeriesFormat, string> = {
  BEST_OF_1: 'Mejor de 1',
  BEST_OF_3: 'Mejor de 3',
  BEST_OF_5: 'Mejor de 5',
};

export function seriesFormatToGamesToPlay(f: SeriesFormat): 1 | 3 | 5 {
  switch (f) {
    case 'BEST_OF_1':
      return 1;
    case 'BEST_OF_3':
      return 3;
    case 'BEST_OF_5':
      return 5;
  }
}

export interface CreateBotMatchRequest {
  /** UUID del bot seleccionado. */
  botId: string;
  /** Partidas totales de la serie (mejor de N). Valores válidos: 1, 3, 5. */
  gamesToPlay: 1 | 3 | 5;
}

export interface CreateBotMatchResponse {
  /** UUID del match recién creado. Usado para navegar a /match/:matchId. */
  matchId: string;
}
