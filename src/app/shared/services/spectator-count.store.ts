import { Injectable, signal } from '@angular/core';

/**
 * Store root del conteo de espectadores de la partida en curso. Punto compartido
 * entre los servicios provistos por pantalla —`MatchStateService` (jugador) y
 * `SpectateStateService` (espectador)— que lo escriben, y el `GlobalHeaderComponent`,
 * que es global y lo lee para mostrar el badge `👁 N` en el header (feature 026).
 *
 * El contexto (jugador vs espectador) NO vive acá: el header lo deriva de la URL.
 */
@Injectable({ providedIn: 'root' })
export class SpectatorCountStore {
  private readonly _count = signal<number>(0);
  readonly count = this._count.asReadonly();

  set(count: number): void {
    this._count.set(count);
  }

  reset(): void {
    this._count.set(0);
  }
}
