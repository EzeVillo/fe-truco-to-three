export interface VariantRuleItem {
  readonly text: string;
  readonly emphasis?: readonly string[];
}

export interface VariantRuleSection {
  readonly id:
    | 'objective'
    | 'falta-envido'
    | 'fold-after-quiero'
    | 'sword-ace-close'
    | 'hand-fold-restriction';
  readonly title: string;
  readonly summary?: string;
  readonly items: readonly VariantRuleItem[];
}

export const VARIANT_RULE_SECTIONS: readonly VariantRuleSection[] = [
  {
    id: 'objective',
    title: 'Punto exacto',
    summary:
      'Cada game se gana llegando exactamente a 3 puntos. Si un jugador supera 3, pierde ese game.',
    items: [],
  },
  {
    id: 'falta-envido',
    title: 'Falta envido',
    summary:
      'Falta envido otorga, si se quiere, los puntos que le faltan al rival para llegar a 3.',
    items: [],
  },
  {
    id: 'fold-after-quiero',
    title: 'Quiero y me voy al mazo',
    summary: 'Si respondés quiero y me voy al mazo, el rival gana el truco cantado en ese momento.',
    items: [
      { text: 'Esta opción no está disponible si el jugador ya no tiene cartas en la mano.' },
    ],
  },
  {
    id: 'sword-ace-close',
    title: 'Cierre por ancho de espada',
    summary: 'El 1 de espada cierra la round inmediatamente en situaciones puntuales.',
    items: [
      { text: 'La primera mano fue parda y el ancho se juega en la segunda mano.' },
      { text: 'El portador del ancho ganó la primera mano y juega el ancho en la segunda mano.' },
      { text: 'Se está jugando la tercera mano.' },
      { text: 'Después de ese cierre automático ya no se puede cantar truco.' },
    ],
  },
  {
    id: 'hand-fold-restriction',
    title: 'Irse al mazo siendo mano',
    summary:
      'El jugador mano no puede irse al mazo en la primera mano salvo que ya exista una acción previa clave.',
    items: [
      { text: 'Puede hacerlo si el envido ya fue resuelto.' },
      { text: 'Puede hacerlo si el truco ya fue cantado.' },
      { text: 'El jugador que no es mano puede irse al mazo en cualquier momento.' },
    ],
  },
];
