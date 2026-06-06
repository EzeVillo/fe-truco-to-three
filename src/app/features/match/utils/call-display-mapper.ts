import type { Seat } from '../../../core/models/enums';
import type { MatchWsEvent } from '../models/match-ws-events';

export interface CallDisplayEvent {
  /** Asiento del jugador que realizó la acción */
  seat: Seat;

  /** Texto legible en español para mostrar en el panel */
  text: string;

  /** Indica si el texto debe auto-limpiarse de pantalla a los 3 s */
  autoClear: boolean;
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
      if (!text) {
        return null;
      }
      // El canto de truco persiste en pantalla hasta que se responda (quiero/no quiero).
      return { seat: payload.callerSeat, text, autoClear: false };
    }

    case 'TRUCO_RESPONDED': {
      const payload = event.payload as { responderSeat: Seat; response: string };
      const textMap: Record<string, string> = {
        QUIERO: '¡Quiero!',
        NO_QUIERO: '¡No quiero!',
        QUIERO_Y_ME_VOY_AL_MAZO: '¡Quiero y me voy al mazo!',
      };
      const text = textMap[payload.response];
      if (!text) {
        return null;
      }
      // QUIERO del truco se auto-limpia; NO_QUIERO y QUIERO_Y_ME_VOY_AL_MAZO persisten.
      return { seat: payload.responderSeat, text, autoClear: payload.response === 'QUIERO' };
    }

    case 'ENVIDO_CALLED': {
      const payload = event.payload as { callerSeat: Seat; call: string };
      const textMap: Record<string, string> = {
        ENVIDO: '¡Envido!',
        REAL_ENVIDO: '¡Real envido!',
        FALTA_ENVIDO: '¡Falta envido!',
      };
      const text = textMap[payload.call];
      if (!text) {
        return null;
      }
      // El canto de envido persiste en pantalla hasta que se resuelva (quiero/no quiero).
      return { seat: payload.callerSeat, text, autoClear: false };
    }

    case 'ENVIDO_RESOLVED': {
      // Gap: el backend no envía responderSeat en ENVIDO_RESOLVED.
      // El componente maneja este evento como caso especial.
      return null;
    }

    case 'FOLDED': {
      const payload = event.payload as { seat: Seat };
      return { seat: payload.seat, text: 'Me voy al mazo', autoClear: false };
    }

    default:
      return null;
  }
}
