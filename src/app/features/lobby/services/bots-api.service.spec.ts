import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BotsApiService } from './bots-api.service';
import { environment } from '../../../../environments/environment';
import type { Bot } from '../../../core/models/bot.models';
import type { CreateBotMatchResponse } from '../../../core/models/match.models';

describe('BotsApiService', () => {
  let service: BotsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), BotsApiService],
    });
    service = TestBed.inject(BotsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getBots(): GET /bots y mapea el array de respuesta', () => {
    const bots: Bot[] = [{ botId: 'b1', name: 'El Mentiroso' }];
    let result: Bot[] | null = null;
    service.getBots().subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${environment.apiUrl}/bots`);
    expect(req.request.method).toBe('GET');
    req.flush(bots);

    expect(result).toEqual(bots);
  });

  it('createBotMatch(): POST /matches/bot con body y mapea la respuesta', () => {
    const response: CreateBotMatchResponse = { matchId: 'm-123' };
    let result: CreateBotMatchResponse | null = null;

    service.createBotMatch({ botId: 'b1', gamesToPlay: 2 }).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/matches/bot`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ botId: 'b1', gamesToPlay: 2 });
    req.flush(response);

    expect(result).toEqual(response);
  });
});
