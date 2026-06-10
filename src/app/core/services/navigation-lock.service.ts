import { Injectable, computed, signal } from '@angular/core';

/**
 * Lock de navegación del lado del cliente para operaciones transitorias que aún
 * no se reflejan en la presencia del backend (crear/unirse a una partida, enviar
 * la búsqueda de partida rápida).
 *
 * Mientras está tomado, el header bloquea el logo/marca para que el usuario no
 * pueda salir a mitad de un POST en vuelo (y terminar en un estado inconsistente).
 *
 * Como las páginas que lo usan son rutas hermanas (nunca conviven), alcanza con
 * un booleano: cada página espeja su estado `busy` acá vía `effect` y lo limpia
 * en `onDestroy`. La presencia del backend cubre las esperas largas (cola de
 * matchmaking, partida en curso); este lock cubre solo la ventana del request.
 */
@Injectable({ providedIn: 'root' })
export class NavigationLockService {
  private readonly _locked = signal(false);
  readonly locked = computed(() => this._locked());

  set(locked: boolean): void {
    this._locked.set(locked);
  }
}
