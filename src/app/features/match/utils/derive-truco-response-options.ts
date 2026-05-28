import { hasActionParameter, type AvailableAction } from '../../../core/models/match.models';

export interface TrucoResponseOptions {
  quiero: boolean;
  noQuiero: boolean;
  quieroYMazo: boolean;
}

/**
 * Deriva las opciones del panel de respuesta de truco a partir de las acciones
 * disponibles. Cada `RESPOND_TRUCO` con `parameter` distinto que envía el BE es
 * una respuesta habilitada.
 */
export function deriveTrucoResponseOptions(
  actions: ReadonlyArray<AvailableAction>,
): TrucoResponseOptions {
  const has = (parameter: string): boolean =>
    actions.some((a) => a.type === 'RESPOND_TRUCO' && hasActionParameter(a, parameter));

  return {
    quiero: has('QUIERO'),
    noQuiero: has('NO_QUIERO'),
    quieroYMazo: has('QUIERO_Y_ME_VOY_AL_MAZO'),
  };
}
