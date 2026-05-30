import type { RematchSession } from '../models/rematch.models';
import { computeRemainingMsFromSnapshot } from './turn-timer';

/** true si hay sesión de revancha disponible (independiente de si el diálogo está abierto). */
export function offerVisible(session: RematchSession | null): boolean {
  return session !== null;
}

/** El jugador puede aceptar la revancha. */
export function canAccept(session: RematchSession | null): boolean {
  return session?.status === 'OPEN' && session.selfChoice === 'UNDECIDED';
}

/** El jugador ya aceptó y espera al rival. */
export function waitingForOpponent(session: RematchSession | null): boolean {
  return session?.status === 'OPEN' && session.selfChoice === 'WANTS_REMATCH';
}

/** El rival ya aceptó y la sesión sigue abierta. */
export function opponentWants(session: RematchSession | null): boolean {
  return session?.opponentChoice === 'WANTS_REMATCH' && session?.status === 'OPEN';
}

/** El rival rechazó o abandonó la sesión. */
export function opponentLeft(session: RematchSession | null): boolean {
  return session?.status === 'CLOSED_BY_LEAVE';
}

/** La ventana de revancha venció. */
export function expired(session: RematchSession | null): boolean {
  return session?.status === 'EXPIRED';
}

/** UUID de la nueva partida si la revancha fue confirmada; null en caso contrario. */
export function confirmedMatchId(session: RematchSession | null): string | null {
  return session?.status === 'CONFIRMED' ? (session.resultMatchId ?? null) : null;
}

/**
 * Tiempo restante de la ventana de revancha en ms.
 * Usa computeRemainingMsFromSnapshot para corregir el desfase reloj cliente/servidor.
 * Devuelve 0 si no hay sesión o expiresAt es null.
 */
export function computeRematchCountdown(
  session: RematchSession | null,
  serverClockOffsetMs: number,
  nowMs: number = Date.now(),
): number {
  if (!session || session.expiresAt === null) {return 0;}
  return computeRemainingMsFromSnapshot(session.expiresAt, serverClockOffsetMs, nowMs);
}
