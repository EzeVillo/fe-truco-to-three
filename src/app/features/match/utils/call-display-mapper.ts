import type { Seat } from '../../../core/models/enums';
import type { MatchWsEvent } from '../models/match-ws-events';

export interface CallDisplayEvent {
  /** Asiento del jugador que realizó la acción */
  seat: Seat;

  /** Texto legible en español para mostrar en el panel */
  text: string;

  /** Indica si es una respuesta de aceptación (activa auto-limpieza a 3 s) */
  isAcceptance: boolean;
}

export function callDisplayMapper(event: MatchWsEvent): CallDisplayEvent | null {
  switch (event.eventType) {
    case 'TRUCO_CALLED': {
      const payload = event.payload as { callerSeat: Seat; call: string };
      const textMap: Record<string, string> = {
        TRUCO: '¡Truco!',
        RETRUCO: '¡Retruco!',
        VALE_CUATRO: '¡Vale cuatro!',
      };
      const text = textMap[payload.call];
      if (!text) {return null;}
      return { seat: payload.callerSeat, text, isAcceptance: false };
    }

    case 'TRUCO_RESPONDED': {
      const payload = event.payload as { responderSeat: Seat; response: string };
      const textMap: Record<string, string> = {
        QUIERO: '¡Quiero!',
        NO_QUIERO: '¡No quiero!',
        QUIERO_Y_ME_VOY_AL_MAZO: '¡Quiero y me voy al mazo!',
      };
      const text = textMap[payload.response];
      if (!text) {return null;}
      return { seat: payload.responderSeat, text, isAcceptance: payload.response === 'QUIERO' };
    }

    case 'ENVIDO_CALLED': {
      const payload = event.payload as { callerSeat: Seat; call: string };
      const textMap: Record<string, string> = {
        ENVIDO: '¡Envido!',
        REAL_ENVIDO: '¡Real envido!',
        FALTA_ENVIDO: '¡Falta envido!',
      };
      const text = textMap[payload.call];
      if (!text) {return null;}
      return { seat: payload.callerSeat, text, isAcceptance: false };
    }

    case 'ENVIDO_RESOLVED': {
      // Gap: el backend no envía responderSeat en ENVIDO_RESOLVED.
      // El componente maneja este evento como caso especial.
      return null;
    }

    case 'FOLDED': {
      const payload = event.payload as { seat: Seat };
      return { seat: payload.seat, text: 'Me voy al mazo', isAcceptance: false };
    }

    default:
      return null;
  }
}
