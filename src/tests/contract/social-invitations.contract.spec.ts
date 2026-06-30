/**
 * Contract test — Invitaciones a partida + disponibilidad de amigos (feature 025).
 *
 * Verifica paridad entre los tipos TypeScript y `docs/CONTRATOS_API.md`
 * (§7.4.5, §7.4.7–7.4.13, §8.1–8.2, §9.5e/§9.6). Si el contrato cambia y el TS no
 * (o viceversa), los `satisfies` fallan en build time y los `expect` en runtime.
 */
import { describe, it, expect } from 'vitest';
import { readFullContract } from './_docs';
import type {
  CreateResourceInvitationPayload,
  CreateResourceInvitationResponse,
  FriendAvailability,
  FriendBusyReason,
  FriendSummary,
  IncomingResourceInvitation,
  OutgoingResourceInvitation,
  ResourceInvitationStatus,
  ResourceInvitationTargetType,
} from '../../app/core/models/social.models';
import type { SocialWsEvent } from '../../app/core/models/ws.models';

const CONTRACT = readFullContract();

// ─── Paridad de forma via `satisfies` (compile-time) ─────────────────────────

const _payloadCheck = {
  recipientUsername: '',
  targetType: 'MATCH',
  targetId: '',
} satisfies Record<
  keyof CreateResourceInvitationPayload,
  CreateResourceInvitationPayload[keyof CreateResourceInvitationPayload]
>;

const _createResCheck = {
  invitationId: '',
  expiresAt: 0,
} satisfies Record<
  keyof CreateResourceInvitationResponse,
  CreateResourceInvitationResponse[keyof CreateResourceInvitationResponse]
>;

const _incomingCheck = {
  invitationId: '',
  senderUsername: '',
  targetType: 'MATCH',
  targetId: '',
  status: 'PENDING',
  expiresAt: 0,
} satisfies Record<
  keyof IncomingResourceInvitation,
  IncomingResourceInvitation[keyof IncomingResourceInvitation]
>;

const _outgoingCheck = {
  invitationId: '',
  recipientUsername: '',
  targetType: 'MATCH',
  targetId: '',
  status: 'PENDING',
  expiresAt: 0,
} satisfies Record<
  keyof OutgoingResourceInvitation,
  OutgoingResourceInvitation[keyof OutgoingResourceInvitation]
>;

const _friendCheck = {
  friendUsername: '',
  online: false,
  availability: 'AVAILABLE',
  busyReason: null,
  spectatableMatch: null,
} satisfies Record<keyof FriendSummary, FriendSummary[keyof FriendSummary]>;

void _payloadCheck;
void _createResCheck;
void _incomingCheck;
void _outgoingCheck;
void _friendCheck;

// ─── Enums (runtime) contra el contrato ──────────────────────────────────────

describe('Contract: invitaciones a recurso §8.1–8.2', () => {
  it('targetType = {MATCH, LEAGUE, CUP}', () => {
    const all: ResourceInvitationTargetType[] = ['MATCH', 'LEAGUE', 'CUP'];
    expect(all).toHaveLength(3);
    expect(CONTRACT).toContain('`MATCH`, `LEAGUE`, `CUP`');
  });

  it('status = {PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED}', () => {
    const all: ResourceInvitationStatus[] = [
      'PENDING',
      'ACCEPTED',
      'DECLINED',
      'EXPIRED',
      'CANCELLED',
    ];
    expect(all).toHaveLength(5);
    expect(CONTRACT).toContain('`PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`');
  });
});

describe('Contract: disponibilidad de amigos §7.4.5', () => {
  it('availability = {AVAILABLE, BUSY}', () => {
    const all: FriendAvailability[] = ['AVAILABLE', 'BUSY'];
    expect(all).toHaveLength(2);
    expect(CONTRACT).toContain('`AVAILABLE` o `BUSY`');
  });

  it('busyReason cubre los motivos documentados', () => {
    const reasons: FriendBusyReason[] = [
      'IN_MATCH',
      'IN_LEAGUE',
      'IN_CUP',
      'OPEN_REMATCH',
      'IN_QUICK_QUEUE',
      'PENDING_INVITATION',
      'PENDING_FRIEND_REQUEST',
      'UNKNOWN',
    ];
    for (const r of reasons) {
      expect(CONTRACT).toContain(`\`${r}\``);
    }
  });
});

describe('Contract: eventos sociales nuevos §9.5e', () => {
  const eventTypes: SocialWsEvent['eventType'][] = [
    'RESOURCE_INVITATION_RECEIVED',
    'RESOURCE_INVITATION_ACCEPTED',
    'RESOURCE_INVITATION_DECLINED',
    'RESOURCE_INVITATION_CANCELLED',
    'RESOURCE_INVITATION_EXPIRED',
    'FRIEND_AVAILABILITY_STATE',
    'FRIEND_AVAILABILITY_CHANGED',
  ];

  it.each(eventTypes)('el contrato documenta el eventType %s', (eventType) => {
    expect(CONTRACT).toContain(eventType);
  });
});
