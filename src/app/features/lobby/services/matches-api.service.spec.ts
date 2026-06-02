import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatchesApiService } from './matches-api.service';
import { environment } from '../../../../environments/environment';
import type { QuickMatchResponse } from '../../../core/models/match.models';

describe('MatchesApiService', () => {
  let service: MatchesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), MatchesApiService],
    });
    service = TestBed.inject(MatchesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('enterQuickMatch(): POST /matches/quick con gamesToPlay', () => {
    const response: QuickMatchResponse = {
      status: 'SEARCHING',
      matchId: null,
      enqueuedAt: '2026-05-20T10:00:00Z',
    };
    let result: QuickMatchResponse | null = null;

    service.enterQuickMatch({ gamesToPlay: 3 }).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/matches/quick`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ gamesToPlay: 3 });
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('cancelQuickMatch(): DELETE /matches/quick sin body', () => {
    let completed = false;

    service.cancelQuickMatch().subscribe(() => (completed = true));

    const req = httpMock.expectOne(`${environment.apiUrl}/matches/quick`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
