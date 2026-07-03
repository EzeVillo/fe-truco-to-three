import { Injectable, signal } from '@angular/core';

/**
 * Store root de "¿el visor puede accionar ahora?" (es su turno) en la partida en
 * curso. Igual que `SpectatorCountStore`, es el punto compartido entre el
 * `MatchStateService` provisto por pantalla (que lo escribe desde el estado del
 * match) y el `GlobalHeaderComponent`, que es global y lo lee para habilitar o no
 * el botón "Abandonar partida".
 *
 * La semántica de "puede accionar" = el visor tiene acciones disponibles (jugar
 * carta, responder canto, cantar…). En el turno del rival queda `false`. Sólo
 * aplica a un jugador sentado: el contexto (jugador vs espectador vs bot-vs-bot)
 * NO vive acá, lo deriva el header de la URL / presence.
 *
 * Default `true` (conservador): mientras no haya un match activo que lo baje, el
 * botón queda habilitado y no se atrapa al usuario.
 */
@Injectable({ providedIn: 'root' })
export class MatchTurnStore {
  private readonly _viewerCanAct = signal<boolean>(true);
  readonly viewerCanAct = this._viewerCanAct.asReadonly();

  set(canAct: boolean): void {
    this._viewerCanAct.set(canAct);
  }

  reset(): void {
    this._viewerCanAct.set(true);
  }
}
