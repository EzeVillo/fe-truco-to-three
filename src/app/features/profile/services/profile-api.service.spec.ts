import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { ProfileApiService } from './profile-api.service';
import type {
  AchievementsCatalogResponse,
  PlayerProfile,
} from '../../../core/models/profile.models';

describe('ProfileApiService', () => {
  let service: ProfileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ProfileApiService],
    });
    service = TestBed.inject(ProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getProfile(): GET /profile/{username}', () => {
    const profile: PlayerProfile = {
      achievements: [],
      stats: { matchesPlayed: 0, matchesWon: 0, matchesLost: 0, winRate: 0 },
    };
    let result: PlayerProfile | null = null;

    service.getProfile('Juancho').subscribe((res) => {
      result = res;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/profile/Juancho`);
    expect(req.request.method).toBe('GET');
    req.flush(profile);

    expect(result).toEqual(profile);
  });

  it('getAchievementsCatalog(): GET /achievements', () => {
    const catalog: AchievementsCatalogResponse = {
      achievements: [
        { achievementCode: 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO' },
        { achievementCode: 'FOLD_BEFORE_ANY_CARD_IS_PLAYED' },
      ],
    };
    let result: AchievementsCatalogResponse | null = null;

    service.getAchievementsCatalog().subscribe((res) => {
      result = res;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/achievements`);
    expect(req.request.method).toBe('GET');
    req.flush(catalog);

    expect(result).toEqual(catalog);
  });
});
