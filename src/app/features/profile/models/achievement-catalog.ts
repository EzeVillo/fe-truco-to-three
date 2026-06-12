import type { AchievementDefinition } from '../../../core/models/profile.models';

export const ACHIEVEMENT_CATALOG: Record<string, AchievementDefinition> = {
  WIN_GAME_AS_PIE_MANO_BUSTS_ON_ENVIDO_WITH_0_0_AT_2_2: {
    code: 'WIN_GAME_AS_PIE_MANO_BUSTS_ON_ENVIDO_WITH_0_0_AT_2_2',
    name: 'El pie de las figuras',
    description:
      'Ganaste siendo pie cuando el mano se pasó de 3 con los puntos del envido, con ambos en 0 tantos (todas figuras) y el game 2-2.',
  },
  WIN_GAME_AS_MANO_VIA_FALTA_ENVIDO_WITH_33_33_AT_2_2: {
    code: 'WIN_GAME_AS_MANO_VIA_FALTA_ENVIDO_WITH_33_33_AT_2_2',
    name: 'El mano manda',
    description:
      'Ganaste siendo mano con falta envido empatando 33 a 33: el empate se resuelve a tu favor, con el game 2-2.',
  },
  WIN_GAME_BUST_OPPONENT_VIA_QUIERO_Y_ME_VOY_AL_MAZO: {
    code: 'WIN_GAME_BUST_OPPONENT_VIA_QUIERO_Y_ME_VOY_AL_MAZO',
    name: 'Quiero y me voy',
    description:
      'Ganaste porque el oponente respondió "quiero y me voy al mazo" y se pasó de 3 puntos.',
  },
  WIN_HAND_UNCONTESTED_WITH_ANCHO_DE_ESPADA: {
    code: 'WIN_HAND_UNCONTESTED_WITH_ANCHO_DE_ESPADA',
    name: 'El macho manda',
    description:
      'Ganaste una mano por cierre automático al jugar el ancho de espada, sin que el rival pusiera carta en esa mano.',
  },
  FOLD_BEFORE_ANY_CARD_IS_PLAYED: {
    code: 'FOLD_BEFORE_ANY_CARD_IS_PLAYED',
    name: 'Retirada anticipada',
    description: 'Te fuiste al mazo en un round antes de que ninguno de los dos jugara una carta.',
  },
  WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO: {
    code: 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO',
    name: 'One Shot I',
    description: 'Ganaste un game 3 a 0 desde 0-0 mediante un retruco aceptado.',
  },
  WIN_GAME_THREE_ZERO_VIA_REAL_OR_FALTA_ENVIDO: {
    code: 'WIN_GAME_THREE_ZERO_VIA_REAL_OR_FALTA_ENVIDO',
    name: 'One Shot II',
    description:
      'Ganaste un game 3 a 0 desde 0-0 con un único canto de real envido o falta envido.',
  },
  WIN_GAME_FROM_2_2_WITHOUT_CALLS_IN_ROUND: {
    code: 'WIN_GAME_FROM_2_2_WITHOUT_CALLS_IN_ROUND',
    name: 'A cartas limpias',
    description: 'Ganaste un game desde 2-2 en un round donde no se cantó ni envido ni truco.',
  },
  WIN_GAME_BUST_OPPONENT_VIA_VALE_CUATRO_LOSS_AT_0_0: {
    code: 'WIN_GAME_BUST_OPPONENT_VIA_VALE_CUATRO_LOSS_AT_0_0',
    name: 'Ambición fatal',
    description:
      'Ganaste porque el oponente perdió el round con vale cuatro aceptado: recibió 4 puntos y se pasó de 3, con el game 0-0.',
  },
  WIN_GAME_BUST_RIVAL_VIA_FOLD_AFTER_ACCEPTED_TRUCO_WITH_NO_CARDS: {
    code: 'WIN_GAME_BUST_RIVAL_VIA_FOLD_AFTER_ACCEPTED_TRUCO_WITH_NO_CARDS',
    name: 'No cards, no win',
    description:
      'Cantaste truco con el rival sin cartas, lo aceptó, te fuiste al mazo dándole los puntos y lo hiciste pasar de 3.',
  },
  REACH_CAMPAIGN_TOP_ONE: {
    code: 'REACH_CAMPAIGN_TOP_ONE',
    name: 'La cima',
    description: 'Alcanzaste el puesto #1 del ranking del modo campaña.',
  },
  DEFEAT_ALL_CAMPAIGN_RIVALS: {
    code: 'DEFEAT_ALL_CAMPAIGN_RIVALS',
    name: 'Cien de cien',
    description: 'Le ganaste al menos una vez a cada uno de los 100 bots del modo campaña.',
  },
};
