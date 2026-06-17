import { describe, it, expect } from 'vitest';
import { derivePendingCall } from './derive-pending-call';
import { mockMatchViewerPlayerOne } from '../mocks/match-state.mocks';
import type { MatchState, RoundState } from '../../../core/models/match.models';

function withRound(overrides: Partial<RoundState>): MatchState {
  return {
    ...mockMatchViewerPlayerOne,
    roundGame: {
      ...mockMatchViewerPlayerOne.roundGame!,
      ...overrides,
    },
  };
}

describe('derivePendingCall', () => {
  it('devuelve null cuando no hay ronda en curso', () => {
    const state: MatchState = { ...mockMatchViewerPlayerOne, roundGame: null };
    expect(derivePendingCall(state)).toBeNull();
  });

  it('devuelve null cuando no hay canto pendiente (PLAYING)', () => {
    expect(derivePendingCall(mockMatchViewerPlayerOne)).toBeNull();
  });

  it('muestra el truco del rival cuando el visor debe responder (reloj sobre el visor)', () => {
    const state = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'TRUCO',
      actionDeadlineSeat: 'PLAYER_ONE', // el visor (PLAYER_ONE) responde
      availableActions: [{ type: 'RESPOND_TRUCO', parameters: ['QUIERO', 'NO_QUIERO'] }],
    });
    expect(derivePendingCall(state)).toEqual({ seat: 'PLAYER_TWO', text: '¡Truco!' });
  });

  it('mapea retruco y vale cuatro', () => {
    const retruco = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'RETRUCO',
      actionDeadlineSeat: 'PLAYER_ONE',
    });
    expect(derivePendingCall(retruco)?.text).toBe('¡Retruco!');

    const valeCuatro = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'VALE_CUATRO',
      actionDeadlineSeat: 'PLAYER_ONE',
    });
    expect(derivePendingCall(valeCuatro)?.text).toBe('¡Vale cuatro!');
  });

  it('muestra el bubble sobre el propio asiento cuando el rival debe responder', () => {
    const state = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'TRUCO',
      actionDeadlineSeat: 'PLAYER_TWO', // el rival responde → el visor cantó
    });
    expect(derivePendingCall(state)).toEqual({ seat: 'PLAYER_ONE', text: '¡Truco!' });
  });

  it('infiere el respondedor por la acción RESPOND_* si no hay reloj', () => {
    const state = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'TRUCO',
      actionDeadlineSeat: null,
      availableActions: [{ type: 'RESPOND_TRUCO', parameters: ['QUIERO', 'NO_QUIERO'] }],
    });
    expect(derivePendingCall(state)).toEqual({ seat: 'PLAYER_TWO', text: '¡Truco!' });
  });

  it('muestra el envido exacto del rival cuando está sin resolver', () => {
    const state = withRound({
      roundStatus: 'ENVIDO_IN_PROGRESS',
      currentEnvidoCall: 'ENVIDO',
      actionDeadlineSeat: 'PLAYER_ONE',
      availableActions: [{ type: 'RESPOND_ENVIDO', parameters: ['QUIERO', 'NO_QUIERO'] }],
    });
    expect(derivePendingCall(state)).toEqual({ seat: 'PLAYER_TWO', text: '¡Envido!' });
  });

  it('mapea real envido y falta envido', () => {
    const real = withRound({
      roundStatus: 'ENVIDO_IN_PROGRESS',
      currentEnvidoCall: 'REAL_ENVIDO',
      actionDeadlineSeat: 'PLAYER_ONE',
    });
    expect(derivePendingCall(real)?.text).toBe('¡Real envido!');

    const falta = withRound({
      roundStatus: 'ENVIDO_IN_PROGRESS',
      currentEnvidoCall: 'FALTA_ENVIDO',
      actionDeadlineSeat: 'PLAYER_ONE',
    });
    expect(derivePendingCall(falta)?.text).toBe('¡Falta envido!');
  });

  it('devuelve null en ENVIDO_IN_PROGRESS sin currentEnvidoCall (estado inconsistente)', () => {
    const state = withRound({
      roundStatus: 'ENVIDO_IN_PROGRESS',
      currentEnvidoCall: null,
      actionDeadlineSeat: 'PLAYER_ONE',
    });
    expect(derivePendingCall(state)).toBeNull();
  });

  it('devuelve null en TRUCO_IN_PROGRESS sin currentTrucoCall (estado inconsistente)', () => {
    const state = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: null,
      actionDeadlineSeat: 'PLAYER_ONE',
    });
    expect(derivePendingCall(state)).toBeNull();
  });

  it('devuelve null si no se puede determinar el respondedor', () => {
    const state = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'TRUCO',
      actionDeadlineSeat: null,
      availableActions: [{ type: 'PLAY_CARD' }],
    });
    expect(derivePendingCall(state)).toBeNull();
  });

  // Espectador bot-vs-bot: sin reloj (actionDeadlineSeat null) ni availableActions,
  // la inferencia del respondedor cae. El cantor explícito del snapshot resuelve.
  it('usa el cantor explícito del truco cuando no hay reloj ni acciones (spectate)', () => {
    const state = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'TRUCO',
      currentTrucoCaller: 'martina', // PLAYER_TWO
      actionDeadlineSeat: null,
      availableActions: [],
    });
    expect(derivePendingCall(state)).toEqual({ seat: 'PLAYER_TWO', text: '¡Truco!' });
  });

  it('usa el cantor explícito del envido cuando no hay reloj ni acciones (spectate)', () => {
    const state = withRound({
      roundStatus: 'ENVIDO_IN_PROGRESS',
      currentEnvidoCall: 'REAL_ENVIDO',
      currentEnvidoCaller: 'juancho', // PLAYER_ONE
      actionDeadlineSeat: null,
      availableActions: [],
    });
    expect(derivePendingCall(state)).toEqual({ seat: 'PLAYER_ONE', text: '¡Real envido!' });
  });

  it('el cantor explícito tiene prioridad sobre la inferencia por reloj', () => {
    const state = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'TRUCO',
      currentTrucoCaller: 'martina', // PLAYER_TWO cantó
      actionDeadlineSeat: 'PLAYER_TWO', // reloj sobre PLAYER_TWO ⇒ inferencia diría PLAYER_ONE
    });
    expect(derivePendingCall(state)).toEqual({ seat: 'PLAYER_TWO', text: '¡Truco!' });
  });

  it('cae a la inferencia si el cantor explícito no coincide con ningún jugador', () => {
    const state = withRound({
      roundStatus: 'TRUCO_IN_PROGRESS',
      currentTrucoCall: 'TRUCO',
      currentTrucoCaller: 'desconocido',
      actionDeadlineSeat: 'PLAYER_ONE',
    });
    expect(derivePendingCall(state)).toEqual({ seat: 'PLAYER_TWO', text: '¡Truco!' });
  });
});
