import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChatApiService } from './chat-api.service';
import { environment } from '../../../../environments/environment';
import type { ChatView, SendMessageResponse } from '../../../core/models/chat.models';

describe('ChatApiService', () => {
  let service: ChatApiService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ChatApiService],
    });
    service = TestBed.inject(ChatApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getByParentMatch', () => {
    it('GET /chats/by-parent/MATCH/{matchId}', () => {
      const matchId = 'abc-123';
      const view: ChatView = {
        chatId: 'chat-1',
        parentType: 'MATCH',
        parentId: matchId,
        sendState: { canSendNow: true, nextMessageAllowedAt: null },
        messages: [],
      };

      let result: ChatView | null = null;
      service.getByParentMatch(matchId).subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${base}/chats/by-parent/MATCH/${matchId}`);
      expect(req.request.method).toBe('GET');
      req.flush(view);
      expect(result).toEqual(view);
    });

    it('encodeURIComponent en el matchId', () => {
      service.getByParentMatch('match/with/slashes').subscribe(() => undefined);
      const req = httpMock.expectOne(
        `${base}/chats/by-parent/MATCH/match%2Fwith%2Fslashes`,
      );
      req.flush({});
    });
  });

  describe('sendToParentMatch', () => {
    it('POST /chats/by-parent/MATCH/{matchId}/messages con body { content }', () => {
      const matchId = 'abc-123';
      const response: SendMessageResponse = {
        chatId: 'chat-1',
        sendState: { canSendNow: false, nextMessageAllowedAt: 1_700_000_002_000 },
      };

      let result: SendMessageResponse | null = null;
      service.sendToParentMatch(matchId, '¡Buena mano!').subscribe((r) => (result = r));

      const req = httpMock.expectOne(
        `${base}/chats/by-parent/MATCH/${matchId}/messages`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ content: '¡Buena mano!' });
      req.flush(response);
      expect(result).toEqual(response);
    });
  });
});
