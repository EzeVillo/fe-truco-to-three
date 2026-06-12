import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CampaignApiService } from './campaign-api.service';
import { environment } from '../../../../environments/environment';
import type {
  CampaignResponse,
  CreateCampaignChallengeResponse,
} from '../../../core/models/campaign.models';

const CAMPAIGN: CampaignResponse = {
  playerPosition: 42,
  playerPoints: 14230,
  totalBots: 100,
  defeatedRivals: 58,
  topOneReached: false,
  allRivalsDefeated: false,
  pointsToNextPosition: 370,
  activeChallengeMatchId: null,
  ranking: [
    {
      position: 41,
      participantId: 'c41',
      displayName: 'Cacho Toledo',
      points: 14600,
      player: false,
      challengeable: true,
      record: { wins: 0, losses: 1 },
    },
    {
      position: 42,
      participantId: 'p1',
      displayName: null,
      points: 14230,
      player: true,
      challengeable: false,
      record: null,
    },
  ],
};

describe('CampaignApiService', () => {
  let service: CampaignApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CampaignApiService],
    });
    service = TestBed.inject(CampaignApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getCampaign(): GET /campaign y devuelve la respuesta tal cual', () => {
    let result: CampaignResponse | null = null;
    service.getCampaign().subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${environment.apiUrl}/campaign`);
    expect(req.request.method).toBe('GET');
    req.flush(CAMPAIGN);

    expect(result).toEqual(CAMPAIGN);
  });

  it('createChallenge(): POST /campaign/challenges sin botId envía body vacío', () => {
    const response: CreateCampaignChallengeResponse = {
      matchId: 'm-99',
      rivalId: 'c41',
      rivalName: 'Cacho Toledo',
      rivalPosition: 41,
    };
    let result: CreateCampaignChallengeResponse | null = null;

    service.createChallenge().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/campaign/challenges`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('createChallenge(botId): POST /campaign/challenges con body {botId}', () => {
    const response: CreateCampaignChallengeResponse = {
      matchId: 'm-100',
      rivalId: 'c07',
      rivalName: 'La Pescadora',
      rivalPosition: 7,
    };
    let result: CreateCampaignChallengeResponse | null = null;

    service.createChallenge('c07').subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/campaign/challenges`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ botId: 'c07' });
    req.flush(response);

    expect(result).toEqual(response);
  });
});
