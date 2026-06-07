import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SocialApiService } from './social-api.service';
import { environment } from '../../../../environments/environment';
import type {
  FriendSummary,
  IncomingFriendshipRequest,
  OutgoingFriendshipRequest,
} from '../../../core/models/social.models';

describe('SocialApiService', () => {
  let service: SocialApiService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SocialApiService],
    });
    service = TestBed.inject(SocialApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listFriends(): GET /social/friendships', () => {
    const friends: FriendSummary[] = [
      {
        friendUsername: 'martina',
        online: true,
        availability: 'AVAILABLE',
        busyReason: null,
        spectatableMatch: null,
      },
    ];
    let result: FriendSummary[] | null = null;
    service.listFriends().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${base}/social/friendships`);
    expect(req.request.method).toBe('GET');
    req.flush(friends);
    expect(result).toEqual(friends);
  });

  it('listIncoming(): GET /social/friendship-requests/incoming', () => {
    const incoming: IncomingFriendshipRequest[] = [{ requesterUsername: 'juancho' }];
    let result: IncomingFriendshipRequest[] | null = null;
    service.listIncoming().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${base}/social/friendship-requests/incoming`);
    expect(req.request.method).toBe('GET');
    req.flush(incoming);
    expect(result).toEqual(incoming);
  });

  it('listOutgoing(): GET /social/friendship-requests/outgoing', () => {
    const outgoing: OutgoingFriendshipRequest[] = [{ addresseeUsername: 'martina' }];
    let result: OutgoingFriendshipRequest[] | null = null;
    service.listOutgoing().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${base}/social/friendship-requests/outgoing`);
    expect(req.request.method).toBe('GET');
    req.flush(outgoing);
    expect(result).toEqual(outgoing);
  });

  it('sendRequest(): POST /social/friendship-requests con { username }', () => {
    service.sendRequest('martina').subscribe();
    const req = httpMock.expectOne(`${base}/social/friendship-requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'martina' });
    req.flush(null);
  });

  it('acceptRequest(): POST .../{username}/accept con username encodeado', () => {
    service.acceptRequest('a b').subscribe();
    const req = httpMock.expectOne(`${base}/social/friendship-requests/a%20b/accept`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('declineRequest(): POST .../{username}/decline', () => {
    service.declineRequest('juancho').subscribe();
    const req = httpMock.expectOne(`${base}/social/friendship-requests/juancho/decline`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('cancelRequest(): POST .../{username}/cancel', () => {
    service.cancelRequest('martina').subscribe();
    const req = httpMock.expectOne(`${base}/social/friendship-requests/martina/cancel`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('removeFriend(): DELETE /social/friendships/{username}', () => {
    service.removeFriend('martina').subscribe();
    const req = httpMock.expectOne(`${base}/social/friendships/martina`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ─── Invitaciones a partida (feature 025) ──────────────────────────────────

  it('createInvitation(): POST /social/invitations con el payload', () => {
    service
      .createInvitation({ recipientUsername: 'martina', targetType: 'MATCH', targetId: 'm1' })
      .subscribe();
    const req = httpMock.expectOne(`${base}/social/invitations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      recipientUsername: 'martina',
      targetType: 'MATCH',
      targetId: 'm1',
    });
    req.flush({ invitationId: 'inv-1', expiresAt: 1000 });
  });

  it('acceptInvitation(): POST /social/invitations/{id}/accept (id encodeado)', () => {
    service.acceptInvitation('a b').subscribe();
    const req = httpMock.expectOne(`${base}/social/invitations/a%20b/accept`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('declineInvitation(): POST /social/invitations/{id}/decline', () => {
    service.declineInvitation('inv-1').subscribe();
    const req = httpMock.expectOne(`${base}/social/invitations/inv-1/decline`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('cancelInvitation(): POST /social/invitations/{id}/cancel', () => {
    service.cancelInvitation('inv-1').subscribe();
    const req = httpMock.expectOne(`${base}/social/invitations/inv-1/cancel`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('listIncomingInvitations(): GET /social/invitations/incoming', () => {
    service.listIncomingInvitations().subscribe();
    const req = httpMock.expectOne(`${base}/social/invitations/incoming`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('listOutgoingInvitations(): GET /social/invitations/outgoing', () => {
    service.listOutgoingInvitations().subscribe();
    const req = httpMock.expectOne(`${base}/social/invitations/outgoing`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
