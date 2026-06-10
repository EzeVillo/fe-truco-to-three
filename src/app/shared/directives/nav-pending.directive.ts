import { Directive, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
} from '@angular/router';
import { NavigationLockService } from '../../core/services/navigation-lock.service';

/**
 * Marca un link/botón de navegación como "pendiente" desde que se lo toca hasta
 * que la navegación termina. El elemento tocado aplica `is-nav-pending` (loader +
 * bloqueo de más clicks vía CSS) y `aria-busy`; el resto de los links/botones
 * `appNavPending` aplican `is-nav-blocked` (sólo bloqueo, sin loader) mientras esa
 * navegación está en vuelo, vía el `NavigationLockService` compartido.
 *
 * Resuelve el doble-tap en rutas lazy: la primera vez que se entra a una ruta,
 * con red mala, bajar el chunk del componente tarda y el link no cambiaba de
 * aspecto, así que el usuario creía que no había funcionado y volvía a tocar otro.
 */
@Directive({
  selector: '[appNavPending]',
  standalone: true,
  host: {
    '[class.is-nav-pending]': 'pending()',
    '[class.is-nav-blocked]': 'blocked()',
    '[attr.aria-busy]': 'pending() ? "true" : null',
  },
})
export class NavPendingDirective {
  private readonly router = inject(Router);
  private readonly navLock = inject(NavigationLockService);

  readonly pending = signal(false);
  /** Otra navegación `appNavPending` está en vuelo: este elemento se bloquea sin loader. */
  readonly blocked = computed(() => !this.pending() && this.navLock.locked());

  constructor() {
    // Cualquier desenlace de la navegación limpia el estado (incluye same-url).
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      ) {
        this.pending.set(false);
        this.navLock.set(false);
      }
    });
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    // Sólo el click "normal" navega en esta pestaña. Ctrl/Cmd/Shift/Alt o el
    // botón del medio abren en otra pestaña: ahí la página actual no navega y no
    // hay que dejar el loader pegado.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    this.pending.set(true);
    this.navLock.set(true);
  }
}
