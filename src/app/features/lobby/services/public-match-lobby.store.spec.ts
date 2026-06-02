import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { PublicMatchLobbyStore } from './public-match-lobby.store';
import { MatchesApiService } from './matches-api.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import type { PublicMatchesPage, PublicMatchLobbyEvent } from '../models/public-match-lobby.models';

function makeItem(matchId: string, host = 'alguien') {
  return {
    matchId,
    host,
    gamesToPlay: 3 as const,
    totalSlots: 2,
    occupiedSlots: 1,
    status: 'WAITING_FOR_PLAYERS' as const,
    joinCode: matchId.toUpperCase(),
  };
}

describe('PublicMatchLobbyStore', () => {
  let events$: Subject<PublicMatchLobbyEvent>;
  let connected$: Subject<boolean>;
  let listSpy: ReturnType<typeof vi.fn>;
  let connectSpy: ReturnType<typeof vi.fn>;
  let store: PublicMatchLobbyStore;

  beforeEach(() => {
    events$ = new Subject<PublicMatchLobbyEvent>();
    connected$ = new Subject<boolean>();
    listSpy = vi.fn(
      (): ReturnType<MatchesApiService['listPublicMatches']> =>
        of({ items: [makeItem('a')], nextCursor: null } satisfies PublicMatchesPage),
    );
    connectSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        PublicMatchLobbyStore,
        { provide: MatchesApiService, useValue: { listPublicMatches: listSpy } },
        {
          provide: WebSocketService,
          useValue: { connect: connectSpy, connected: connected$, subscribe: () => events$ },
        },
      ],
    });
    store = TestBed.inject(PublicMatchLobbyStore);
  });

  it('start() conecta el WS y bootstrapea la lista por REST', () => {
    store.start();
    expect(connectSpy).toHaveBeenCalled();
    expect(listSpy).toHaveBeenCalled();
    expect(store.items().map((i) => i.matchId)).toEqual(['a']);
    expect(store.status()).toBe('ready');
  });

  it('aplica un UPSERT del topic agregando una partida', () => {
    store.start();
    events$.next({
      eventType: 'PUBLIC_MATCH_LOBBY_UPSERT',
      timestamp: 1,
      payload: { lobby: makeItem('b', 'otro') },
    });
    expect(store.items().map((i) => i.matchId)).toEqual(['a', 'b']);
  });

  it('aplica un REMOVED del topic quitando una partida', () => {
    store.start();
    events$.next({ eventType: 'PUBLIC_MATCH_LOBBY_REMOVED', timestamp: 2, payload: { id: 'a' } });
    expect(store.items()).toEqual([]);
    expect(store.isEmpty()).toBe(true);
  });

  it('un UPSERT de una partida ya visible la actualiza sin duplicar', () => {
    store.start(); // bootstrap: [a]
    events$.next({
      eventType: 'PUBLIC_MATCH_LOBBY_UPSERT',
      timestamp: 3,
      payload: { lobby: { ...makeItem('a'), occupiedSlots: 2 } },
    });
    expect(store.items()).toHaveLength(1);
    expect(store.items()[0].occupiedSlots).toBe(2);
  });

  it('re-bootstrapea al reconectar el WS (no en la primera conexión)', () => {
    store.start();
    connected$.next(true); // primera conexión: arranque normal
    expect(listSpy).toHaveBeenCalledTimes(1);

    connected$.next(false); // se cae
    connected$.next(true); // reconecta → re-bootstrap
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});
