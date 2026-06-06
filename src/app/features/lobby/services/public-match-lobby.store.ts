// Store del lobby público de matches — feature 021-public-match-lobby.
// Instancia el motor genérico PublicLobbyStore<T> con:
//  - loadPage  = MatchesApiService.listPublicMatches (bootstrap/paginación REST §4.3)
//  - deltas$   = topic /topic/public-match-lobby mapeado a PublicLobbyDelta (§9.4)
//  - idOf      = matchId
// Reusable como referencia para los lobbies de copas/ligas (FR-015).

import { Injectable, inject, DestroyRef } from '@angular/core';
import { filter, map } from 'rxjs';
import type { Observable, Subscription } from 'rxjs';
import { WebSocketService } from '../../../core/services/websocket.service';
import { MatchesApiService } from './matches-api.service';
import { PublicLobbyStore } from '../../../shared/public-lobby/public-lobby-store';
import type { PublicLobbyDelta } from '../../../shared/public-lobby/public-lobby.types';
import type {
  PublicMatchLobbyEvent,
  PublicMatchLobbyItem,
} from '../models/public-match-lobby.models';

const PUBLIC_MATCH_LOBBY_TOPIC = '/topic/public-match-lobby';

type MatchDelta = PublicLobbyDelta<PublicMatchLobbyItem>;

/** Mapea un evento del topic al delta genérico; null si el evento no aplica. */
function toDelta(event: PublicMatchLobbyEvent): MatchDelta | null {
  if (event.eventType === 'PUBLIC_MATCH_LOBBY_UPSERT') {
    return { kind: 'upsert', item: event.payload.lobby };
  }
  if (event.eventType === 'PUBLIC_MATCH_LOBBY_REMOVED') {
    return { kind: 'removed', id: event.payload.id };
  }
  return null;
}

@Injectable()
export class PublicMatchLobbyStore {
  private readonly api = inject(MatchesApiService);
  private readonly webSocket = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly deltas$: Observable<MatchDelta> = this.webSocket
    .subscribe<PublicMatchLobbyEvent>(PUBLIC_MATCH_LOBBY_TOPIC)
    .pipe(
      map((event) => toDelta(event)),
      filter((delta): delta is MatchDelta => delta !== null),
    );

  private readonly engine = new PublicLobbyStore<PublicMatchLobbyItem>({
    idOf: (item) => item.matchId,
    loadPage: (cursor) => this.api.listPublicMatches(undefined, cursor),
    deltas$: this.deltas$,
  });

  private connectionSub: Subscription | null = null;
  /** La primera conexión es el arranque normal, no una reconexión. */
  private sawFirstConnection = false;

  // Señales re-expuestas del motor.
  readonly items = this.engine.items;
  readonly status = this.engine.status;
  readonly hasMore = this.engine.hasMore;
  readonly isEmpty = this.engine.isEmpty;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Conecta el WS y arranca el bootstrap + reconciliación. */
  start(): void {
    // Al reconectar el WS, re-bootstrapeamos para volver a un estado consistente
    // (cubre la pérdida de deltas durante la desconexión).
    this.connectionSub = this.webSocket.connected.subscribe((isConnected) => {
      if (!isConnected) {
        return;
      }
      if (this.sawFirstConnection) {
        this.engine.reload();
      } else {
        this.sawFirstConnection = true;
      }
    });
    this.webSocket.connect();
    this.engine.start();
  }

  loadMore(): void {
    this.engine.loadMore();
  }

  retry(): void {
    this.engine.retry();
  }

  stop(): void {
    this.connectionSub?.unsubscribe();
    this.connectionSub = null;
    this.engine.stop();
  }
}
