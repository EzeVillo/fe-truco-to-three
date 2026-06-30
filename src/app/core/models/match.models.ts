// Modelos de partida — definidos pero no consumidos en esta feature
// Sirven de cimiento para features de lobby y partida
// Fuente: docs/CONTRATOS_API.md §4.14 y §8

import type {
  Suit,
  MatchStatus,
  RoundStatus,
  TrucoCall,
  AvailableActionType,
  Visibility,
} from './enums';

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
  /**
   * Sub-opción específica de la acción. El BE usa dos formatos según el
   * transporte:
   *  - **WS** (`AVAILABLE_ACTIONS_UPDATED`): una acción por cada sub-opción,
   *    con `parameter` (singular).
   *  - **REST** (`GET /api/matches/{id}`): una sola acción por `type` con
   *    `parameters` (plural, array de strings).
   *
   * Valores típicos según `type`:
   *  - `CALL_TRUCO`     → `'TRUCO' | 'RETRUCO' | 'VALE_CUATRO'`
   *  - `CALL_ENVIDO`    → `'ENVIDO' | 'REAL_ENVIDO' | 'FALTA_ENVIDO'`
   *  - `RESPOND_TRUCO`  → `'QUIERO' | 'NO_QUIERO' | 'QUIERO_Y_ME_VOY_AL_MAZO'`
   *  - `RESPOND_ENVIDO` → `'QUIERO' | 'NO_QUIERO'`
   *  - `PLAY_CARD` / `FOLD` → sin parameter ni parameters.
   *
   * Usar `hasActionParameter()` para chequear de forma agnóstica al formato.
   */
  parameter?: string;
  parameters?: readonly string[];
}

/**
 * Chequea si una acción ofrece una sub-opción dada, soportando ambos formatos
 * del BE (WS `parameter` singular y REST `parameters` array).
 */
export function hasActionParameter(action: AvailableAction, parameter: string): boolean {
  if (action.parameter === parameter) {
    return true;
  }
  if (action.parameters?.includes(parameter)) {
    return true;
  }
  return false;
}

export interface RoundState {
  status: 'IN_PROGRESS' | 'FINISHED';
  currentTurn: string | null; // username
  myCards: Card[]; // solo se popula en GET /matches/{id} (no en spectate)
  roundStatus: RoundStatus;
  currentTrucoCall: TrucoCall | null;
  // Canto de envido pendiente de respuesta; null si no hay envido en curso o ya
  // se resolvió. Fuente: docs/CONTRATOS_API.md §8.2 (RoundStateResponse).
  currentEnvidoCall: EnvidoCall | null;
  // Username de quien cantó el truco/envido pendiente. Solo se pueblan al espectar
  // (snapshot §4.15); en el flujo de jugador quedan `undefined` y la vista cae a
  // inferir el cantor desde el respondedor. Ver derivePendingCall.
  currentTrucoCaller?: string | null;
  currentEnvidoCaller?: string | null;
  winner: string | null;
  availableActions: AvailableAction[];
  playedHands: PlayedHand[];
  currentHand: CurrentHand;
  // Cartas en mano de cada asiento, boca arriba. Solo se pueblan al espectar una
  // partida bot-vs-bot (§9.2b): el creador ve ambas manos. En el flujo de jugador
  // y en spectate con humanos quedan `undefined`/`null` y la vista cae al
  // comportamiento normal (mano propia desde `myCards`, rival con dorsos).
  handPlayerOne?: Card[] | null;
  handPlayerTwo?: Card[] | null;
  // Temporizador de turno — fuente: docs/CONTRATOS_API.md §4.14 y §4.18.
  // Los tres campos son consistentes entre sí: o los tres con valor (reloj
  // activo) o los tres null (sin reloj). Ver feature 013-turn-timer.
  actionDeadline: number | null; // epochMillis absoluto del límite de acción
  turnDurationMillis: number | null; // plazo total del turno (denominador del progreso)
  actionDeadlineSeat: ViewerSeat | null; // asiento al que aplica el reloj
}

export type ViewerSeat = 'PLAYER_ONE' | 'PLAYER_TWO';

/**
 * Vista de sala de espera del snapshot (§4.14, campo `lobby`). El backend la
 * devuelve sólo a quien ya está sentado en la partida y únicamente mientras está
 * en `WAITING_FOR_PLAYERS` o `READY` (es `null` en cualquier otro estado, mutuamente
 * excluyente con `roundGame`). Es la fuente de verdad para reconstruir la sala al
 * crear/recargar/reconectar sin depender del router state ni de sessionStorage.
 */
export interface MatchLobby {
  /** Visibilidad de la sala, para el título de la sala de espera. */
  visibility: Visibility;
  /** Código compartible para que un segundo jugador se una (§4.2). */
  joinCode: string;
  /** epochMillis en que la sala se cancela por inactividad; `null` si no corre reloj. */
  lobbyTimeoutDeadline: number | null;
  /** El asiento PLAYER_ONE ya confirmó que está listo (`/start`). */
  readyPlayerOne: boolean;
  /** El asiento PLAYER_TWO ya confirmó que está listo (`/start`). */
  readyPlayerTwo: boolean;
}

export interface MatchState {
  matchId: string;
  status: MatchStatus;
  // Nuevos campos del contrato §4.14 (feature 006-match-screen-ui)
  viewerSeat: ViewerSeat;
  playerOneUsername: string;
  // Nullable mientras la partida está en WAITING_FOR_PLAYERS (sin rival aún).
  // Fuente: docs/CONTRATOS_API.md §4.14. Ver feature 015 (research D2).
  playerTwoUsername: string | null;
  gamesToPlay: 1 | 3 | 5;
  scorePlayerOne: number;
  scorePlayerTwo: number;
  gamesWonPlayerOne: number;
  gamesWonPlayerTwo: number;
  matchWinner: string | null;
  // Cantidad de espectadores activos al momento de la consulta REST (§4.14).
  // Permite mostrar el conteo al entrar/reconectar sin esperar el próximo push
  // WS SPECTATOR_COUNT_CHANGED, que lo mantiene en vivo. Opcional por
  // compatibilidad con respuestas previas a su incorporación.
  spectatorCount?: number;
  roundGame: RoundState | null; // null si status !== 'IN_PROGRESS'
  // Vista de sala de espera (§4.14). Sólo no-null en WAITING_FOR_PLAYERS/READY y
  // mutuamente excluyente con roundGame. Trae joinCode + visibilidad para el host.
  lobby: MatchLobby | null;
}

// ---------- Feature 007-match-rest-actions: request DTOs para acciones ----------
// Fuente: docs/CONTRATOS_API.md §4.6–§4.11 y §8.1

import type { EnvidoCall, TrucoResponse, EnvidoResponse } from './enums';

/** §4.6 POST /api/matches/{matchId}/play-card */
export interface PlayCardRequest {
  suit: Suit;
  number: number; // 1..12
}

/** §4.9 POST /api/matches/{matchId}/envido */
export interface CallEnvidoRequest {
  call: EnvidoCall;
}

/** §4.8 POST /api/matches/{matchId}/truco/respond */
export interface RespondTrucoRequest {
  response: TrucoResponse;
}

/** §4.10 POST /api/matches/{matchId}/envido/respond */
export interface RespondEnvidoRequest {
  response: EnvidoResponse;
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

/**
 * §9.2b POST /api/matches/bot-vs-bot — crea una partida entre dos bots que el
 * usuario (dueño) puede espectar. Los dos bots deben ser distintos.
 */
export interface CreateBotVsBotMatchRequest {
  /** UUID del primer bot. */
  botOneId: string;
  /** UUID del segundo bot, distinto de `botOneId`. */
  botTwoId: string;
  /** Partidas totales de la serie (mejor de N). Valores válidos: 1, 3, 5. */
  gamesToPlay: 1 | 3 | 5;
}

export interface CreateBotVsBotMatchResponse {
  /** UUID del match creado. Usado para navegar a /spectate/:matchId. */
  matchId: string;
}

// ---------- Feature 015-private-match-code: matchmaking privado por código ----------
// Fuente: docs/CONTRATOS_API.md §4.1 (crear), §4.2 (unirse)

/** §4.1 POST /api/matches — crear partida (MVP: solo privada). */
export interface CreateMatchRequest {
  /** Partidas totales de la serie (mejor de N). Valores válidos: 1, 3, 5. */
  gamesToPlay: 1 | 3 | 5;
  /** Visibilidad de la partida. El MVP solo crea PRIVATE. */
  visibility: Visibility;
}

/** §4.1 respuesta de creación. */
export interface CreateMatchResponse {
  /** UUID del match creado. Usado para navegar a /match/:matchId. */
  matchId: string;
  /** Código compartible para que un segundo jugador se una (§4.2). */
  joinCode: string;
  /** Eco de la visibilidad solicitada. */
  visibility: Visibility;
}

/** §4.2 POST /api/join/{joinCode} — el join code resuelve un único target. */
export interface JoinResponse {
  /** Tipo de recurso resuelto. En el MVP solo se actúa si es 'MATCH'. */
  targetType: 'MATCH' | 'LEAGUE' | 'CUP';
  /** UUID del recurso destino (matchId si targetType === 'MATCH'). */
  targetId: string;
}

// ---------- Feature 020-quick-match: emparejamiento automatico ----------
// Fuente: docs/CONTRATOS_API.md §9.3

export type QuickMatchStatus = 'SEARCHING' | 'MATCHED';

export interface QuickMatchRequest {
  /** Partidas totales de la serie (mejor de N). Valores validos: 1, 3, 5. */
  gamesToPlay: 1 | 3 | 5;
}

export interface QuickMatchResponse {
  /** SEARCHING: en cola. MATCHED: match creado. */
  status: QuickMatchStatus;
  /** UUID del match creado; null si aun esta buscando. */
  matchId: string | null;
  /** Momento ISO-8601 en que el jugador entro a la cola. */
  enqueuedAt: string;
}
