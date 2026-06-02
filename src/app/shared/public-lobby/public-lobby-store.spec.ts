import { describe, it, expect, beforeEach } from 'vitest';
import { Subject } from 'rxjs';
import type { Observable } from 'rxjs';
import { PublicLobbyStore } from './public-lobby-store';
import type { PublicLobbyDelta, PublicLobbyPage } from './public-lobby.types';

interface Item {
  id: string;
  name: string;
}

describe('PublicLobbyStore (motor genérico de reconcile)', () => {
  let deltas$: Subject<PublicLobbyDelta<Item>>;
  let pageRequests: Array<{ cursor: string | null; subject: Subject<PublicLobbyPage<Item>> }>;
  let store: PublicLobbyStore<Item>;

  const loadPage = (cursor: string | null): Observable<PublicLobbyPage<Item>> => {
    const subject = new Subject<PublicLobbyPage<Item>>();
    pageRequests.push({ cursor, subject });
    return subject;
  };

  const resolveLastPage = (page: PublicLobbyPage<Item>): void => {
    const req = pageRequests[pageRequests.length - 1];
    req.subject.next(page);
    req.subject.complete();
  };

  beforeEach(() => {
    deltas$ = new Subject<PublicLobbyDelta<Item>>();
    pageRequests = [];
    store = new PublicLobbyStore<Item>({ idOf: (i) => i.id, loadPage, deltas$ });
  });

  it('bootstrapea desde la primera página y queda en ready', () => {
    store.start();
    expect(store.status()).toBe('loading');
    resolveLastPage({ items: [{ id: 'a', name: 'A' }], nextCursor: null });

    expect(store.status()).toBe('ready');
    expect(store.items()).toEqual([{ id: 'a', name: 'A' }]);
    expect(store.hasMore()).toBe(false);
  });

  it('marca hasMore cuando hay nextCursor y pagina con loadMore', () => {
    store.start();
    resolveLastPage({ items: [{ id: 'a', name: 'A' }], nextCursor: 'cur1' });
    expect(store.hasMore()).toBe(true);

    store.loadMore();
    expect(pageRequests[pageRequests.length - 1].cursor).toBe('cur1');
    resolveLastPage({ items: [{ id: 'b', name: 'B' }], nextCursor: null });

    expect(store.items().map((i) => i.id)).toEqual(['a', 'b']);
    expect(store.hasMore()).toBe(false);
  });

  it('aplica delta upsert agregando un item nuevo', () => {
    store.start();
    resolveLastPage({ items: [{ id: 'a', name: 'A' }], nextCursor: null });

    deltas$.next({ kind: 'upsert', item: { id: 'b', name: 'B' } });
    expect(store.items().map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('aplica delta upsert actualizando sin duplicar', () => {
    store.start();
    resolveLastPage({ items: [{ id: 'a', name: 'A' }], nextCursor: null });

    deltas$.next({ kind: 'upsert', item: { id: 'a', name: 'A2' } });
    expect(store.items()).toEqual([{ id: 'a', name: 'A2' }]);
  });

  it('aplica delta removed eliminando por id', () => {
    store.start();
    resolveLastPage({
      items: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      nextCursor: null,
    });

    deltas$.next({ kind: 'removed', id: 'a' });
    expect(store.items().map((i) => i.id)).toEqual(['b']);
  });

  it('removed de un id inexistente es no-op', () => {
    store.start();
    resolveLastPage({ items: [{ id: 'a', name: 'A' }], nextCursor: null });

    deltas$.next({ kind: 'removed', id: 'zzz' });
    expect(store.items().map((i) => i.id)).toEqual(['a']);
  });

  it('no resucita un item removido por delta mientras la carga REST está en vuelo', () => {
    store.start(); // suscribe deltas y dispara loadPage (aún sin resolver)
    deltas$.next({ kind: 'removed', id: 'a' }); // baja durante la carga

    resolveLastPage({
      items: [
        { id: 'a', name: 'A' }, // el backend todavía lo incluía en el snapshot
        { id: 'b', name: 'B' },
      ],
      nextCursor: null,
    });

    expect(store.items().map((i) => i.id)).toEqual(['b']);
  });

  it('pasa a error si la carga falla y se recupera con retry', () => {
    store.start();
    pageRequests[pageRequests.length - 1].subject.error(new Error('boom'));
    expect(store.status()).toBe('error');

    store.retry();
    resolveLastPage({ items: [{ id: 'a', name: 'A' }], nextCursor: null });
    expect(store.status()).toBe('ready');
    expect(store.items().map((i) => i.id)).toEqual(['a']);
  });

  it('reload reconcilia desde la primera página reemplazando el contenido', () => {
    store.start();
    resolveLastPage({ items: [{ id: 'a', name: 'A' }], nextCursor: null });

    store.reload();
    resolveLastPage({ items: [{ id: 'c', name: 'C' }], nextCursor: null });
    expect(store.items().map((i) => i.id)).toEqual(['c']);
  });

  it('isEmpty true cuando ready y sin items', () => {
    store.start();
    resolveLastPage({ items: [], nextCursor: null });
    expect(store.isEmpty()).toBe(true);
  });
});
