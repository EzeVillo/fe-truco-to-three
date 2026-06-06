// Motor genérico de lobby público — feature 021-public-match-lobby.
// Reconcilia un snapshot REST (paginado) con deltas de un topic WS, de forma
// reutilizable para matches (ahora) y copas/ligas (a futuro, FR-015).
//
// Garantías:
//  - Dedup por id (Map): nunca dos items con la misma clave.
//  - Idempotencia: un REMOVED de un id inexistente es no-op.
//  - Orden de llegada: se suscribe a los deltas ANTES del bootstrap; un REMOVED
//    que llega durante una carga REST en vuelo "tombstonea" el id para que la
//    respuesta REST no lo resucite.

import { signal, computed, type Signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import type { PublicLobbyConfig, PublicLobbyDelta, PublicLobbyStatus } from './public-lobby.types';

export class PublicLobbyStore<T> {
  private readonly entries = new Map<string, T>();
  /** Ids removidos mientras hay una carga REST en vuelo; evita resucitar bajas. */
  private readonly tombstones = new Set<string>();
  private inFlightLoads = 0;
  private cursor: string | null = null;

  private readonly _items = signal<T[]>([]);
  private readonly _status = signal<PublicLobbyStatus>('idle');
  private readonly _hasMore = signal<boolean>(false);

  private deltaSub: Subscription | null = null;
  private loadSub: Subscription | null = null;
  private started = false;

  readonly items: Signal<T[]> = this._items.asReadonly();
  readonly status: Signal<PublicLobbyStatus> = this._status.asReadonly();
  readonly hasMore: Signal<boolean> = this._hasMore.asReadonly();
  readonly isEmpty = computed(() => this._status() === 'ready' && this._items().length === 0);

  constructor(private readonly config: PublicLobbyConfig<T>) {}

  /** Suscribe los deltas y arranca el bootstrap desde la primera página. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.deltaSub = this.config.deltas$.subscribe((delta) => this.applyDelta(delta));
    this.loadFirstPage();
  }

  /** Pide la siguiente página (no-op si no hay más o ya hay una carga en vuelo). */
  loadMore(): void {
    if (!this._hasMore() || this._status() === 'loading' || this.cursor === null) {
      return;
    }
    this.loadPage(this.cursor);
  }

  /** Reintenta tras un error: recarga desde la primera página. */
  retry(): void {
    this.loadFirstPage();
  }

  /**
   * Re-bootstrap: reconcilia desde la primera página (p. ej. al reconectar el WS).
   * Reemplaza el contenido con el snapshot fresco; los deltas siguen vivos.
   */
  reload(): void {
    this.loadFirstPage();
  }

  /** Corta deltas y cargas; deja el store inerte. */
  stop(): void {
    this.deltaSub?.unsubscribe();
    this.loadSub?.unsubscribe();
    this.deltaSub = null;
    this.loadSub = null;
    this.started = false;
  }

  // ─── internos ──────────────────────────────────────────────────────────────

  private loadFirstPage(): void {
    // Snapshot fresco: limpiamos el contenido y recargamos desde el inicio.
    this.entries.clear();
    this.cursor = null;
    this.loadPage(null);
  }

  private loadPage(cursor: string | null): void {
    this._status.set('loading');
    this.inFlightLoads += 1;
    this.loadSub?.unsubscribe();
    this.loadSub = this.config.loadPage(cursor).subscribe({
      next: (page) => {
        for (const item of page.items) {
          const id = this.config.idOf(item);
          if (this.tombstones.has(id)) {
            continue; // el backend ya lo dio de baja mientras cargábamos
          }
          this.entries.set(id, item);
        }
        this.cursor = page.nextCursor;
        this._hasMore.set(page.nextCursor !== null);
        this.finishLoad();
        this._status.set('ready');
        this.syncItems();
      },
      error: () => {
        this.finishLoad();
        this._status.set('error');
      },
    });
  }

  private finishLoad(): void {
    this.inFlightLoads = Math.max(0, this.inFlightLoads - 1);
    if (this.inFlightLoads === 0) {
      this.tombstones.clear();
    }
  }

  private applyDelta(delta: PublicLobbyDelta<T>): void {
    if (delta.kind === 'upsert') {
      const id = this.config.idOf(delta.item);
      this.tombstones.delete(id);
      this.entries.set(id, delta.item);
    } else {
      this.entries.delete(delta.id);
      if (this.inFlightLoads > 0) {
        this.tombstones.add(delta.id);
      }
    }
    this.syncItems();
  }

  private syncItems(): void {
    this._items.set([...this.entries.values()]);
  }
}

/** Azúcar de fábrica: `createPublicLobby(config)`. */
export function createPublicLobby<T>(config: PublicLobbyConfig<T>): PublicLobbyStore<T> {
  return new PublicLobbyStore<T>(config);
}
