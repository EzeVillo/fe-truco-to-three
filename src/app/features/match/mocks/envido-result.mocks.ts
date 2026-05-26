import type { EnvidoResultDialogData } from '../components/envido-result-dialog/envido-result-dialog.component';

// Caso 1: Yo soy mano (25), Hans es pie y no revela (null/Son buenas). Yo gané.
export const mockEnvidoResultWinAsMano: EnvidoResultDialogData = {
  manoName: 'Yo',
  manoScore: 25,
  pieName: 'Hans',
  pieScore: null,
  won: true,
};

// Caso 2: Hans es mano (28), Yo soy pie y no revelo (null/Son buenas). Hans ganó, yo perdí.
export const mockEnvidoResultLoseAsPie: EnvidoResultDialogData = {
  manoName: 'Hans',
  manoScore: 28,
  pieName: 'Yo',
  pieScore: null,
  won: false,
};

// Caso 3: Hans es mano (20), Yo soy pie (25) y supero. Yo gané.
export const mockEnvidoResultWinAsPie: EnvidoResultDialogData = {
  manoName: 'Hans',
  manoScore: 20,
  pieName: 'Yo',
  pieScore: 25,
  won: true,
};

// Caso 4: Yo soy mano (20), Hans es pie (25) y supera. Hans ganó, yo perdí.
export const mockEnvidoResultLoseAsMano: EnvidoResultDialogData = {
  manoName: 'Yo',
  manoScore: 20,
  pieName: 'Hans',
  pieScore: 25,
  won: false,
};
