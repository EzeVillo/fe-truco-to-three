/**
 * Persistencia efímera del "handoff" de una partida recién creada, por matchId:
 * el joinCode compartible y la visibilidad (PUBLIC | PRIVATE).
 *
 * El snapshot REST (`GET /api/matches/{id}`, §4.14) no devuelve ni el joinCode ni
 * la visibilidad, así que el anfitrión los recibe al crear y los necesita en la
 * sala de espera incluso tras recargar (título correcto + código a compartir). Se
 * usa sessionStorage (acotado a la pestaña/sesión) como mitigación; es efímero y
 * se limpia al iniciar/cancelar/salir. Feature 015 (research D5).
 */
import { VISIBILITY, type Visibility } from '../../../core/models/enums';

const PREFIX = 't3.matchHandoff.';

export interface MatchHandoff {
  joinCode: string;
  visibility: Visibility;
}

export function saveMatchHandoff(matchId: string, handoff: MatchHandoff): void {
  try {
    sessionStorage.setItem(PREFIX + matchId, JSON.stringify(handoff));
  } catch {
    // sessionStorage no disponible (modo privado estricto): degradar a no-op.
  }
}

export function readMatchHandoff(matchId: string): MatchHandoff | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + matchId);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<MatchHandoff> | null;
    if (!parsed || typeof parsed.joinCode !== 'string') {
      return null;
    }
    const visibility =
      parsed.visibility === VISIBILITY.PUBLIC ? VISIBILITY.PUBLIC : VISIBILITY.PRIVATE;
    return { joinCode: parsed.joinCode, visibility };
  } catch {
    return null;
  }
}

export function clearMatchHandoff(matchId: string): void {
  try {
    sessionStorage.removeItem(PREFIX + matchId);
  } catch {
    // no-op
  }
}
