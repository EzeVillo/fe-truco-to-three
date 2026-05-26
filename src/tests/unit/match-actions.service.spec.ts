import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatchActionsService } from '../../app/features/match/services/match-actions.service';
import { environment } from '../../environments/environment';

describe('MatchActionsService', () => {
  let service: MatchActionsService;
  let httpMock: HttpTestingController;

  const matchId = 'test-match-id';
  const baseUrl = `${environment.apiUrl}/matches`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MatchActionsService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MatchActionsService);
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ─── §4.7 callTruco ─────────────────────────────────────────────────────────

  it('callTruco: POST al path correcto sin body', () => {
    service.callTruco(matchId).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/${matchId}/truco`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  // ─── §4.9 callEnvido ────────────────────────────────────────────────────────

  it('callEnvido: POST con body {call} correcto', () => {
    service.callEnvido(matchId, 'REAL_ENVIDO').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/${matchId}/envido`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ call: 'REAL_ENVIDO' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  // ─── §4.8 respondTruco ───────────────────────────────────────────────────────

  it('respondTruco: POST con body {response} correcto', () => {
    service.respondTruco(matchId, 'QUIERO_Y_ME_VOY_AL_MAZO').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/${matchId}/truco/respond`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ response: 'QUIERO_Y_ME_VOY_AL_MAZO' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  // ─── §4.10 respondEnvido ─────────────────────────────────────────────────────

  it('respondEnvido: POST con body {response} correcto', () => {
    service.respondEnvido(matchId, 'NO_QUIERO').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/${matchId}/envido/respond`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ response: 'NO_QUIERO' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  // ─── §4.11 fold ─────────────────────────────────────────────────────────────

  it('fold: POST al path correcto sin body', () => {
    service.fold(matchId).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/${matchId}/fold`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  // ─── §4.6 playCard ──────────────────────────────────────────────────────────

  it('playCard: POST con body {suit, number} correcto', () => {
    service.playCard(matchId, { suit: 'BASTO', number: 5 }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/${matchId}/play-card`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ suit: 'BASTO', number: 5 });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  // ─── Manejo de errores ──────────────────────────────────────────────────────

  it('ante 404 no propaga excepción y loguea console.warn', () => {
    service.callTruco(matchId).subscribe({
      next: () => {},
      error: () => {
        throw new Error('No debe propagar error');
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/${matchId}/truco`);
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });

    expect(console.warn).toHaveBeenCalled();
    const warnCall = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls[0] as unknown[];
    expect(warnCall[0]).toBe('[match-actions] Request failed:');
  });

  it('ante 500 no propaga excepción y loguea console.warn', () => {
    service.fold(matchId).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/${matchId}/fold`);
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(console.warn).toHaveBeenCalled();
  });
});
