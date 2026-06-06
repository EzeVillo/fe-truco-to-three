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
  IncomingResourceInvitation,
  OutgoingFriendshipRequest,
  OutgoingResourceInvitation,
} from '../../../core/models/social.models';
import type {
  FriendAvailabilityDelta,
  FriendAvailabilitySnapshotItem,
  SocialWsEvent,
} from '../../../core/models/ws.models';

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
  // ─── Invitaciones a partida (feature 025) ──────────────────────────────────
  /** Invitaciones a partida enviadas pendientes (US3). */
  outgoingInvitations: OutgoingResourceInvitation[];
  /** Invitación a partida recibida a mostrar como toast (D5). null = sin toast. */
  incomingInvitationToast: IncomingResourceInvitation | null;
  /** Error de la última acción de invitar/cancelar/aceptar/rechazar (copy del front). */
  inviteActionError: string | null;
}

const INITIAL: SocialState = {
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,
  error: null,
  actionError: null,
  incomingToast: null,
  outgoingInvitations: [],
  incomingInvitationToast: null,
  inviteActionError: null,
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
  // Al agregar un amigo recién aceptado no conocemos su disponibilidad; usamos
  // defaults conservadores que el snapshot/delta de disponibilidad reconcilia.
  return list.some((f) => sameUsername(f.friendUsername, friendUsername))
    ? list
    : [...list, { friendUsername, online: false, availability: 'AVAILABLE', busyReason: null }];
}

/** Merge de disponibilidad sobre un amigo existente (no-op si no está en la lista). */
function mergeAvailability(
  list: FriendSummary[],
  item: FriendAvailabilitySnapshotItem | FriendAvailabilityDelta,
): FriendSummary[] {
  return list.map((f) =>
    sameUsername(f.friendUsername, item.friendUsername)
      ? {
          ...f,
          online: item.online,
          availability: item.availability,
          busyReason: item.busyReason,
        }
      : f,
  );
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

// ─── Helpers de invitaciones a partida (idempotentes por invitationId) ───────

function upsertOutgoingInvitation(
  list: OutgoingResourceInvitation[],
  invitation: OutgoingResourceInvitation,
): OutgoingResourceInvitation[] {
  return list.some((i) => i.invitationId === invitation.invitationId)
    ? list.map((i) => (i.invitationId === invitation.invitationId ? invitation : i))
    : [...list, invitation];
}

function removeOutgoingInvitation(
  list: OutgoingResourceInvitation[],
  invitationId: string,
): OutgoingResourceInvitation[] {
  return list.filter((i) => i.invitationId !== invitationId);
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
              otherParty(self, event.payload.requesterUsername, event.payload.addresseeUsername),
            ),
          });
          break;
        // ─── Disponibilidad de amigos (feature 025) ────────────────────────
        case 'FRIEND_AVAILABILITY_STATE': {
          let next = store.friends();
          for (const item of event.payload.friends) {
            next = mergeAvailability(next, item);
          }
          patchState(store, { friends: next });
          break;
        }
        case 'FRIEND_AVAILABILITY_CHANGED':
          patchState(store, {
            friends: mergeAvailability(store.friends(), event.payload),
          });
          break;
        // ─── Invitaciones a partida (feature 025) ──────────────────────────
        case 'RESOURCE_INVITATION_RECEIVED':
          // Sólo invitaciones a partida; liga/copa fuera de alcance.
          if (event.payload.targetType === 'MATCH') {
            patchState(store, {
              incomingInvitationToast: {
                invitationId: event.payload.invitationId,
                senderUsername: event.payload.senderUsername,
                targetType: event.payload.targetType,
                targetId: event.payload.targetId,
                status: 'PENDING',
                expiresAt: event.payload.expiresAt,
              },
            });
          }
          break;
        case 'RESOURCE_INVITATION_ACCEPTED':
        case 'RESOURCE_INVITATION_DECLINED':
          patchState(store, {
            outgoingInvitations: removeOutgoingInvitation(
              store.outgoingInvitations(),
              event.payload.invitationId,
            ),
          });
          break;
        case 'RESOURCE_INVITATION_CANCELLED':
          patchState(store, {
            outgoingInvitations: removeOutgoingInvitation(
              store.outgoingInvitations(),
              event.payload.invitationId,
            ),
            incomingInvitationToast:
              store.incomingInvitationToast()?.invitationId === event.payload.invitationId
                ? null
                : store.incomingInvitationToast(),
          });
          break;
        case 'RESOURCE_INVITATION_EXPIRED':
          patchState(store, {
            outgoingInvitations: removeOutgoingInvitation(
              store.outgoingInvitations(),
              event.payload.invitationId,
            ),
            incomingInvitationToast:
              store.incomingInvitationToast()?.invitationId === event.payload.invitationId
                ? null
                : store.incomingInvitationToast(),
          });
          break;
        default:
          break;
      }
    }

    function subscribeWs(): void {
      if (wsSub) {
        return;
      }
      ws.connect();
      wsSub = ws
        .subscribe<SocialWsEvent>('/user/queue/social')
        .subscribe((event) => applyEvent(event));
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
        outgoingInvitations: api.listOutgoingInvitations(),
        incomingInvitations: api.listIncomingInvitations(),
      }).subscribe({
        next: ({ friends, incoming, outgoing, outgoingInvitations, incomingInvitations }) => {
          // Re-surface (D5): si hay una invitación a partida pendiente recibida y no
          // hay toast vigente, mostrarla como toast (sin lista persistente).
          const pendingIncoming = incomingInvitations.find(
            (i) => i.status === 'PENDING' && i.targetType === 'MATCH',
          );
          patchState(store, {
            friends,
            incoming,
            outgoing,
            outgoingInvitations: outgoingInvitations.filter(
              (i) => i.status === 'PENDING' && i.targetType === 'MATCH',
            ),
            incomingInvitationToast: store.incomingInvitationToast() ?? pendingIncoming ?? null,
            loading: false,
          });
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

      // ─── Invitaciones a partida (feature 025) ────────────────────────────

      clearInviteActionError(): void {
        patchState(store, { inviteActionError: null });
      },

      /** US1/US1b — invitar a un amigo a la partida `targetId`. */
      inviteFriend(recipientUsername: string, targetId: string): void {
        patchState(store, { inviteActionError: null });
        api.createInvitation({ recipientUsername, targetType: 'MATCH', targetId }).subscribe({
          next: ({ invitationId, expiresAt }) => {
            patchState(store, {
              outgoingInvitations: upsertOutgoingInvitation(store.outgoingInvitations(), {
                invitationId,
                recipientUsername,
                targetType: 'MATCH',
                targetId,
                status: 'PENDING',
                expiresAt,
              }),
            });
          },
          error: (err: unknown) => {
            patchState(store, { inviteActionError: getErrorCopy('SOCIAL', err) });
          },
        });
      },

      /**
       * US2 — aceptar una invitación recibida. El BE hace el join; la navegación
       * la maneja la presencia. Limpia el toast de forma optimista. `onJoined` se
       * invoca tras el 204 como fallback de navegación.
       */
      acceptInvitation(invitationId: string, onJoined?: (targetId: string) => void): void {
        const toast = store.incomingInvitationToast();
        const targetId = toast?.targetId ?? null;
        patchState(store, {
          inviteActionError: null,
          incomingInvitationToast: toast?.invitationId === invitationId ? null : toast,
        });
        api.acceptInvitation(invitationId).subscribe({
          next: () => {
            if (targetId !== null) {
              onJoined?.(targetId);
            }
          },
          error: (err: unknown) => {
            patchState(store, { inviteActionError: getErrorCopy('SOCIAL', err) });
          },
        });
      },

      /** US2 — rechazar una invitación recibida (descarta el toast). */
      declineInvitation(invitationId: string): void {
        const toast = store.incomingInvitationToast();
        patchState(store, {
          inviteActionError: null,
          incomingInvitationToast: toast?.invitationId === invitationId ? null : toast,
        });
        api.declineInvitation(invitationId).subscribe({
          error: (err: unknown) => {
            patchState(store, { inviteActionError: getErrorCopy('SOCIAL', err) });
          },
        });
      },

      /** US3 — cancelar una invitación enviada (optimista con rollback). */
      cancelInvitation(invitationId: string): void {
        patchState(store, { inviteActionError: null });
        const previous = store.outgoingInvitations();
        patchState(store, {
          outgoingInvitations: removeOutgoingInvitation(previous, invitationId),
        });
        api.cancelInvitation(invitationId).subscribe({
          error: (err: unknown) => {
            patchState(store, {
              outgoingInvitations: previous,
              inviteActionError: getErrorCopy('SOCIAL', err),
            });
          },
        });
      },

      /** Descarta el toast de invitación recibida sin rechazarla. */
      dismissInvitationToast(): void {
        patchState(store, { incomingInvitationToast: null });
      },
    };
  }),
);
