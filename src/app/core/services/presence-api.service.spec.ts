import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import type { UserPresenceResponse } from '../models/presence.models';
import { PresenceApiService } from './presence-api.service';

describe('PresenceApiService', () => {
  let service: PresenceApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PresenceApiService],
    });
    service = TestBed.inject(PresenceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getPresence(): GET /api/me/presence', () => {
    const response: UserPresenceResponse = {
      busy: true,
      match: { id: 'match-1', status: 'IN_PROGRESS' },
      league: null,
      cup: null,
      rematch: null,
    };
    let result: UserPresenceResponse | null = null;

    service.getPresence().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/me/presence`);
    expect(req.request.method).toBe('GET');
    req.flush(response);

    expect(result).toEqual(response);
  });
});
