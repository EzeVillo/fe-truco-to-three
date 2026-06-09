import { Injectable } from '@angular/core';

/**
 * Precarga las imágenes del mazo en la caché del navegador para que, cuando el rival
 * juegue una carta, la imagen aparezca al instante en vez de verse transparente mientras
 * se descarga. El mazo de truco son 40 cartas (números 1-7, 10-12 por cada palo) más el
 * dorso. La precarga corre una sola vez por sesión.
 */
@Injectable({ providedIn: 'root' })
export class CardPreloadService {
  private static readonly NUMBERS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
  private static readonly SUITS = ['espada', 'basto', 'copa', 'oro'];

  private preloaded = false;

  preloadDeck(): void {
    if (this.preloaded || typeof Image === 'undefined') {
      return;
    }
    this.preloaded = true;

    const urls = ['/cards/dorso.webp'];
    for (const number of CardPreloadService.NUMBERS) {
      for (const suit of CardPreloadService.SUITS) {
        urls.push(`/cards/${number}_${suit}.webp`);
      }
    }

    for (const url of urls) {
      const img = new Image();
      img.src = url;
    }
  }
}
