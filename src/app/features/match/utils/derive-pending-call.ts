import type { MatchState, RoundState, ViewerSeat } from '../../../core/models/match.models';

/**
 * Canto pendiente reconstruido a partir del snapshot REST (GET /api/matches/{id}).
 *
 * El bubble de canto (¡Truco!, ¡Envido!, …) se alimenta normalmente de eventos WS
 * en vivo. Pero si el rival canta ANTES de que el visor entre a la partida (caso
 * típico de la revancha: el bot canta apenas arranca la nueva ronda), ese evento
 * ya ocurrió y no se reemite. El snapshot sí refleja el canto sin resolver
 * (`currentTrucoCall` / `roundStatus`), así que lo usamos para hidratar el bubble
 * al cargar la pantalla. Ver feature 014 (revancha) y 009 (rival-call-display).
 */
export interface PendingCallDisplay {
  /** Asiento de quien cantó (el bubble se muestra sobre este jugador). */
  seat: ViewerSeat;
  /** Texto legible en español para el bubble. */
  text: string;
}

const TRUCO_TEXT: Record<string, string> = {
  TRUCO: '¡Truco!',
  RETRUCO: '¡Retruco!',
  VALE_CUATRO: '¡Vale cuatro!',
};

const ENVIDO_TEXT: Record<string, string> = {
  ENVIDO: '¡Envido!',
  REAL_ENVIDO: '¡Real envido!',
  FALTA_ENVIDO: '¡Falta envido!',
};

function oppositeSeat(seat: ViewerSeat): ViewerSeat {
  return seat === 'PLAYER_ONE' ? 'PLAYER_TWO' : 'PLAYER_ONE';
}

/** Mapea un username al asiento correspondiente, o `null` si no coincide con ninguno. */
function usernameToSeat(username: string, state: MatchState): ViewerSeat | null {
  if (username === state.playerOneUsername) {
    return 'PLAYER_ONE';
  }
  if (username === state.playerTwoUsername) {
    return 'PLAYER_TWO';
  }
  return null;
}

/**
 * Determina qué asiento debe responder el canto pendiente. Durante un canto sin
 * resolver el reloj corre sobre el respondedor (`actionDeadlineSeat`); si no hay
 * reloj, se infiere por la acción RESPOND_* del visor.
 */
function resolveResponderSeat(round: RoundState, viewerSeat: ViewerSeat): ViewerSeat | null {
  if (round.actionDeadlineSeat) {
    return round.actionDeadlineSeat;
  }
  const viewerMustRespond = round.availableActions.some(
    (a) => a.type === 'RESPOND_TRUCO' || a.type === 'RESPOND_ENVIDO',
  );
  return viewerMustRespond ? viewerSeat : null;
}

/**
 * Reconstruye el canto pendiente (truco o envido) desde el snapshot, o `null` si
 * no hay ninguno sin resolver. El asiento devuelto es el del cantor (opuesto al
 * respondedor). Tanto `currentTrucoCall` como `currentEnvidoCall` exponen la
 * fuerza exacta del canto pendiente, así que el bubble es exacto en ambos casos.
 */
export function derivePendingCall(state: MatchState): PendingCallDisplay | null {
  const round = state.roundGame;
  if (!round) {
    return null;
  }

  const isTruco = round.roundStatus === 'TRUCO_IN_PROGRESS' && round.currentTrucoCall !== null;
  const isEnvido = round.roundStatus === 'ENVIDO_IN_PROGRESS' && round.currentEnvidoCall !== null;

  const text = isTruco
    ? TRUCO_TEXT[round.currentTrucoCall as string]
    : isEnvido
      ? ENVIDO_TEXT[round.currentEnvidoCall as string]
      : undefined;
  if (!text) {
    return null;
  }

  // Si el snapshot trae el cantor explícito (solo espectador, §4.15), ubicamos el
  // bubble directamente sobre su asiento. Es más robusto que inferir el respondedor:
  // en bot-vs-bot no hay reloj (actionDeadlineSeat null) ni availableActions, así
  // que la inferencia caería y el canto pendiente no se mostraría al refrescar.
  const callerUsername = isTruco ? round.currentTrucoCaller : round.currentEnvidoCaller;
  if (callerUsername) {
    const callerSeat = usernameToSeat(callerUsername, state);
    if (callerSeat) {
      return { seat: callerSeat, text };
    }
  }

  const responderSeat = resolveResponderSeat(round, state.viewerSeat);
  if (!responderSeat) {
    return null;
  }

  return { seat: oppositeSeat(responderSeat), text };
}
