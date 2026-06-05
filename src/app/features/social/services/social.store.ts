// Store social (amistades) — feature 024-friends-system.
//
// Centraliza las tres listas (amigos / recibidas / enviadas), su bootstrap REST,
// las acciones del usuario y la reconciliación en tiempo real de los eventos del
// canal /user/queue/social.
//
// Garantías de reconciliación (data-model.md §4):
//  - Clave de identidad = `username` del otro jugador en cada lista.
//  - Idempotencia: upsert no duplica; remove es no-op si la clave no está.
//  - El orden de llegada REST vs WS no altera el estado final.
//  - La suscripción WS sólo se activa para usuarios registrados (no guests).

import { Injector, effect, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { forkJoin, type Subscription } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { WebSocketService } from '../../../core/services/websocket.service';
import { getErrorCopy } from '../../../shared/error-copy/error-copy';
import { SocialApiService } from './social-api.service';
import type {
  FriendSummary,
  IncomingFriendshipRequest,
  OutgoingFriendshipRequest,
} from '../../../core/models/social.models';
import type { SocialWsEvent } from '../../../core/models/ws.models';

interface SocialState {
  friends: FriendSummary[];
  incoming: IncomingFriendshipRequest[];
  outgoing: OutgoingFriendshipRequest[];
  /** Carga inicial (bootstrap REST de las tres listas). */
  loading: boolean;
  /** Error del bootstrap (copy del front), a nivel página. */
  error: string | null;
  /** Error de la última acción del usuario (copy del front). */
  actionError: string | null;
  /** Username del solicitante de la última solicitud recibida en vivo (toast). */
  incomingToast: string | null;
}

const INITIAL: SocialState = {
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,
  error: null,
  actionError: null,
  incomingToast: null,
};

// ─── Helpers puros de reconciliación (idempotentes por username) ─────────────

// La identidad del otro jugador es el `username`, y los usernames son
// case-insensitive: el BE puede devolver un casing canónico distinto al que el
// usuario tipeó al enviar la solicitud. Comparamos siempre normalizando para que
// los eventos WS reconcilien aunque difiera el casing.
function sameUsername(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function upsertFriend(list: FriendSummary[], friendUsername: string): FriendSummary[] {
  return list.some((f) => sameUsername(f.friendUsername, friendUsername))
    ? list
    : [...list, { friendUsername }];
}

function removeFriendFrom(list: FriendSummary[], friendUsername: string): FriendSummary[] {
  return list.filter((f) => !sameUsername(f.friendUsername, friendUsername));
}

function upsertIncoming(
  list: IncomingFriendshipRequest[],
  requesterUsername: string,
): IncomingFriendshipRequest[] {
  return list.some((r) => sameUsername(r.requesterUsername, requesterUsername))
    ? list
    : [...list, { requesterUsername }];
}

function removeIncoming(
  list: IncomingFriendshipRequest[],
  requesterUsername: string,
): IncomingFriendshipRequest[] {
  return list.filter((r) => !sameUsername(r.requesterUsername, requesterUsername));
}

function upsertOutgoing(
  list: OutgoingFriendshipRequest[],
  addresseeUsername: string,
): OutgoingFriendshipRequest[] {
  return list.some((r) => sameUsername(r.addresseeUsername, addresseeUsername))
    ? list
    : [...list, { addresseeUsername }];
}

function removeOutgoing(
  list: OutgoingFriendshipRequest[],
  addresseeUsername: string,
): OutgoingFriendshipRequest[] {
  return list.filter((r) => !sameUsername(r.addresseeUsername, addresseeUsername));
}

/** Dado el par de un FRIENDSHIP_REMOVED, devuelve el username del otro jugador. */
function otherParty(
  self: string | null,
  requesterUsername: string,
  addresseeUsername: string,
): string {
  return self !== null && sameUsername(requesterUsername, self)
    ? addresseeUsername
    : requesterUsername;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const SocialStore = signalStore(
  { providedIn: 'root' },

  withState<SocialState>(INITIAL),

  withComputed((store) => ({
    incomingCount: computed(() => store.incoming().length),
    friendsCount: computed(() => store.friends().length),
  })),

  withMethods((store) => {
    const api = inject(SocialApiService);
    const ws = inject(WebSocketService);
    const authStore = inject(AuthStore);
    const injector = inject(Injector);

    let wsSub: Subscription | null = null;
    let connectedSub: Subscription | null = null;
    let started = false;

    /** ¿El toast actual corresponde a este solicitante? (comparación case-insensitive). */
    function toastMatches(username: string): boolean {
      const current = store.incomingToast();
      return current !== null && sameUsername(current, username);
    }

    function applyEvent(event: SocialWsEvent): void {
      const self = authStore.username();
      switch (event.eventType) {
        case 'FRIEND_REQUEST_RECEIVED':
          patchState(store, {
            incoming: upsertIncoming(store.incoming(), event.payload.requesterUsername),
            incomingToast: event.payload.requesterUsername,
          });
          break;
        case 'FRIEND_REQUEST_ACCEPTED':
          patchState(store, {
            outgoing: removeOutgoing(store.outgoing(), event.payload.addresseeUsername),
            friends: upsertFriend(store.friends(), event.payload.addresseeUsername),
          });
          break;
        case 'FRIEND_REQUEST_DECLINED':
          patchState(store, {
            outgoing: removeOutgoing(store.outgoing(), event.payload.addresseeUsername),
          });
          break;
        case 'FRIEND_REQUEST_CANCELLED':
          patchState(store, {
            incoming: removeIncoming(store.incoming(), event.payload.requesterUsername),
            incomingToast: toastMatches(event.payload.requesterUsername)
              ? null
              : store.incomingToast(),
          });
          break;
        case 'FRIENDSHIP_REMOVED':
          patchState(store, {
            friends: removeFriendFrom(
              store.friends(),
              otherParty(
                self,
                event.payload.requesterUsername,
                event.payload.addresseeUsername,
              ),
            ),
          });
          break;
        default:
          // Eventos RESOURCE_INVITATION_* del mismo canal: fuera de alcance (FR-018).
          break;
      }
    }

    function subscribeWs(): void {
      if (wsSub) {
        return;
      }
      ws.connect();
      wsSub = ws.subscribe<SocialWsEvent>('/user/queue/social').subscribe((event) =>
        applyEvent(event),
      );
      // Re-bootstrap al (re)conectar para cerrar la brecha de eventos perdidos.
      connectedSub = ws.connected.subscribe((isConnected) => {
        if (isConnected && started) {
          bootstrap();
        }
      });
    }

    function unsubscribeWs(): void {
      wsSub?.unsubscribe();
      connectedSub?.unsubscribe();
      wsSub = null;
      connectedSub = null;
    }

    function syncSubscription(): void {
      const shouldSubscribe =
        authStore.isAuthenticated() && !authStore.isGuest() && authStore.username() !== null;
      if (shouldSubscribe) {
        subscribeWs();
      } else {
        unsubscribeWs();
        patchState(store, INITIAL);
      }
    }

    function bootstrap(): void {
      if (!authStore.isAuthenticated() || authStore.isGuest()) {
        return;
      }
      patchState(store, { loading: true, error: null });
      forkJoin({
        friends: api.listFriends(),
        incoming: api.listIncoming(),
        outgoing: api.listOutgoing(),
      }).subscribe({
        next: ({ friends, incoming, outgoing }) => {
          patchState(store, { friends, incoming, outgoing, loading: false });
        },
        error: (err: unknown) => {
          patchState(store, { loading: false, error: getErrorCopy('SOCIAL', err) });
        },
      });
    }

    return {
      /** Arranca el gating de la suscripción WS (idempotente). */
      start(): void {
        if (started) {
          return;
        }
        started = true;
        syncSubscription();
        effect(
          () => {
            authStore.isAuthenticated();
            authStore.isGuest();
            authStore.username();
            syncSubscription();
          },
          { injector },
        );
      },

      bootstrap,

      retry(): void {
        bootstrap();
      },

      clearActionError(): void {
        patchState(store, { actionError: null });
      },

      /** Descarta el toast de solicitud recibida (botón "Cerrar"). */
      dismissToast(): void {
        patchState(store, { incomingToast: null });
      },

      /** US1 — enviar solicitud de amistad por username. Devuelve true si se inició el envío. */
      sendRequest(rawUsername: string): boolean {
        const username = rawUsername.trim();
        patchState(store, { actionError: null });
        if (!username) {
          patchState(store, { actionError: 'Ingresá un nombre de usuario.' });
          return false;
        }
        if (username === authStore.username()) {
          patchState(store, { actionError: 'No podés enviarte una solicitud a vos mismo.' });
          return false;
        }
        api.sendRequest(username).subscribe({
          next: () => {
            patchState(store, { outgoing: upsertOutgoing(store.outgoing(), username) });
          },
          error: (err: unknown) => {
            patchState(store, { actionError: getErrorCopy('SOCIAL', err) });
          },
        });
        return true;
      },

      /** US2 — aceptar una solicitud recibida. */
      acceptRequest(username: string): void {
        patchState(store, {
          actionError: null,
          incomingToast: toastMatches(username) ? null : store.incomingToast(),
        });
        api.acceptRequest(username).subscribe({
          next: () => {
            patchState(store, {
              incoming: removeIncoming(store.incoming(), username),
              friends: upsertFriend(store.friends(), username),
            });
          },
          error: (err: unknown) => {
            patchState(store, { actionError: getErrorCopy('SOCIAL', err) });
          },
        });
      },

      /** US2 — rechazar una solicitud recibida. */
      declineRequest(username: string): void {
        patchState(store, {
          actionError: null,
          incomingToast: toastMatches(username) ? null : store.incomingToast(),
        });
        api.declineRequest(username).subscribe({
          next: () => {
            patchState(store, { incoming: removeIncoming(store.incoming(), username) });
          },
          error: (err: unknown) => {
            patchState(store, { actionError: getErrorCopy('SOCIAL', err) });
          },
        });
      },

      /** US4 — cancelar una solicitud enviada. */
      cancelRequest(username: string): void {
        patchState(store, { actionError: null });
        api.cancelRequest(username).subscribe({
          next: () => {
            patchState(store, { outgoing: removeOutgoing(store.outgoing(), username) });
          },
          error: (err: unknown) => {
            patchState(store, { actionError: getErrorCopy('SOCIAL', err) });
          },
        });
      },

      /** US3 — eliminar un amigo (quita optimista con rollback ante fallo). */
      removeFriend(username: string): void {
        patchState(store, { actionError: null });
        const previous = store.friends();
        patchState(store, { friends: removeFriendFrom(previous, username) });
        api.removeFriend(username).subscribe({
          error: (err: unknown) => {
            patchState(store, { friends: previous, actionError: getErrorCopy('SOCIAL', err) });
          },
        });
      },
    };
  }),
);
