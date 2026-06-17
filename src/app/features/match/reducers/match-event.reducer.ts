import type { MatchState } from '../../../core/models/match.models';
import type { Seat, RoundStatus } from '../../../core/models/enums';
import type {
  MatchWsEvent,
  MatchDerivedEvent,
  CardPlayedPayload,
  TurnChangedPayload,
  TrucoCalledPayload,
  TrucoRespondedPayload,
  EnvidoCalledPayload,
  ScoreChangedPayload,
  RoundStartedPayload,
  RoundEndedPayload,
  GameScoreChangedPayload,
  MatchFinishedPayload,
  MatchAbandonedPayload,
  MatchForfeitedPayload,
  HandResolvedPayload,
  HandDealtPayload,
  HandDealtBothPayload,
  AvailableActionsUpdatedPayload,
  PlayerHandUpdatedPayload,
  ActionDeadlineSetPayload,
} from '../models/match-ws-events';

function usernameFromSeat(seat: Seat, state: MatchState): string {
  // playerTwoUsername puede ser null en pre-juego (§4.14), pero usernameFromSeat
  // solo se invoca con ronda activa (rival presente). Se coacciona a '' por
  // seguridad de tipos. Feature 015 (D2).
  return seat === 'PLAYER_ONE' ? state.playerOneUsername : (state.playerTwoUsername ?? '');
}

function updateCurrentHandCard(
  state: MatchState,
  seat: Seat,
  card: { suit: string; number: number } | null,
): MatchState {
  if (!state.roundGame) {
    return state;
  }
  const key = seat === 'PLAYER_ONE' ? 'cardPlayerOne' : 'cardPlayerTwo';
  return {
    ...state,
    roundGame: {
      ...state.roundGame,
      currentHand: {
        ...state.roundGame.currentHand,
        [key]: card,
      },
    },
  };
}

export function applyMatchEvent(state: MatchState, event: MatchWsEvent): MatchState {
  switch (event.eventType) {
    case 'CARD_PLAYED': {
      const payload = event.payload as CardPlayedPayload;
      return updateCurrentHandCard(state, payload.seat, payload.card);
    }

    case 'TURN_CHANGED': {
      const payload = event.payload as TurnChangedPayload;
      if (!state.roundGame) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          currentTurn: usernameFromSeat(payload.seat, state),
        },
      };
    }

    case 'TRUCO_CALLED': {
      const payload = event.payload as TrucoCalledPayload;
      if (!state.roundGame) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          currentTrucoCall: payload.call,
          roundStatus: 'TRUCO_IN_PROGRESS' as RoundStatus,
        },
      };
    }

    case 'TRUCO_RESPONDED': {
      const payload = event.payload as TrucoRespondedPayload;
      if (!state.roundGame) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          roundStatus: 'PLAYING' as RoundStatus,
          currentTrucoCall: payload.call,
        },
      };
    }

    case 'ENVIDO_CALLED': {
      const payload = event.payload as EnvidoCalledPayload;
      if (!state.roundGame) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          roundStatus: 'ENVIDO_IN_PROGRESS' as RoundStatus,
          currentEnvidoCall: payload.call,
        },
      };
    }

    case 'ENVIDO_RESOLVED': {
      if (!state.roundGame) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          roundStatus: 'PLAYING' as RoundStatus,
          currentEnvidoCall: null,
        },
      };
    }

    case 'SCORE_CHANGED': {
      const payload = event.payload as ScoreChangedPayload;
      return {
        ...state,
        scorePlayerOne: payload.scorePlayerOne,
        scorePlayerTwo: payload.scorePlayerTwo,
      };
    }

    case 'GAME_SCORE_CHANGED': {
      const payload = event.payload as GameScoreChangedPayload;
      return {
        ...state,
        gamesWonPlayerOne: payload.gamesWonPlayerOne,
        gamesWonPlayerTwo: payload.gamesWonPlayerTwo,
      };
    }

    case 'ROUND_STARTED': {
      const payload = event.payload as RoundStartedPayload;
      return {
        ...state,
        roundGame: {
          status: 'IN_PROGRESS' as const,
          currentTurn: usernameFromSeat(payload.manoSeat, state),
          myCards: [],
          roundStatus: 'PLAYING' as RoundStatus,
          currentTrucoCall: null,
          currentEnvidoCall: null,
          winner: null,
          availableActions: [],
          playedHands: [],
          currentHand: {
            cardPlayerOne: null,
            cardPlayerTwo: null,
            mano: usernameFromSeat(payload.manoSeat, state),
          },
          actionDeadline: null,
          turnDurationMillis: null,
          actionDeadlineSeat: null,
        },
      };
    }

    case 'ROUND_ENDED': {
      const payload = event.payload as RoundEndedPayload;
      if (!state.roundGame) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          winner: usernameFromSeat(payload.winnerSeat, state),
          status: 'FINISHED' as const,
        },
      };
    }

    case 'GAME_STARTED': {
      // El primer GAME_STARTED marca el arranque de la partida: en partidas
      // privadas la transición WAITING_FOR_PLAYERS/READY → IN_PROGRESS ocurre
      // aquí (no hay evento MATCH_STARTED). Idempotente para games 2+ donde el
      // status ya era IN_PROGRESS. Ver feature 015 (research D6).
      return {
        ...state,
        status: 'IN_PROGRESS' as const,
        scorePlayerOne: 0,
        scorePlayerTwo: 0,
        roundGame: null,
      };
    }

    case 'HAND_RESOLVED': {
      const payload = event.payload as HandResolvedPayload;
      if (!state.roundGame) {
        return state;
      }
      const winner = usernameFromSeat(payload.winnerSeat, state);
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          playedHands: [
            ...state.roundGame.playedHands,
            {
              cardPlayerOne: payload.cardPlayerOne,
              cardPlayerTwo: payload.cardPlayerTwo,
              winner,
            },
          ],
          currentHand: {
            cardPlayerOne: null,
            cardPlayerTwo: null,
            mano: state.roundGame.currentHand.mano,
          },
        },
      };
    }

    case 'HAND_DEALT': {
      if (!state.roundGame) {
        return state;
      }
      const payload = event.payload as HandDealtPayload | HandDealtBothPayload;
      // Variante bot-vs-bot (spectate): ambas manos boca arriba a la vez.
      if ('player_one' in payload || 'player_two' in payload) {
        const both = payload as HandDealtBothPayload;
        return {
          ...state,
          roundGame: {
            ...state.roundGame,
            handPlayerOne: both.player_one ?? null,
            handPlayerTwo: both.player_two ?? null,
          },
        };
      }
      // Variante por asiento (jugador): solo la mano propia.
      if (payload.seat !== state.viewerSeat) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          myCards: payload.cards,
        },
      };
    }

    case 'MATCH_FINISHED': {
      const payload = event.payload as MatchFinishedPayload;
      return {
        ...state,
        status: 'FINISHED' as const,
        matchWinner: usernameFromSeat(payload.winnerSeat, state),
        gamesWonPlayerOne: payload.gamesWonPlayerOne,
        gamesWonPlayerTwo: payload.gamesWonPlayerTwo,
      };
    }

    case 'MATCH_ABANDONED': {
      const payload = event.payload as MatchAbandonedPayload;
      return {
        ...state,
        status: 'FINISHED' as const,
        matchWinner: usernameFromSeat(payload.winnerSeat, state),
        gamesWonPlayerOne: payload.gamesWonPlayerOne,
        gamesWonPlayerTwo: payload.gamesWonPlayerTwo,
      };
    }

    case 'MATCH_FORFEITED': {
      const payload = event.payload as MatchForfeitedPayload;
      return {
        ...state,
        status: 'FINISHED' as const,
        matchWinner: usernameFromSeat(payload.winnerSeat, state),
        gamesWonPlayerOne: payload.gamesWonPlayerOne,
        gamesWonPlayerTwo: payload.gamesWonPlayerTwo,
      };
    }

    case 'MATCH_PLAYER_LEFT': {
      // El segundo jugador salió antes de comenzar: la sala vuelve a esperar
      // rival y el anfitrión conserva el mismo código. Feature 015 (research D7).
      return {
        ...state,
        status: 'WAITING_FOR_PLAYERS' as const,
        playerTwoUsername: null,
      };
    }

    case 'PLAYER_JOINED':
    case 'PLAYER_READY': {
      // En una privada 1v1 el único que puede unirse/quedar listo es el rival:
      // la sala pasa a READY (habilita "Iniciar" para el anfitrión) sin depender
      // de un refresh del snapshot. El username del rival lo completa el refresh
      // (best-effort). No se toca si la partida ya arrancó o terminó.
      // Feature 015 (research D7). El payload de PLAYER_JOINED es {} (§9.6).
      if (state.status === 'WAITING_FOR_PLAYERS') {
        return { ...state, status: 'READY' as const };
      }
      return state;
    }

    case 'FOLDED':
    case 'HAND_CHANGED':
    case 'SPECTATOR_COUNT_CHANGED':
    case 'MATCH_CANCELLED':
    case 'REMATCH_AVAILABLE':
    case 'REMATCH_OPPONENT_WANTS':
    case 'REMATCH_CONFIRMED':
    case 'REMATCH_CLOSED_BY_LEAVE':
    case 'REMATCH_EXPIRED':
      return state;

    default:
      return state;
  }
}

export function applyMatchDerivedEvent(state: MatchState, event: MatchDerivedEvent): MatchState {
  if (!state.roundGame) {
    return state;
  }

  switch (event.eventType) {
    case 'AVAILABLE_ACTIONS_UPDATED': {
      const payload = event.payload as AvailableActionsUpdatedPayload;
      if (payload.seat !== state.viewerSeat) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          availableActions: payload.availableActions,
        },
      };
    }

    case 'PLAYER_HAND_UPDATED': {
      const payload = event.payload as PlayerHandUpdatedPayload;
      if (payload.seat !== state.viewerSeat) {
        return state;
      }
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          myCards: payload.cards,
        },
      };
    }

    case 'ACTION_DEADLINE_SET': {
      // Reinicia el reloj para el asiento obligado. Los tres campos se setean
      // juntos (invariante de consistencia). Fuente: docs/CONTRATOS_API.md §9.6.
      const payload = event.payload as ActionDeadlineSetPayload;
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          actionDeadline: payload.actionDeadline,
          turnDurationMillis: payload.turnDurationMillis,
          actionDeadlineSeat: payload.seat,
        },
      };
    }

    case 'ACTION_DEADLINE_CLEARED': {
      // No corre reloj: se limpian los tres campos juntos.
      return {
        ...state,
        roundGame: {
          ...state.roundGame,
          actionDeadline: null,
          turnDurationMillis: null,
          actionDeadlineSeat: null,
        },
      };
    }

    default:
      return state;
  }
}
