// Modelos del modo campaña — fuente: docs/CONTRATOS_API.md §7.7
//
// Toda la lógica de progresión (quién es desafiable, puntos, posiciones,
// logros) vive en el backend. El FE solo renderiza estos campos tal cual
// llegan: nunca derivar `challengeable`, posiciones ni puntos localmente.

/** Head-to-head contra un bot del ranking (§7.7.1). */
export interface CampaignRecord {
  wins: number;
  losses: number;
}

/** Fila del ranking de campaña (§7.7.1). El jugador viene intercalado con `player: true`. */
export interface CampaignRankingEntry {
  /** Posición en el ranking (1 = cima). */
  position: number;
  participantId: string;
  /** `null` en la fila del propio jugador. */
  displayName: string | null;
  points: number;
  /** `true` en la fila del propio jugador. */
  player: boolean;
  /** `true` si ese bot puede desafiarse ahora (lo decide el BE). */
  challengeable: boolean;
  /** `null` si nunca se enfrentaron, y siempre en la fila del jugador. */
  record: CampaignRecord | null;
}

/** Respuesta de GET /api/campaign (§7.7.1). */
export interface CampaignResponse {
  playerPosition: number;
  playerPoints: number;
  totalBots: number;
  defeatedRivals: number;
  topOneReached: boolean;
  allRivalsDefeated: boolean;
  /** Puntos faltantes para superar al rival inmediato; `null` si ya está #1. */
  pointsToNextPosition: number | null;
  /** matchId del desafío en curso, o `null` si no hay ninguno. */
  activeChallengeMatchId: string | null;
  ranking: CampaignRankingEntry[];
}

/**
 * Body de POST /api/campaign/challenges (§7.7.2). Es opcional: sin `botId`
 * se desafía al inmediato superior; con `botId` solo se acepta tras llegar al #1.
 */
export interface CreateCampaignChallengeRequest {
  botId: string;
}

/** Respuesta de POST /api/campaign/challenges (§7.7.2). */
export interface CreateCampaignChallengeResponse {
  matchId: string;
  rivalId: string;
  rivalName: string;
  rivalPosition: number;
}
