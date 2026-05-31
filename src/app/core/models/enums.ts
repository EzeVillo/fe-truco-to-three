// Enums como union literal types — case-sensitive, alineados al contrato del backend
// Fuente: docs/CONTRATOS_API.md §8

export const SUIT = { ESPADA: 'ESPADA', BASTO: 'BASTO', COPA: 'COPA', ORO: 'ORO' } as const;
export type Suit = (typeof SUIT)[keyof typeof SUIT];

export const TRUCO_CALL = {
  TRUCO: 'TRUCO',
  RETRUCO: 'RETRUCO',
  VALE_CUATRO: 'VALE_CUATRO',
} as const;
export type TrucoCall = (typeof TRUCO_CALL)[keyof typeof TRUCO_CALL];

export const TRUCO_RESPONSE = {
  QUIERO: 'QUIERO',
  NO_QUIERO: 'NO_QUIERO',
  QUIERO_Y_ME_VOY_AL_MAZO: 'QUIERO_Y_ME_VOY_AL_MAZO',
} as const;
export type TrucoResponse = (typeof TRUCO_RESPONSE)[keyof typeof TRUCO_RESPONSE];

export const ENVIDO_CALL = {
  ENVIDO: 'ENVIDO',
  REAL_ENVIDO: 'REAL_ENVIDO',
  FALTA_ENVIDO: 'FALTA_ENVIDO',
} as const;
export type EnvidoCall = (typeof ENVIDO_CALL)[keyof typeof ENVIDO_CALL];

export const ENVIDO_RESPONSE = { QUIERO: 'QUIERO', NO_QUIERO: 'NO_QUIERO' } as const;
export type EnvidoResponse = (typeof ENVIDO_RESPONSE)[keyof typeof ENVIDO_RESPONSE];

export const MATCH_STATUS = {
  WAITING_FOR_PLAYERS: 'WAITING_FOR_PLAYERS',
  // READY: privada con ambos jugadores presentes, a la espera de que el anfitrión
  // inicie (§4.2/§4.13). El enum de §8.2 históricamente solo listaba
  // WAITING_FOR_PLAYERS/IN_PROGRESS/FINISHED; se agrega READY para reflejar el
  // estado previo al arranque manual. Ver feature 015 (research D1).
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
} as const;
export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

export const ROUND_STATUS = {
  PLAYING: 'PLAYING',
  ENVIDO_IN_PROGRESS: 'ENVIDO_IN_PROGRESS',
  TRUCO_IN_PROGRESS: 'TRUCO_IN_PROGRESS',
  FINISHED: 'FINISHED',
} as const;
export type RoundStatus = (typeof ROUND_STATUS)[keyof typeof ROUND_STATUS];

export const AVAILABLE_ACTION_TYPE = {
  PLAY_CARD: 'PLAY_CARD',
  CALL_TRUCO: 'CALL_TRUCO',
  CALL_ENVIDO: 'CALL_ENVIDO',
  RESPOND_TRUCO: 'RESPOND_TRUCO',
  RESPOND_ENVIDO: 'RESPOND_ENVIDO',
  FOLD: 'FOLD',
} as const;
export type AvailableActionType =
  (typeof AVAILABLE_ACTION_TYPE)[keyof typeof AVAILABLE_ACTION_TYPE];

export const SEAT = { PLAYER_ONE: 'PLAYER_ONE', PLAYER_TWO: 'PLAYER_TWO' } as const;
export type Seat = (typeof SEAT)[keyof typeof SEAT];

export const VISIBILITY = { PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' } as const;
export type Visibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];
