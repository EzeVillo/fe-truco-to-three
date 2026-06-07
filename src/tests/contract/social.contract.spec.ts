/**
 * Contract test — Social / amistades (§7.5, §8.2, §9.5e, §9.6).
 *
 * Verifica que los DTOs REST y la unión `SocialWsEvent` estén en paridad con
 * `docs/CONTRATOS_API.md`. Si el contrato cambia y el TS no (o viceversa), el
 * `satisfies` falla en build time.
 */
import { describe, it, expect } from 'vitest';
import type {
  FriendSummary,
  IncomingFriendshipRequest,
  OutgoingFriendshipRequest,
  CreateFriendshipRequestPayload,
} from '../../app/core/models/social.models';
import type { SocialWsEvent } from '../../app/core/models/ws.models';

// ─── Paridad de DTOs REST (§8.2) ─────────────────────────────────────────────

const _friend = {
  friendUsername: '',
  online: false,
  availability: 'AVAILABLE',
  busyReason: null,
  spectatableMatch: null,
} satisfies Record<keyof FriendSummary, FriendSummary[keyof FriendSummary]>;

const _incoming = {
  requesterUsername: '',
} satisfies Record<
  keyof IncomingFriendshipRequest,
  IncomingFriendshipRequest[keyof IncomingFriendshipRequest]
>;

const _outgoing = {
  addresseeUsername: '',
} satisfies Record<
  keyof OutgoingFriendshipRequest,
  OutgoingFriendshipRequest[keyof OutgoingFriendshipRequest]
>;

const _createPayload = {
  username: '',
} satisfies Record<
  keyof CreateFriendshipRequestPayload,
  CreateFriendshipRequestPayload[keyof CreateFriendshipRequestPayload]
>;

void _friend;
void _incoming;
void _outgoing;
void _createPayload;

// ─── Paridad de eventos WS (§9.5e/§9.6) ──────────────────────────────────────

const SOCIAL_EVENT_TYPES: SocialWsEvent['eventType'][] = [
  'FRIEND_REQUEST_RECEIVED',
  'FRIEND_REQUEST_ACCEPTED',
  'FRIEND_REQUEST_DECLINED',
  'FRIEND_REQUEST_CANCELLED',
  'FRIENDSHIP_REMOVED',
];

describe('Contract: Social (§7.5/§8.2/§9.5e)', () => {
  it('FriendSummary expone { friendUsername, online, availability, busyReason, spectatableMatch } (§7.4.5)', () => {
    const dto: FriendSummary = {
      friendUsername: 'martina',
      online: true,
      availability: 'BUSY',
      busyReason: 'IN_MATCH',
      spectatableMatch: null,
    };
    expect(Object.keys(dto).sort()).toEqual([
      'availability',
      'busyReason',
      'friendUsername',
      'online',
      'spectatableMatch',
    ]);
  });

  it('IncomingFriendshipRequest expone exactamente { requesterUsername }', () => {
    const dto: IncomingFriendshipRequest = { requesterUsername: 'juancho' };
    expect(Object.keys(dto).sort()).toEqual(['requesterUsername']);
  });

  it('OutgoingFriendshipRequest expone exactamente { addresseeUsername }', () => {
    const dto: OutgoingFriendshipRequest = { addresseeUsername: 'martina' };
    expect(Object.keys(dto).sort()).toEqual(['addresseeUsername']);
  });

  it('SocialWsEvent cubre los 5 eventType de amistad (§9.5e)', () => {
    expect(SOCIAL_EVENT_TYPES).toHaveLength(5);
  });

  it('FRIENDSHIP_REMOVED incluye removedByUsername en el payload (§9.6)', () => {
    const event: SocialWsEvent = {
      eventType: 'FRIENDSHIP_REMOVED',
      timestamp: 0,
      payload: { requesterUsername: 'a', addresseeUsername: 'b', removedByUsername: 'a' },
    };
    expect(Object.keys(event.payload).sort()).toEqual([
      'addresseeUsername',
      'removedByUsername',
      'requesterUsername',
    ]);
  });
});
