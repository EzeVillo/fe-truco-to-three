import type {
  MatchState,
  ViewerSeat,
  Card,
  PlayedHand,
  AvailableAction,
} from '../../../core/models/match.models';
import type { TrucoCall } from '../../../core/models/enums';
import { hasActiveDeadline } from './turn-timer';

export interface SeatView {
  seat: ViewerSeat;
  username: string;
  score: number;
  gamesWon: number;
  handCards: Card[] | null;
  /**
   * Mano del asiento boca arriba para el espectador de una partida bot-vs-bot
   * (§9.2b). `null` salvo en ese modo; cuando está, el área renderiza estas cartas
   * reveladas en vez de dorsos. No se usa en el flujo de jugador.
   */
  revealedHandCards: Card[] | null;
  handCount: number;
  playedInCurrentHand: Card | null;
  playedInPreviousHands: (Card | null)[];
  /** El reloj de turno corre sobre este asiento (feature 013-turn-timer). */
  hasActiveDeadline: boolean;
}

export interface MatchView {
  matchId: string;
  status: string;
  gamesToPlay: 1 | 3 | 5;
  seriesLabel: string;
  self: SeatView;
  opponent: SeatView;
  currentTurnIsSelf: boolean | null;
  currentTurnUsername: string | null;
  roundStatus: string | null;
  playedHandsCount: number;
  availableActions: AvailableAction[];
  currentTrucoCall: TrucoCall | null;
  // Temporizador de turno (feature 013-turn-timer)
  actionDeadline: number | null; // epochMillis absoluto
  turnDurationMillis: number | null; // plazo total
  deadlineIsSelf: boolean | null; // true=propio, false=rival, null=sin reloj
}

export function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function oppositeSeat(seat: ViewerSeat): ViewerSeat {
  return seat === 'PLAYER_ONE' ? 'PLAYER_TWO' : 'PLAYER_ONE';
}

function seatCard(
  playedHand: { cardPlayerOne: Card | null; cardPlayerTwo: Card | null },
  seat: ViewerSeat,
): Card | null {
  return seat === 'PLAYER_ONE' ? playedHand.cardPlayerOne : playedHand.cardPlayerTwo;
}

function cardKey(card: Card): string {
  return `${card.suit}-${card.number}`;
}

/**
 * Mano boca arriba de un asiento, presente solo al espectar bot-vs-bot (§9.2b).
 * `undefined`/`null` en el flujo de jugador y en spectate con humanos.
 *
 * Filtra las cartas que el asiento ya bajó a la mesa (en `playedHands`/`currentHand`)
 * para que la mano siga exactamente al tablero, sin depender del orden/timing de
 * `PLAYER_HAND_UPDATED`: el descarte queda atado al mismo `CARD_PLAYED` que pinta
 * la carta jugada, así no se ve la carta dos veces.
 */
function handBySeat(
  round: {
    handPlayerOne?: Card[] | null;
    handPlayerTwo?: Card[] | null;
    playedHands: PlayedHand[];
    currentHand: { cardPlayerOne: Card | null; cardPlayerTwo: Card | null };
  },
  seat: ViewerSeat,
): Card[] | null {
  const hand = (seat === 'PLAYER_ONE' ? round.handPlayerOne : round.handPlayerTwo) ?? null;
  if (hand === null) {
    return null;
  }
  const playedKeys = new Set<string>();
  for (const h of round.playedHands) {
    const card = seatCard(h, seat);
    if (card !== null) {
      playedKeys.add(cardKey(card));
    }
  }
  const current = seatCard(round.currentHand, seat);
  if (current !== null) {
    playedKeys.add(cardKey(current));
  }
  return hand.filter((card) => !playedKeys.has(cardKey(card)));
}

function playedBySeat(
  playedHands: Array<{ cardPlayerOne: Card | null; cardPlayerTwo: Card | null }>,
  seat: ViewerSeat,
): number {
  return playedHands.reduce((count, hand) => {
    const card = seatCard(hand, seat);
    return card !== null ? count + 1 : count;
  }, 0);
}

export function deriveMatchView(state: MatchState): MatchView {
  const selfSeat = state.viewerSeat;
  const oppSeat = oppositeSeat(selfSeat);

  // playerTwoUsername puede ser null en WAITING_FOR_PLAYERS (§4.14). El tablero no
  // se renderiza en estado de espera (la sala usa su propia vista), así que aquí
  // se coacciona a '' para mantener SeatView.username estable. Feature 015 (D2).
  const selfUsername =
    (selfSeat === 'PLAYER_ONE' ? state.playerOneUsername : state.playerTwoUsername) ?? '';
  const opponentUsername =
    (oppSeat === 'PLAYER_ONE' ? state.playerOneUsername : state.playerTwoUsername) ?? '';
  const selfScore = selfSeat === 'PLAYER_ONE' ? state.scorePlayerOne : state.scorePlayerTwo;
  const opponentScore = oppSeat === 'PLAYER_ONE' ? state.scorePlayerOne : state.scorePlayerTwo;
  const selfGamesWon =
    selfSeat === 'PLAYER_ONE' ? state.gamesWonPlayerOne : state.gamesWonPlayerTwo;
  const opponentGamesWon =
    oppSeat === 'PLAYER_ONE' ? state.gamesWonPlayerOne : state.gamesWonPlayerTwo;

  const seriesLabels: Record<1 | 3 | 5, string> = {
    1: 'Mejor de 1',
    3: 'Mejor de 3',
    5: 'Mejor de 5',
  };
  const getSeriesLabel = (games: 1 | 3 | 5): string => seriesLabels[games];

  if (state.roundGame === null) {
    return {
      matchId: state.matchId,
      status: state.status,
      gamesToPlay: state.gamesToPlay,
      seriesLabel: getSeriesLabel(state.gamesToPlay),
      self: {
        seat: selfSeat,
        username: selfUsername,
        score: selfScore,
        gamesWon: selfGamesWon,
        handCards: null,
        revealedHandCards: null,
        handCount: 0,
        playedInCurrentHand: null,
        playedInPreviousHands: [],
        hasActiveDeadline: false,
      },
      opponent: {
        seat: oppSeat,
        username: opponentUsername,
        score: opponentScore,
        gamesWon: opponentGamesWon,
        handCards: null,
        revealedHandCards: null,
        handCount: 0,
        playedInCurrentHand: null,
        playedInPreviousHands: [],
        hasActiveDeadline: false,
      },
      currentTurnIsSelf: null,
      currentTurnUsername: null,
      roundStatus: null,
      playedHandsCount: 0,
      availableActions: [],
      currentTrucoCall: null,
      actionDeadline: null,
      turnDurationMillis: null,
      deadlineIsSelf: null,
    };
  }

  const round = state.roundGame;
  const selfPlayedInHands = playedBySeat(round.playedHands, selfSeat);
  const opponentPlayedInHands = playedBySeat(round.playedHands, oppSeat);
  const selfPlayedCurrent =
    (round.currentHand.cardPlayerOne !== null && selfSeat === 'PLAYER_ONE') ||
    (round.currentHand.cardPlayerTwo !== null && selfSeat === 'PLAYER_TWO');
  const opponentPlayedCurrent =
    (round.currentHand.cardPlayerOne !== null && oppSeat === 'PLAYER_ONE') ||
    (round.currentHand.cardPlayerTwo !== null && oppSeat === 'PLAYER_TWO');

  const selfHandCount = 3 - selfPlayedInHands - (selfPlayedCurrent ? 1 : 0);
  const opponentHandCount = 3 - opponentPlayedInHands - (opponentPlayedCurrent ? 1 : 0);

  const currentTurnIsSelf =
    round.currentTurn === selfUsername
      ? true
      : round.currentTurn === opponentUsername
        ? false
        : null;
  const currentTurnUsername = round.currentTurn ?? null;

  // Temporizador de turno (feature 013-turn-timer): el reloj corre sobre
  // `actionDeadlineSeat`, que puede no coincidir con `currentTurn` (respuesta a canto).
  const deadlineActive = hasActiveDeadline(
    round.actionDeadline,
    round.turnDurationMillis,
    round.actionDeadlineSeat,
  );
  const selfHasDeadline = deadlineActive && round.actionDeadlineSeat === selfSeat;
  const opponentHasDeadline = deadlineActive && round.actionDeadlineSeat === oppSeat;
  const deadlineIsSelf = deadlineActive ? round.actionDeadlineSeat === selfSeat : null;

  return {
    matchId: state.matchId,
    status: state.status,
    gamesToPlay: state.gamesToPlay,
    seriesLabel: getSeriesLabel(state.gamesToPlay),
    self: {
      seat: selfSeat,
      username: selfUsername,
      score: selfScore,
      gamesWon: selfGamesWon,
      handCards: round.myCards,
      // Solo no-nula al espectar bot-vs-bot: la mano propia boca arriba.
      revealedHandCards: handBySeat(round, selfSeat),
      handCount: selfHandCount,
      playedInCurrentHand: seatCard(round.currentHand, selfSeat),
      playedInPreviousHands: round.playedHands.map((h: PlayedHand) => seatCard(h, selfSeat)),
      hasActiveDeadline: selfHasDeadline,
    },
    opponent: {
      seat: oppSeat,
      username: opponentUsername,
      score: opponentScore,
      gamesWon: opponentGamesWon,
      handCards: null,
      // Solo no-nula al espectar bot-vs-bot: la mano del rival boca arriba. En el
      // resto queda null y el área de rival renderiza dorsos por `handCount`.
      revealedHandCards: handBySeat(round, oppSeat),
      handCount: opponentHandCount,
      playedInCurrentHand: seatCard(round.currentHand, oppSeat),
      playedInPreviousHands: round.playedHands.map((h: PlayedHand) => seatCard(h, oppSeat)),
      hasActiveDeadline: opponentHasDeadline,
    },
    currentTurnIsSelf,
    currentTurnUsername,
    roundStatus: round.roundStatus,
    playedHandsCount: round.playedHands.length,
    availableActions: round.availableActions,
    currentTrucoCall: round.currentTrucoCall,
    actionDeadline: round.actionDeadline,
    turnDurationMillis: round.turnDurationMillis,
    deadlineIsSelf,
  };
}
