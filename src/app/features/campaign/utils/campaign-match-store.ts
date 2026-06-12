/**
 * Marca efímera de qué matchId corresponde a un desafío de campaña, por matchId.
 *
 * El snapshot REST del match (`GET /api/matches/{id}`) no expone si la partida es
 * de campaña, y el evento WS de fin de match tampoco lo indica. El front necesita
 * saberlo para, al terminar, esperar el push `CAMPAIGN_MATCH_POINTS` y mostrar el
 * modal de puntos. Se persiste en sessionStorage (acotado a la pestaña) para
 * sobrevivir a una recarga durante el match; se limpia al consumir el resultado.
 */
const PREFIX = 't3.campaignMatch.';

export function markCampaignMatch(matchId: string): void {
  try {
    sessionStorage.setItem(PREFIX + matchId, '1');
  } catch {
    // sessionStorage no disponible (modo privado estricto): degradar a no-op.
  }
}

export function isCampaignMatch(matchId: string): boolean {
  try {
    return sessionStorage.getItem(PREFIX + matchId) !== null;
  } catch {
    return false;
  }
}

export function clearCampaignMatch(matchId: string): void {
  try {
    sessionStorage.removeItem(PREFIX + matchId);
  } catch {
    // no-op
  }
}
