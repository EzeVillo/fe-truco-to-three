import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { SocialStore } from './social.store';
import { SocialApiService } from './social-api.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { WebSocketService } from '../../../core/services/websocket.service';
import type { SocialWsEvent } from '../../../core/models/ws.models';

function httpErr(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { message: 'BE-secret' } });
}

/** Forma completa de un amigo con disponibilidad por defecto (feature 025). */
function friend(
  friendUsername: string,
  overrides: Partial<{
    online: boolean;
    availability: 'AVAILABLE' | 'BUSY';
    busyReason: string | null;
  }> = {},
) {
  return {
    friendUsername,
    online: overrides.online ?? false,
    availability: overrides.availability ?? 'AVAILABLE',
    busyReason: overrides.busyReason ?? null,
  };
}

function setup(opts: { self?: string; guest?: boolean; authed?: boolean } = {}) {
  const events$ = new Subject<SocialWsEvent>();
  const connected$ = new Subject<boolean>();
  const username = signal<string | null>(opts.self ?? 'me');
  const isAuthenticated = signal<boolean>(opts.authed ?? true);
  const isGuest = signal<boolean>(opts.guest ?? false);

  const apiMock = {
    listFriends: vi.fn().mockReturnValue(of([])),
    listIncoming: vi.fn().mockReturnValue(of([])),
    listOutgoing: vi.fn().mockReturnValue(of([])),
    sendRequest: vi.fn().mockReturnValue(of(undefined)),
    acceptRequest: vi.fn().mockReturnValue(of(undefined)),
    declineRequest: vi.fn().mockReturnValue(of(undefined)),
    cancelRequest: vi.fn().mockReturnValue(of(undefined)),
    removeFriend: vi.fn().mockReturnValue(of(undefined)),
    // Invitaciones a partida (feature 025)
    createInvitation: vi.fn().mockReturnValue(of({ invitationId: 'inv-1', expiresAt: 1_000 })),
    acceptInvitation: vi.fn().mockReturnValue(of(undefined)),
    declineInvitation: vi.fn().mockReturnValue(of(undefined)),
    cancelInvitation: vi.fn().mockReturnValue(of(undefined)),
    listIncomingInvitations: vi.fn().mockReturnValue(of([])),
    listOutgoingInvitations: vi.fn().mockReturnValue(of([])),
  };
  const wsMock = {
    connect: vi.fn(),
    subscribe: vi.fn().mockReturnValue(events$.asObservable()),
    connected: connected$.asObservable(),
    disconnect: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      SocialStore,
      { provide: SocialApiService, useValue: apiMock },
      { provide: WebSocketService, useValue: wsMock },
      { provide: AuthStore, useValue: { username, isAuthenticated, isGuest } },
    ],
  });

  const store = TestBed.inject(SocialStore);
  return {
    store,
    api: apiMock,
    ws: wsMock,
    events$,
    connected$,
    username,
    isAuthenticated,
    isGuest,
  };
}

describe('SocialStore', () => {
  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  it('bootstrap(): carga las tres listas y baja loading', () => {
    const { store, api } = setup();
    api.listFriends.mockReturnValue(of([friend('ana')]));
    api.listIncoming.mockReturnValue(of([{ requesterUsername: 'leo' }]));
    store.bootstrap();
    expect(store.friends()).toEqual([friend('ana')]);
    expect(store.incoming()).toEqual([{ requesterUsername: 'leo' }]);
    expect(store.outgoing()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('bootstrap(): error → copy del front, nunca el message del BE', () => {
    const { store, api } = setup();
    api.listFriends.mockReturnValue(throwError(() => httpErr(500)));
    store.bootstrap();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('No pudimos conectarnos. Reintentá en unos segundos.');
    expect(store.error()).not.toContain('BE-secret');
  });

  // ─── Reconciliación WS ───────────────────────────────────────────────────────

  it('FRIEND_REQUEST_RECEIVED: agrega a incoming (idempotente)', () => {
    const { store, events$ } = setup();
    store.start();
    const ev: SocialWsEvent = {
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 1,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    };
    events$.next(ev);
    events$.next(ev);
    expect(store.incoming()).toEqual([{ requesterUsername: 'leo' }]);
  });

  it('FRIEND_REQUEST_RECEIVED: expone el solicitante en incomingToast', () => {
    const { store, events$ } = setup();
    store.start();
    expect(store.incomingToast()).toBeNull();
    events$.next({
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 1,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    expect(store.incomingToast()).toBe('leo');
  });

  it('dismissToast(): limpia el toast sin tocar incoming', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 1,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    store.dismissToast();
    expect(store.incomingToast()).toBeNull();
    expect(store.incoming()).toEqual([{ requesterUsername: 'leo' }]);
  });

  it('acceptRequest()/declineRequest(): cierran el toast del mismo solicitante', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 1,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    store.acceptRequest('leo');
    expect(store.incomingToast()).toBeNull();

    events$.next({
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 2,
      payload: { requesterUsername: 'ana', addresseeUsername: 'me' },
    });
    store.declineRequest('ana');
    expect(store.incomingToast()).toBeNull();
  });

  it('FRIEND_REQUEST_CANCELLED: cierra el toast del solicitante cancelado', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 1,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    expect(store.incomingToast()).toBe('leo');
    events$.next({
      eventType: 'FRIEND_REQUEST_CANCELLED',
      timestamp: 2,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    expect(store.incomingToast()).toBeNull();
    expect(store.incoming()).toEqual([]);
  });

  it('acceptRequest(): no cierra el toast si es de otro solicitante', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 1,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    store.acceptRequest('ana');
    expect(store.incomingToast()).toBe('leo');
  });

  it('FRIEND_REQUEST_ACCEPTED: mueve de outgoing a friends', () => {
    const { store, events$ } = setup();
    store.start();
    store.sendRequest('martina');
    expect(store.outgoing()).toEqual([{ addresseeUsername: 'martina' }]);
    events$.next({
      eventType: 'FRIEND_REQUEST_ACCEPTED',
      timestamp: 3,
      payload: { requesterUsername: 'me', addresseeUsername: 'martina' },
    });
    expect(store.outgoing()).toEqual([]);
    expect(store.friends()).toEqual([friend('martina')]);
  });

  it('FRIEND_REQUEST_ACCEPTED: quita de outgoing aunque difiera el casing del username', () => {
    const { store, events$ } = setup();
    store.start();
    store.sendRequest('Martina');
    expect(store.outgoing()).toEqual([{ addresseeUsername: 'Martina' }]);
    // El BE devuelve el casing canónico ('martina') en el evento.
    events$.next({
      eventType: 'FRIEND_REQUEST_ACCEPTED',
      timestamp: 3,
      payload: { requesterUsername: 'me', addresseeUsername: 'martina' },
    });
    expect(store.outgoing()).toEqual([]);
    expect(store.friends()).toEqual([friend('martina')]);
  });

  it('FRIEND_REQUEST_DECLINED: quita de outgoing', () => {
    const { store, events$ } = setup();
    store.start();
    store.sendRequest('martina');
    events$.next({
      eventType: 'FRIEND_REQUEST_DECLINED',
      timestamp: 4,
      payload: { requesterUsername: 'me', addresseeUsername: 'martina' },
    });
    expect(store.outgoing()).toEqual([]);
  });

  it('FRIEND_REQUEST_CANCELLED: quita de incoming', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 5,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    events$.next({
      eventType: 'FRIEND_REQUEST_CANCELLED',
      timestamp: 6,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    expect(store.incoming()).toEqual([]);
  });

  it('FRIENDSHIP_REMOVED: quita al otro jugador (resuelto por self)', () => {
    const { store, events$ } = setup();
    store.start();
    store.acceptRequest('ana');
    expect(store.friends()).toEqual([friend('ana')]);
    // self = 'me' es el addressee; el otro es 'ana'
    events$.next({
      eventType: 'FRIENDSHIP_REMOVED',
      timestamp: 8,
      payload: { requesterUsername: 'ana', addresseeUsername: 'me', removedByUsername: 'ana' },
    });
    expect(store.friends()).toEqual([]);
  });

  it('ignora eventos no-amistad (RESOURCE_INVITATION_*) sin romper el estado', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'RESOURCE_INVITATION_RECEIVED',
      timestamp: 9,
      payload: {},
    } as unknown as SocialWsEvent);
    expect(store.friends()).toEqual([]);
    expect(store.incoming()).toEqual([]);
    expect(store.outgoing()).toEqual([]);
  });

  // ─── Acciones ────────────────────────────────────────────────────────────────

  it('sendRequest(): vacío → no llama API y setea actionError', () => {
    const { store, api } = setup();
    expect(store.sendRequest('   ')).toBe(false);
    expect(store.actionError()).toBe('Ingresá un nombre de usuario.');
    expect(api.sendRequest).not.toHaveBeenCalled();
  });

  it('sendRequest(): a sí mismo → no llama API y setea actionError', () => {
    const { store, api } = setup({ self: 'me' });
    expect(store.sendRequest('me')).toBe(false);
    expect(store.actionError()).toBe('No podés enviarte una solicitud a vos mismo.');
    expect(api.sendRequest).not.toHaveBeenCalled();
  });

  it('sendRequest(): éxito → upsert en outgoing', () => {
    const { store } = setup();
    expect(store.sendRequest('martina')).toBe(true);
    expect(store.outgoing()).toEqual([{ addresseeUsername: 'martina' }]);
  });

  it('sendRequest(): error → actionError con copy del front', () => {
    const { store, api } = setup();
    api.sendRequest.mockReturnValue(throwError(() => httpErr(404)));
    store.sendRequest('martina');
    expect(store.actionError()).toBe('Ese usuario no existe o la solicitud ya no está disponible.');
    expect(store.outgoing()).toEqual([]);
  });

  it('acceptRequest(): éxito → incoming remove + friends upsert', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'FRIEND_REQUEST_RECEIVED',
      timestamp: 1,
      payload: { requesterUsername: 'leo', addresseeUsername: 'me' },
    });
    store.acceptRequest('leo');
    expect(store.incoming()).toEqual([]);
    expect(store.friends()).toEqual([friend('leo')]);
  });

  it('removeFriend(): optimista; rollback ante fallo', () => {
    const { store, api } = setup();
    store.acceptRequest('ana');
    expect(store.friends()).toEqual([friend('ana')]);
    api.removeFriend.mockReturnValue(throwError(() => httpErr(422)));
    store.removeFriend('ana');
    expect(store.friends()).toEqual([friend('ana')]);
    expect(store.actionError()).toBe(
      'No se pudo completar la acción: revisá el estado de la solicitud.',
    );
  });

  // ─── Invitaciones a partida + disponibilidad (feature 025) ───────────────────

  it('FRIEND_AVAILABILITY_STATE: hace merge de disponibilidad sobre los amigos', () => {
    const { store, api, events$ } = setup();
    api.listFriends.mockReturnValue(of([friend('ana'), friend('leo')]));
    store.bootstrap();
    store.start();
    events$.next({
      eventType: 'FRIEND_AVAILABILITY_STATE',
      timestamp: 1,
      payload: {
        friends: [
          { friendUsername: 'ana', online: true, availability: 'BUSY', busyReason: 'IN_MATCH' },
        ],
      },
    });
    expect(store.friends()).toEqual([
      friend('ana', { online: true, availability: 'BUSY', busyReason: 'IN_MATCH' }),
      friend('leo'),
    ]);
  });

  it('FRIEND_AVAILABILITY_CHANGED: actualiza un amigo; no-op si no está', () => {
    const { store, api, events$ } = setup();
    api.listFriends.mockReturnValue(of([friend('ana')]));
    store.bootstrap();
    store.start();
    events$.next({
      eventType: 'FRIEND_AVAILABILITY_CHANGED',
      timestamp: 1,
      payload: { friendUsername: 'ana', online: true, availability: 'BUSY', busyReason: 'IN_CUP' },
    });
    expect(store.friends()).toEqual([
      friend('ana', { online: true, availability: 'BUSY', busyReason: 'IN_CUP' }),
    ]);
    // Amigo inexistente → no rompe ni agrega.
    events$.next({
      eventType: 'FRIEND_AVAILABILITY_CHANGED',
      timestamp: 2,
      payload: {
        friendUsername: 'fantasma',
        online: true,
        availability: 'AVAILABLE',
        busyReason: null,
      },
    });
    expect(store.friends()).toHaveLength(1);
  });

  it('inviteFriend(): éxito → upsert en outgoingInvitations', () => {
    const { store, api } = setup();
    store.inviteFriend('martina', 'match-1');
    expect(api.createInvitation).toHaveBeenCalledWith({
      recipientUsername: 'martina',
      targetType: 'MATCH',
      targetId: 'match-1',
    });
    expect(store.outgoingInvitations()).toEqual([
      {
        invitationId: 'inv-1',
        recipientUsername: 'martina',
        targetType: 'MATCH',
        targetId: 'match-1',
        status: 'PENDING',
        expiresAt: 1_000,
      },
    ]);
  });

  it('inviteFriend(): error → inviteActionError con copy del front, sin BE-secret', () => {
    const { store, api } = setup();
    api.createInvitation.mockReturnValue(throwError(() => httpErr(422)));
    store.inviteFriend('martina', 'match-1');
    expect(store.inviteActionError()).toBe(
      'No se pudo completar la acción: revisá el estado de la solicitud.',
    );
    expect(store.inviteActionError()).not.toContain('BE-secret');
    expect(store.outgoingInvitations()).toEqual([]);
  });

  it('RESOURCE_INVITATION_RECEIVED (MATCH): setea el toast de invitación', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'RESOURCE_INVITATION_RECEIVED',
      timestamp: 1,
      payload: {
        invitationId: 'inv-9',
        senderUsername: 'leo',
        targetType: 'MATCH',
        targetId: 'match-9',
        expiresAt: 5_000,
      },
    });
    expect(store.incomingInvitationToast()).toEqual({
      invitationId: 'inv-9',
      senderUsername: 'leo',
      targetType: 'MATCH',
      targetId: 'match-9',
      status: 'PENDING',
      expiresAt: 5_000,
    });
  });

  it('RESOURCE_INVITATION_RECEIVED (LEAGUE): no muestra toast (fuera de alcance)', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'RESOURCE_INVITATION_RECEIVED',
      timestamp: 1,
      payload: {
        invitationId: 'inv-l',
        senderUsername: 'leo',
        targetType: 'LEAGUE',
        targetId: 'league-1',
        expiresAt: 5_000,
      },
    });
    expect(store.incomingInvitationToast()).toBeNull();
  });

  it('acceptInvitation(): limpia el toast y llama onJoined con el targetId', () => {
    const { store, api, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'RESOURCE_INVITATION_RECEIVED',
      timestamp: 1,
      payload: {
        invitationId: 'inv-9',
        senderUsername: 'leo',
        targetType: 'MATCH',
        targetId: 'match-9',
        expiresAt: 5_000,
      },
    });
    const joined = vi.fn();
    store.acceptInvitation('inv-9', joined);
    expect(api.acceptInvitation).toHaveBeenCalledWith('inv-9');
    expect(store.incomingInvitationToast()).toBeNull();
    expect(joined).toHaveBeenCalledWith('match-9');
  });

  it('cancelInvitation(): optimista; rollback ante fallo', () => {
    const { store, api } = setup();
    store.inviteFriend('martina', 'match-1');
    expect(store.outgoingInvitations()).toHaveLength(1);
    api.cancelInvitation.mockReturnValue(throwError(() => httpErr(422)));
    store.cancelInvitation('inv-1');
    expect(store.outgoingInvitations()).toHaveLength(1);
    expect(store.inviteActionError()).toBe(
      'No se pudo completar la acción: revisá el estado de la solicitud.',
    );
  });

  it('RESOURCE_INVITATION_ACCEPTED/EXPIRED: quita de outgoingInvitations', () => {
    const { store, events$ } = setup();
    store.start();
    store.inviteFriend('martina', 'match-1');
    events$.next({
      eventType: 'RESOURCE_INVITATION_ACCEPTED',
      timestamp: 2,
      payload: {
        invitationId: 'inv-1',
        recipientUsername: 'martina',
        targetType: 'MATCH',
        targetId: 'match-1',
      },
    });
    expect(store.outgoingInvitations()).toEqual([]);
  });

  it('RESOURCE_INVITATION_EXPIRED: limpia el toast recibido si coincide', () => {
    const { store, events$ } = setup();
    store.start();
    events$.next({
      eventType: 'RESOURCE_INVITATION_RECEIVED',
      timestamp: 1,
      payload: {
        invitationId: 'inv-9',
        senderUsername: 'leo',
        targetType: 'MATCH',
        targetId: 'match-9',
        expiresAt: 5_000,
      },
    });
    events$.next({
      eventType: 'RESOURCE_INVITATION_EXPIRED',
      timestamp: 2,
      payload: {
        invitationId: 'inv-9',
        senderUsername: 'leo',
        recipientUsername: 'me',
        targetType: 'MATCH',
        targetId: 'match-9',
      },
    });
    expect(store.incomingInvitationToast()).toBeNull();
  });

  it('bootstrap(): re-surface de invitación recibida pendiente como toast', () => {
    const { store, api } = setup();
    api.listIncomingInvitations.mockReturnValue(
      of([
        {
          invitationId: 'inv-7',
          senderUsername: 'leo',
          targetType: 'MATCH',
          targetId: 'match-7',
          status: 'PENDING',
          expiresAt: 9_000,
        },
      ]),
    );
    store.bootstrap();
    expect(store.incomingInvitationToast()?.invitationId).toBe('inv-7');
  });

  // ─── Gating ──────────────────────────────────────────────────────────────────

  it('no se suscribe al WS si el usuario es guest', () => {
    const { store, ws } = setup({ guest: true });
    store.start();
    expect(ws.subscribe).not.toHaveBeenCalled();
  });

  it('se suscribe al WS para usuario registrado', () => {
    const { store, ws } = setup();
    store.start();
    expect(ws.subscribe).toHaveBeenCalledWith('/user/queue/social');
  });
});
