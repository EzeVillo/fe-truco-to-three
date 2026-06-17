import { describe, it, expect } from 'vitest';
import { applyMatchEvent, applyMatchDerivedEvent } from './match-event.reducer';
import type { MatchState } from '../../../core/models/match.models';
import type { MatchWsEvent, MatchDerivedEvent } from '../models/match-ws-events';

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: 'test-match',
    status: 'IN_PROGRESS',
    viewerSeat: 'PLAYER_ONE',
    playerOneUsername: 'juancho',
    playerTwoUsername: 'martina',
    gamesToPlay: 3,
    scorePlayerOne: 0,
    scorePlayerTwo: 0,
    gamesWonPlayerOne: 0,
    gamesWonPlayerTwo: 0,
    matchWinner: null,
    roundGame: {
      status: 'IN_PROGRESS',
      currentTurn: 'juancho',
      myCards: [
        { suit: 'ESPADA', number: 1 },
        { suit: 'BASTO', number: 7 },
        { suit: 'ORO', number: 5 },
      ],
      roundStatus: 'PLAYING',
      currentTrucoCall: null,
      currentEnvidoCall: null,
      winner: null,
      availableActions: [{ type: 'PLAY_CARD' }],
      playedHands: [],
      currentHand: {
        cardPlayerOne: null,
        cardPlayerTwo: null,
        mano: 'juancho',
      },
      actionDeadline: null,
      turnDurationMillis: null,
      actionDeadlineSeat: null,
    },
    lobby: null,
    ...overrides,
  };
}

function makeEvent(
  type: MatchWsEvent['eventType'],
  payload: unknown,
  stateVersion = 1,
): MatchWsEvent {
  return {
    matchId: 'test-match',
    eventType: type,
    timestamp: Date.now(),
    payload,
    stateVersion,
  };
}

describe('applyMatchEvent', () => {
  describe('CARD_PLAYED', () => {
    it('updates cardPlayerOne when seat is PLAYER_ONE', () => {
      const state = makeState();
      const event = makeEvent('CARD_PLAYED', {
        seat: 'PLAYER_ONE',
        card: { suit: 'ESPADA', number: 1 },
      });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.currentHand.cardPlayerOne).toEqual({ suit: 'ESPADA', number: 1 });
      expect(next.roundGame?.currentHand.cardPlayerTwo).toBeNull();
    });

    it('updates cardPlayerTwo when seat is PLAYER_TWO', () => {
      const state = makeState();
      const event = makeEvent('CARD_PLAYED', {
        seat: 'PLAYER_TWO',
        card: { suit: 'COPA', number: 5 },
      });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.currentHand.cardPlayerTwo).toEqual({ suit: 'COPA', number: 5 });
    });

    it('is idempotent', () => {
      const state = makeState();
      const event = makeEvent('CARD_PLAYED', {
        seat: 'PLAYER_ONE',
        card: { suit: 'ESPADA', number: 1 },
      });
      const next1 = applyMatchEvent(state, event);
      const next2 = applyMatchEvent(next1, event);
      expect(next2.roundGame?.currentHand.cardPlayerOne).toEqual({ suit: 'ESPADA', number: 1 });
    });
  });

  describe('TURN_CHANGED', () => {
    it('updates currentTurn to username from seat', () => {
      const state = makeState({ viewerSeat: 'PLAYER_TWO' });
      const event = makeEvent('TURN_CHANGED', { seat: 'PLAYER_ONE' });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.currentTurn).toBe('juancho');
    });

    it('resolves PLAYER_TWO correctly', () => {
      const state = makeState();
      const event = makeEvent('TURN_CHANGED', { seat: 'PLAYER_TWO' });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.currentTurn).toBe('martina');
    });
  });

  describe('TRUCO_CALLED', () => {
    it('sets currentTrucoCall and roundStatus', () => {
      const state = makeState();
      const event = makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'TRUCO' });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.currentTrucoCall).toBe('TRUCO');
      expect(next.roundGame?.roundStatus).toBe('TRUCO_IN_PROGRESS');
    });
  });

  describe('TRUCO_RESPONDED', () => {
    it('sets roundStatus to PLAYING', () => {
      const state = makeState({
        roundGame: { ...makeState().roundGame!, roundStatus: 'TRUCO_IN_PROGRESS' },
      });
      const event = makeEvent('TRUCO_RESPONDED', {
        responderSeat: 'PLAYER_TWO',
        response: 'QUIERO',
        call: 'TRUCO',
      });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.roundStatus).toBe('PLAYING');
    });
  });

  describe('ENVIDO_CALLED', () => {
    it('sets roundStatus to ENVIDO_IN_PROGRESS', () => {
      const state = makeState();
      const event = makeEvent('ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.roundStatus).toBe('ENVIDO_IN_PROGRESS');
    });
  });

  describe('ENVIDO_RESOLVED', () => {
    it('sets roundStatus to PLAYING', () => {
      const state = makeState({
        roundGame: { ...makeState().roundGame!, roundStatus: 'ENVIDO_IN_PROGRESS' },
      });
      const event = makeEvent('ENVIDO_RESOLVED', { response: 'QUIERO', winnerSeat: 'PLAYER_ONE' });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.roundStatus).toBe('PLAYING');
    });
  });

  describe('SCORE_CHANGED', () => {
    it('updates scores', () => {
      const state = makeState();
      const event = makeEvent('SCORE_CHANGED', { scorePlayerOne: 2, scorePlayerTwo: 1 });
      const next = applyMatchEvent(state, event);
      expect(next.scorePlayerOne).toBe(2);
      expect(next.scorePlayerTwo).toBe(1);
    });
  });

  describe('GAME_SCORE_CHANGED', () => {
    it('updates games won', () => {
      const state = makeState();
      const event = makeEvent('GAME_SCORE_CHANGED', { gamesWonPlayerOne: 1, gamesWonPlayerTwo: 0 });
      const next = applyMatchEvent(state, event);
      expect(next.gamesWonPlayerOne).toBe(1);
      expect(next.gamesWonPlayerTwo).toBe(0);
    });
  });

  describe('ROUND_STARTED', () => {
    it('resets round state', () => {
      const state = makeState({
        roundGame: {
          ...makeState().roundGame!,
          playedHands: [
            {
              cardPlayerOne: { suit: 'ESPADA', number: 1 },
              cardPlayerTwo: { suit: 'COPA', number: 5 },
              winner: 'juancho',
            },
          ],
          currentTrucoCall: 'TRUCO',
          winner: 'juancho',
        },
      });
      const event = makeEvent('ROUND_STARTED', { roundNumber: 2, manoSeat: 'PLAYER_TWO' });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.playedHands).toEqual([]);
      expect(next.roundGame?.currentTrucoCall).toBeNull();
      expect(next.roundGame?.winner).toBeNull();
      expect(next.roundGame?.roundStatus).toBe('PLAYING');
      expect(next.roundGame?.currentHand.mano).toBe('martina');
      expect(next.roundGame?.currentTurn).toBe('martina');
    });
  });

  describe('ROUND_ENDED', () => {
    it('sets winner and status', () => {
      const state = makeState();
      const event = makeEvent('ROUND_ENDED', { winnerSeat: 'PLAYER_ONE' });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.winner).toBe('juancho');
      expect(next.roundGame?.status).toBe('FINISHED');
    });
  });

  describe('GAME_STARTED', () => {
    it('resets scores and roundGame', () => {
      const state = makeState({ scorePlayerOne: 2, scorePlayerTwo: 1 });
      const event = makeEvent('GAME_STARTED', { gameNumber: 2 });
      const next = applyMatchEvent(state, event);
      expect(next.scorePlayerOne).toBe(0);
      expect(next.scorePlayerTwo).toBe(0);
      expect(next.roundGame).toBeNull();
    });

    it('transitions status to IN_PROGRESS (feature 015 D6: sala de espera → tablero)', () => {
      const state = makeState({ status: 'READY' });
      const event = makeEvent('GAME_STARTED', { gameNumber: 1 });
      const next = applyMatchEvent(state, event);
      expect(next.status).toBe('IN_PROGRESS');
    });
  });

  describe('PLAYER_JOINED / PLAYER_READY', () => {
    it('PLAYER_JOINED en WAITING_FOR_PLAYERS pasa la sala a READY (feature 015)', () => {
      const state = makeState({ status: 'WAITING_FOR_PLAYERS', playerTwoUsername: null });
      const next = applyMatchEvent(state, makeEvent('PLAYER_JOINED', {}));
      expect(next.status).toBe('READY');
    });

    it('PLAYER_READY en WAITING_FOR_PLAYERS pasa la sala a READY', () => {
      const state = makeState({ status: 'WAITING_FOR_PLAYERS' });
      const next = applyMatchEvent(state, makeEvent('PLAYER_READY', { seat: 'PLAYER_TWO' }));
      expect(next.status).toBe('READY');
    });

    it('PLAYER_JOINED no degrada un estado ya IN_PROGRESS', () => {
      const state = makeState({ status: 'IN_PROGRESS' });
      const next = applyMatchEvent(state, makeEvent('PLAYER_JOINED', {}));
      expect(next.status).toBe('IN_PROGRESS');
    });
  });

  describe('MATCH_PLAYER_LEFT', () => {
    it('vuelve a WAITING_FOR_PLAYERS y limpia el rival (feature 015 D7)', () => {
      const state = makeState({ status: 'READY', playerTwoUsername: 'martina' });
      const event = makeEvent('MATCH_PLAYER_LEFT', { leaverSeat: 'PLAYER_TWO' });
      const next = applyMatchEvent(state, event);
      expect(next.status).toBe('WAITING_FOR_PLAYERS');
      expect(next.playerTwoUsername).toBeNull();
    });
  });

  describe('HAND_RESOLVED', () => {
    it('adds to playedHands and resets currentHand', () => {
      const state = makeState();
      const event = makeEvent('HAND_RESOLVED', {
        cardPlayerOne: { suit: 'ESPADA', number: 1 },
        cardPlayerTwo: { suit: 'COPA', number: 5 },
        winnerSeat: 'PLAYER_ONE',
      });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.playedHands).toHaveLength(1);
      expect(next.roundGame?.playedHands[0].winner).toBe('juancho');
      expect(next.roundGame?.currentHand.cardPlayerOne).toBeNull();
      expect(next.roundGame?.currentHand.cardPlayerTwo).toBeNull();
    });
  });

  describe('HAND_DEALT', () => {
    it('updates myCards when seat matches viewerSeat', () => {
      const state = makeState({ viewerSeat: 'PLAYER_ONE' });
      const event = makeEvent('HAND_DEALT', {
        seat: 'PLAYER_ONE',
        cards: [{ suit: 'ESPADA', number: 1 }],
      });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.myCards).toEqual([{ suit: 'ESPADA', number: 1 }]);
    });

    it('ignores when seat does not match viewerSeat', () => {
      const state = makeState({ viewerSeat: 'PLAYER_ONE' });
      const event = makeEvent('HAND_DEALT', {
        seat: 'PLAYER_TWO',
        cards: [{ suit: 'COPA', number: 5 }],
      });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.myCards).toEqual(state.roundGame!.myCards);
    });

    it('variante bot-vs-bot: setea ambas manos sin tocar myCards', () => {
      const state = makeState({ viewerSeat: 'PLAYER_ONE' });
      const event = makeEvent('HAND_DEALT', {
        player_one: [
          { suit: 'ESPADA', number: 1 },
          { suit: 'BASTO', number: 7 },
        ],
        player_two: [{ suit: 'COPA', number: 5 }],
      });
      const next = applyMatchEvent(state, event);
      expect(next.roundGame?.handPlayerOne).toEqual([
        { suit: 'ESPADA', number: 1 },
        { suit: 'BASTO', number: 7 },
      ]);
      expect(next.roundGame?.handPlayerTwo).toEqual([{ suit: 'COPA', number: 5 }]);
      expect(next.roundGame?.myCards).toEqual(state.roundGame!.myCards);
    });
  });

  describe('MATCH_FINISHED', () => {
    it('sets status, matchWinner and gamesWon', () => {
      const state = makeState();
      const event = makeEvent('MATCH_FINISHED', {
        winnerSeat: 'PLAYER_ONE',
        gamesWonPlayerOne: 2,
        gamesWonPlayerTwo: 1,
      });
      const next = applyMatchEvent(state, event);
      expect(next.status).toBe('FINISHED');
      expect(next.matchWinner).toBe('juancho');
      expect(next.gamesWonPlayerOne).toBe(2);
      expect(next.gamesWonPlayerTwo).toBe(1);
    });
  });

  describe('MATCH_ABANDONED', () => {
    it('sets status, matchWinner and gamesWon', () => {
      const state = makeState();
      const event = makeEvent('MATCH_ABANDONED', {
        winnerSeat: 'PLAYER_ONE',
        abandonerSeat: 'PLAYER_TWO',
        gamesWonPlayerOne: 1,
        gamesWonPlayerTwo: 0,
      });
      const next = applyMatchEvent(state, event);
      expect(next.status).toBe('FINISHED');
      expect(next.matchWinner).toBe('juancho');
    });
  });

  describe('MATCH_FORFEITED', () => {
    it('sets status, matchWinner and gamesWon', () => {
      const state = makeState();
      const event = makeEvent('MATCH_FORFEITED', {
        winnerSeat: 'PLAYER_ONE',
        loserSeat: 'PLAYER_TWO',
        gamesWonPlayerOne: 1,
        gamesWonPlayerTwo: 0,
      });
      const next = applyMatchEvent(state, event);
      expect(next.status).toBe('FINISHED');
      expect(next.matchWinner).toBe('juancho');
    });
  });

  describe('No-op events', () => {
    it('FOLDED returns same state', () => {
      const state = makeState();
      const event = makeEvent('FOLDED', { seat: 'PLAYER_ONE' });
      const next = applyMatchEvent(state, event);
      expect(next).toEqual(state);
    });

    it('HAND_CHANGED returns same state', () => {
      const state = makeState();
      const event = makeEvent('HAND_CHANGED', {});
      const next = applyMatchEvent(state, event);
      expect(next).toEqual(state);
    });
  });
});

describe('applyMatchDerivedEvent', () => {
  describe('AVAILABLE_ACTIONS_UPDATED', () => {
    it('updates availableActions when seat matches viewerSeat', () => {
      const state = makeState({ viewerSeat: 'PLAYER_ONE' });
      const event: MatchDerivedEvent = {
        matchId: 'test',
        eventType: 'AVAILABLE_ACTIONS_UPDATED',
        timestamp: 1,
        payload: { seat: 'PLAYER_ONE', availableActions: [{ type: 'PLAY_CARD' }] },
      };
      const next = applyMatchDerivedEvent(state, event);
      expect(next.roundGame?.availableActions).toEqual([{ type: 'PLAY_CARD' }]);
    });

    it('ignores when seat does not match viewerSeat', () => {
      const state = makeState({ viewerSeat: 'PLAYER_ONE' });
      const event: MatchDerivedEvent = {
        matchId: 'test',
        eventType: 'AVAILABLE_ACTIONS_UPDATED',
        timestamp: 1,
        payload: { seat: 'PLAYER_TWO', availableActions: [{ type: 'FOLD' }] },
      };
      const next = applyMatchDerivedEvent(state, event);
      expect(next.roundGame?.availableActions).toEqual(state.roundGame!.availableActions);
    });
  });

  describe('PLAYER_HAND_UPDATED', () => {
    it('updates myCards when seat matches viewerSeat', () => {
      const state = makeState({ viewerSeat: 'PLAYER_ONE' });
      const event: MatchDerivedEvent = {
        matchId: 'test',
        eventType: 'PLAYER_HAND_UPDATED',
        timestamp: 1,
        payload: { seat: 'PLAYER_ONE', cards: [{ suit: 'ESPADA', number: 1 }] },
      };
      const next = applyMatchDerivedEvent(state, event);
      expect(next.roundGame?.myCards).toEqual([{ suit: 'ESPADA', number: 1 }]);
    });
  });

  describe('ACTION_DEADLINE_SET', () => {
    it('setea los tres campos del plazo juntos sobre roundGame', () => {
      const state = makeState();
      const event: MatchDerivedEvent = {
        matchId: 'test',
        eventType: 'ACTION_DEADLINE_SET',
        timestamp: 1_000,
        payload: { seat: 'PLAYER_TWO', actionDeadline: 1_000_030_000, turnDurationMillis: 30_000 },
      };
      const next = applyMatchDerivedEvent(state, event);
      expect(next.roundGame?.actionDeadline).toBe(1_000_030_000);
      expect(next.roundGame?.turnDurationMillis).toBe(30_000);
      expect(next.roundGame?.actionDeadlineSeat).toBe('PLAYER_TWO');
    });

    it('reemplaza un plazo previo (reinicio del reloj)', () => {
      const state = makeState({
        roundGame: {
          ...makeState().roundGame!,
          actionDeadline: 1,
          turnDurationMillis: 2,
          actionDeadlineSeat: 'PLAYER_ONE',
        },
      });
      const event: MatchDerivedEvent = {
        matchId: 'test',
        eventType: 'ACTION_DEADLINE_SET',
        timestamp: 5,
        payload: { seat: 'PLAYER_TWO', actionDeadline: 999, turnDurationMillis: 30_000 },
      };
      const next = applyMatchDerivedEvent(state, event);
      expect(next.roundGame?.actionDeadline).toBe(999);
      expect(next.roundGame?.actionDeadlineSeat).toBe('PLAYER_TWO');
    });

    it('no-op si roundGame es null', () => {
      const state = makeState({ roundGame: null });
      const event: MatchDerivedEvent = {
        matchId: 'test',
        eventType: 'ACTION_DEADLINE_SET',
        timestamp: 1,
        payload: { seat: 'PLAYER_ONE', actionDeadline: 1, turnDurationMillis: 2 },
      };
      expect(applyMatchDerivedEvent(state, event).roundGame).toBeNull();
    });
  });

  describe('ACTION_DEADLINE_CLEARED', () => {
    it('limpia los tres campos del plazo', () => {
      const state = makeState({
        roundGame: {
          ...makeState().roundGame!,
          actionDeadline: 1,
          turnDurationMillis: 2,
          actionDeadlineSeat: 'PLAYER_ONE',
        },
      });
      const event: MatchDerivedEvent = {
        matchId: 'test',
        eventType: 'ACTION_DEADLINE_CLEARED',
        timestamp: 1,
        payload: {},
      };
      const next = applyMatchDerivedEvent(state, event);
      expect(next.roundGame?.actionDeadline).toBeNull();
      expect(next.roundGame?.turnDurationMillis).toBeNull();
      expect(next.roundGame?.actionDeadlineSeat).toBeNull();
    });
  });
});
