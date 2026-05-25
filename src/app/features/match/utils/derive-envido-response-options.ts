import type { AvailableAction } from '../../../core/models/match.models';

export interface EnvidoResponseOptions {
  envido: boolean;
  realEnvido: boolean;
  faltaEnvido: boolean;
}

const DEFAULT_OPTIONS: EnvidoResponseOptions = {
  envido: false,
  realEnvido: true,
  faltaEnvido: true,
};

/**
 * Deriva las sub-opciones de envido habilitadas cuando el jugador debe responder
 * un envido cantado por el rival.
 *
 * El backend (o el mock) puede adjuntar metadata en la acción RESPOND_ENVIDO
 * via `details.envidoResponseOptions`. Si no está presente, se usa un default
 * conservador: Envido deshabilitado (ya fue cantado), Real Envido y Falta
 * Envido habilitados.
 */
export function deriveEnvidoResponseOptions(
  actions: ReadonlyArray<AvailableAction>
): EnvidoResponseOptions {
  const respondAction = actions.find((a) => a.type === 'RESPOND_ENVIDO');
  if (!respondAction) {
    return DEFAULT_OPTIONS;
  }

  // Leer metadata opcional del mock/backend sin modificar el tipo base del contrato
  const record = respondAction as unknown as Record<string, unknown>;
  const details = record['details'];
  const opts =
    details &&
    typeof details === 'object' &&
    details !== null &&
    'envidoResponseOptions' in details
      ? (details as Record<string, unknown>)['envidoResponseOptions']
      : null;

  if (
    opts &&
    typeof opts === 'object' &&
    opts !== null &&
    'envido' in opts &&
    'realEnvido' in opts &&
    'faltaEnvido' in opts
  ) {
    return {
      envido: Boolean((opts as EnvidoResponseOptions).envido),
      realEnvido: Boolean((opts as EnvidoResponseOptions).realEnvido),
      faltaEnvido: Boolean((opts as EnvidoResponseOptions).faltaEnvido),
    };
  }

  return DEFAULT_OPTIONS;
}
