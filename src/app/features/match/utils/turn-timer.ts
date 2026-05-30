/**
 * Utilidades de cálculo del temporizador de turno (feature 013-turn-timer).
 *
 * El backend es el único árbitro del vencimiento; estas funciones sólo derivan
 * el tiempo restante para representarlo como un indicador visual de progreso.
 *
 * Fuente del contrato: docs/CONTRATOS_API.md §4.18 (mecánica), §9.6 (eventos).
 */

/** Umbral de urgencia: se enfatiza el indicador con este restante o menos (FR-006). */
export const URGENCY_THRESHOLD_MS = 5000;

/**
 * Restante a partir de un evento WS en vivo (`ACTION_DEADLINE_SET`).
 *
 * Usa el `timestamp` del evento (epochMillis del servidor) como "ahora" del
 * servidor, evitando depender del reloj del dispositivo (FR-010). El resultado
 * se normaliza a 0 si ya venció.
 */
export function computeRemainingMsFromEvent(
  actionDeadline: number,
  eventTimestamp: number,
): number {
  return Math.max(0, actionDeadline - eventTimestamp);
}

/**
 * Restante a partir del snapshot REST (carga inicial / reconexión), corrigiendo
 * el desfase del reloj del cliente con un offset servidor↔cliente (FR-009/FR-010).
 *
 * `serverClockOffsetMs = lastEventTimestamp - Date.now()` en el momento del último
 * evento WS visto (0 si aún no hubo evento). Se normaliza a 0 si ya venció.
 */
export function computeRemainingMsFromSnapshot(
  actionDeadline: number,
  serverClockOffsetMs: number,
  now: number = Date.now(),
): number {
  return Math.max(0, actionDeadline - (now + serverClockOffsetMs));
}

/** ¿El restante está dentro del umbral de urgencia? (FR-006) */
export function isUrgent(remainingMs: number): boolean {
  return remainingMs <= URGENCY_THRESHOLD_MS;
}

/**
 * Fracción de progreso transcurrido en [0, 1] para el indicador visual.
 * 0 = recién iniciado (lleno), 1 = agotado (vacío). Defensivo ante duración
 * inválida (<= 0): devuelve 1 (agotado) para no mostrar un reloj en marcha
 * incorrecto (FR-013).
 */
export function computeElapsedFraction(
  remainingMs: number,
  turnDurationMillis: number,
): number {
  if (turnDurationMillis <= 0) {
    return 1;
  }
  const clampedRemaining = Math.min(Math.max(0, remainingMs), turnDurationMillis);
  return 1 - clampedRemaining / turnDurationMillis;
}

/**
 * ¿Hay un reloj activo y consumible? `false` si falta cualquiera de los campos
 * del plazo (FR-013: plazo ausente/nulo → sin reloj).
 */
export function hasActiveDeadline(
  actionDeadline: number | null,
  turnDurationMillis: number | null,
  actionDeadlineSeat: string | null,
): actionDeadline is number {
  return (
    actionDeadline !== null &&
    turnDurationMillis !== null &&
    turnDurationMillis > 0 &&
    actionDeadlineSeat !== null
  );
}
