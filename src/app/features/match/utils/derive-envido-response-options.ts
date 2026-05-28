import { hasActionParameter, type AvailableAction } from '../../../core/models/match.models';

export interface EnvidoResponseOptions {
  /** Botones principales (`RESPOND_ENVIDO`) */
  quiero: boolean;
  noQuiero: boolean;
  /** Sub-opciones de escalada (`CALL_ENVIDO`) cuando ya hubo canto del rival */
  envido: boolean;
  realEnvido: boolean;
  faltaEnvido: boolean;
}

const ALL_DISABLED: EnvidoResponseOptions = {
  quiero: false,
  noQuiero: false,
  envido: false,
  realEnvido: false,
  faltaEnvido: false,
};

/**
 * Deriva las opciones del panel de respuesta de envido a partir de las acciones
 * disponibles que envía el BE. Cada combinación `type + parameter` representa una
 * opción independiente:
 *
 *  - `RESPOND_ENVIDO` con `parameter` `QUIERO` / `NO_QUIERO` → botones principales.
 *  - `CALL_ENVIDO`    con `parameter` `ENVIDO` / `REAL_ENVIDO` / `FALTA_ENVIDO`
 *    → sub-opciones de escalada disponibles en este momento (se renderizan
 *      junto al panel de respuesta porque escalar es una alternativa al Quiero).
 */
export function deriveEnvidoResponseOptions(
  actions: ReadonlyArray<AvailableAction>,
): EnvidoResponseOptions {
  if (actions.length === 0) {return ALL_DISABLED;}

  const has = (type: string, parameter: string): boolean =>
    actions.some((a) => a.type === type && hasActionParameter(a, parameter));

  return {
    quiero: has('RESPOND_ENVIDO', 'QUIERO'),
    noQuiero: has('RESPOND_ENVIDO', 'NO_QUIERO'),
    envido: has('CALL_ENVIDO', 'ENVIDO'),
    realEnvido: has('CALL_ENVIDO', 'REAL_ENVIDO'),
    faltaEnvido: has('CALL_ENVIDO', 'FALTA_ENVIDO'),
  };
}
