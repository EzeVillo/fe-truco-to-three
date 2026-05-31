/**
 * Persistencia efímera del joinCode de una partida privada, por matchId.
 *
 * El snapshot REST (`GET /api/matches/{id}`, §4.14) no devuelve el joinCode, así
 * que el anfitrión lo recibe al crear y lo necesita visible en la sala de espera
 * incluso tras recargar. Se usa sessionStorage (acotado a la pestaña/sesión) como
 * mitigación; el código es efímero y se limpia al iniciar/cancelar/salir.
 * Feature 015 (research D5).
 */
const PREFIX = 't3.joinCode.';

export function saveJoinCode(matchId: string, joinCode: string): void {
  try {
    sessionStorage.setItem(PREFIX + matchId, joinCode);
  } catch {
    // sessionStorage no disponible (modo privado estricto): degradar a no-op.
  }
}

export function readJoinCode(matchId: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + matchId);
  } catch {
    return null;
  }
}

export function clearJoinCode(matchId: string): void {
  try {
    sessionStorage.removeItem(PREFIX + matchId);
  } catch {
    // no-op
  }
}
