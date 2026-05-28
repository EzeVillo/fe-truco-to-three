import { hasActionParameter, type AvailableAction } from '../../../core/models/match.models';

export interface EnvidoCallOptions {
  envido: boolean;
  realEnvido: boolean;
  faltaEnvido: boolean;
}

/**
 * Deriva las opciones del submenú de cantar envido a partir de las acciones
 * disponibles. Cada `CALL_ENVIDO` con `parameter` distinto que envía el BE es
 * un canto habilitado.
 */
export function deriveEnvidoCallOptions(
  actions: ReadonlyArray<AvailableAction>,
): EnvidoCallOptions {
  const has = (parameter: string): boolean =>
    actions.some((a) => a.type === 'CALL_ENVIDO' && hasActionParameter(a, parameter));

  return {
    envido: has('ENVIDO'),
    realEnvido: has('REAL_ENVIDO'),
    faltaEnvido: has('FALTA_ENVIDO'),
  };
}

export function hasAnyEnvidoCallOption(opts: EnvidoCallOptions): boolean {
  return opts.envido || opts.realEnvido || opts.faltaEnvido;
}
