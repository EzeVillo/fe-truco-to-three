import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * Gestiona el ciclo de vida de las actualizaciones del Service Worker (ngsw).
 *
 * El ngsw, por defecto, descarga la versión nueva en segundo plano pero la deja
 * "en el cajón": sigue sirviendo la vieja hasta que el usuario cierra todas las
 * pestañas. Eso provoca que un FE viejo siga corriendo contra un BE nuevo y, si
 * cambió un contrato, rompa. Este servicio cierra ese hueco:
 *
 * - Marca `updateReady` cuando hay una versión nueva ya descargada y lista.
 * - Re-chequea novedades cada vez que la pestaña vuelve al frente (no sólo al
 *   bootear), porque la gente deja la PWA abierta días.
 * - Ante un estado irrecuperable del SW (cache corrupta), recarga para sanear.
 *
 * La decisión de *cuándo* aplicar (recargar ya vs. esperar a salir de la partida)
 * vive en el shell (`App`), que conoce la ruta actual. Acá sólo se expone la
 * señal y el `applyUpdate()`.
 */
@Injectable({ providedIn: 'root' })
export class SwUpdateService {
  private readonly swUpdate = inject(SwUpdate);

  /** `true` cuando hay una versión nueva descargada y lista para activarse. */
  readonly updateReady = signal(false);

  /** Engancha los listeners. Idempotente: sólo actúa si el SW está habilitado. */
  start(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Versión nueva ya bajada y lista → la marcamos disponible.
    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.updateReady.set(true);
      }
    });

    // Cache del SW corrupta/irrecuperable → recargar limpio es la única salida.
    this.swUpdate.unrecoverable.subscribe(() => {
      document.location.reload();
    });

    // Re-chequear cuando la pestaña vuelve al frente. Un build nuevo puede haber
    // salido mientras la PWA estaba en segundo plano.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.swUpdate.checkForUpdate();
      }
    });

    // Chequeo inicial: por si ya hay algo nuevo en el servidor al arrancar.
    void this.swUpdate.checkForUpdate();
  }

  /** Activa la versión nueva y recarga para que el usuario quede en ella. */
  async applyUpdate(): Promise<void> {
    if (!this.updateReady()) {
      return;
    }
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }
}
