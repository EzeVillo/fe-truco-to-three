import type { MatchState, ViewerSeat, Card, PlayedHand } from '../../../core/models/match.models';

export interface SeatView {
  seat: ViewerSeat;
  username: string;
  score: number;
  gamesWon: number;
  handCards: Card[] | null;
  handCount: number;
  playedInCurrentHand: Card | null;
  playedInPreviousHands: (Card | null)[];
}

export interface MatchView {
  matchId: string;
  status: string;
  gamesToPlay: 1 | 3 | 5;
  seriesLabel: string;
  self: SeatView;
  opponent: SeatView;
  currentTurnIsSelf: boolean | null;
  roundStatus: string | null;
  playedHandsCount: number;
}

function oppositeSeat(seat: ViewerSeat): ViewerSeat {
  return seat === 'PLAYER_ONE' ? 'PLAYER_TWO' : 'PLAYER_ONE';
}

function seatCard(playedHand: { cardPlayerOne: Card | null; cardPlayerTwo: Card | null }, seat: ViewerSeat): Card | null {
  return seat === 'PLAYER_ONE' ? playedHand.cardPlayerOne : playedHand.cardPlayerTwo;
}

function playedBySeat(playedHands: Array<{ cardPlayerOne: Card | null; cardPlayerTwo: Card | null }>, seat: ViewerSeat): number {
  return playedHands.reduce((count, hand) => {
    const card = seatCard(hand, seat);
    return card !== null ? count + 1 : count;
  }, 0);
}

export function deriveMatchView(state: MatchState): MatchView {
  const selfSeat = state.viewerSeat;
  const oppSeat = oppositeSeat(selfSeat);

  const selfUsername = selfSeat === 'PLAYER_ONE' ? state.playerOneUsername : state.playerTwoUsername;
  const opponentUsername = oppSeat === 'PLAYER_ONE' ? state.playerOneUsername : state.playerTwoUsername;
  const selfScore = selfSeat === 'PLAYER_ONE' ? state.scorePlayerOne : state.scorePlayerTwo;
  const opponentScore = oppSeat === 'PLAYER_ONE' ? state.scorePlayerOne : state.scorePlayerTwo;
  const selfGamesWon = selfSeat === 'PLAYER_ONE' ? state.gamesWonPlayerOne : state.gamesWonPlayerTwo;
  const opponentGamesWon = oppSeat === 'PLAYER_ONE' ? state.gamesWonPlayerOne : state.gamesWonPlayerTwo;

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
        handCount: 0,
        playedInCurrentHand: null,
        playedInPreviousHands: [],
      },
      opponent: {
        seat: oppSeat,
        username: opponentUsername,
        score: opponentScore,
        gamesWon: opponentGamesWon,
        handCards: null,
        handCount: 0,
        playedInCurrentHand: null,
        playedInPreviousHands: [],
      },
      currentTurnIsSelf: null,
      roundStatus: null,
      playedHandsCount: 0,
    };
  }

  const round = state.roundGame;
  const selfPlayedInHands = playedBySeat(round.playedHands, selfSeat);
  const opponentPlayedInHands = playedBySeat(round.playedHands, oppSeat);
  const selfPlayedCurrent = round.currentHand.cardPlayerOne !== null && selfSeat === 'PLAYER_ONE'
    || round.currentHand.cardPlayerTwo !== null && selfSeat === 'PLAYER_TWO';
  const opponentPlayedCurrent = round.currentHand.cardPlayerOne !== null && oppSeat === 'PLAYER_ONE'
    || round.currentHand.cardPlayerTwo !== null && oppSeat === 'PLAYER_TWO';

  const selfHandCount = 3 - selfPlayedInHands - (selfPlayedCurrent ? 1 : 0);
  const opponentHandCount = 3 - opponentPlayedInHands - (opponentPlayedCurrent ? 1 : 0);

  const currentTurnIsSelf = round.currentTurn === selfUsername
    ? true
    : round.currentTurn === opponentUsername
      ? false
      : null;

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
      handCount: selfHandCount,
      playedInCurrentHand: seatCard(round.currentHand, selfSeat),
      playedInPreviousHands: round.playedHands.map((h: PlayedHand) => seatCard(h, selfSeat)),
    },
    opponent: {
      seat: oppSeat,
      username: opponentUsername,
      score: opponentScore,
      gamesWon: opponentGamesWon,
      handCards: null,
      handCount: opponentHandCount,
      playedInCurrentHand: seatCard(round.currentHand, oppSeat),
      playedInPreviousHands: round.playedHands.map((h: PlayedHand) => seatCard(h, oppSeat)),
    },
    currentTurnIsSelf,
    roundStatus: round.roundStatus,
    playedHandsCount: round.playedHands.length,
  };
}
