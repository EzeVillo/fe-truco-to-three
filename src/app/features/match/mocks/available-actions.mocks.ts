import type { AvailableAction } from '../../../core/models/match.models';

// Mocks de acciones disponibles para desarrollo visual del panel de acciones.
// No implican lógica real de Truco: solo sirven para probar estados visuales.
// Fuente: docs/CONTRATOS_API.md §4.14 / §8.2

// Todas las acciones principales habilitadas
export const mockActionsCommon: AvailableAction[] = [
  { type: 'CALL_TRUCO' },
  { type: 'CALL_ENVIDO' },
  { type: 'FOLD' },
];

// Solo cantos (simula que ya jugaste carta)
export const mockActionsCallOnly: AvailableAction[] = [
  { type: 'CALL_TRUCO' },
  { type: 'CALL_ENVIDO' },
  { type: 'FOLD' },
];

// Ninguna acción habilitada (esperando al rival o turno del oponente)
export const mockActionsEmpty: AvailableAction[] = [];

// Acciones parcialmente habilitadas (solo mazo)
export const mockActionsOnlyFold: AvailableAction[] = [
  { type: 'FOLD' },
];

// Modo respuesta de envido: el rival cantó envido y el jugador debe responder.
// Envido deshabilitado (ya fue cantado), Real Envido y Falta Envido habilitados.
export const mockActionsRespondEnvido: AvailableAction[] = [
  {
    type: 'RESPOND_ENVIDO',
    details: {
      envidoResponseOptions: {
        envido: false,
        realEnvido: true,
        faltaEnvido: true,
      },
    },
  } as AvailableAction,
  { type: 'FOLD' },
];

// Modo respuesta de truco: el rival cantó truco y el jugador debe responder.
export const mockActionsRespondTruco: AvailableAction[] = [
  { type: 'RESPOND_TRUCO' },
];
