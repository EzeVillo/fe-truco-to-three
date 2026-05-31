import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { throwError } from 'rxjs';
import { ProfilePageComponent } from './profile-page.component';
import { AuthStore } from '../../../../core/auth/auth.store';
import { SessionStorageService } from '../../../../core/auth/session-storage.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { ProfileNotificationService } from '../../services/profile-notification.service';
import type { PlayerProfile } from '../../../../core/models/profile.models';

const PROFILE_WITH_ACHIEVEMENTS: PlayerProfile = {
  achievements: [
    {
      achievementCode: 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO',
      unlockedAt: 1772768158123,
      matchId: 'match-1',
      gameNumber: 1,
    },
  ],
  stats: { matchesPlayed: 3, matchesWon: 2, matchesLost: 1, winRate: 67 },
};

function setup(profileOrError: PlayerProfile | HttpErrorResponse) {
  const fakeStorage: Record<string, string> = {};
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => fakeStorage[key] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    fakeStorage[key] = value;
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
    delete fakeStorage[key];
  });
  const achievementUnlocked$ = new Subject<never>();
  TestBed.configureTestingModule({
    imports: [ProfilePageComponent],
    providers: [
      provideRouter([]),
      SessionStorageService,
      AuthStore,
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ username: 'juancho' }) } },
      },
      {
        provide: ProfileApiService,
        useValue: {
          getProfile: vi.fn().mockReturnValue(
            profileOrError instanceof HttpErrorResponse
              ? throwError(() => profileOrError)
              : of(profileOrError),
          ),
        },
      },
      { provide: ProfileNotificationService, useValue: { achievementUnlocked$: achievementUnlocked$ } },
    ],
  });
}

describe('ProfilePageComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza estadisticas y logros desbloqueados', () => {
    setup(PROFILE_WITH_ACHIEVEMENTS);

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('juancho');
    expect(text).toContain('3');
    expect(text).toContain('67%');
    expect(text).toContain('One Shot I');
    expect(text).not.toContain('Partida match-1');
    expect(text).not.toContain('Game 1');
  });

  it('renderiza estado vacio cuando no hay logros', () => {
    setup({
      achievements: [],
      stats: { matchesPlayed: 0, matchesWon: 0, matchesLost: 0, winRate: 0 },
    });

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Todavia no hay logros desbloqueados');
  });

  it('muestra copy de perfil no encontrado ante 404', () => {
    setup(new HttpErrorResponse({ status: 404 }));

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No encontramos ese perfil.');
    expect(text).toContain('Reintentar');
  });

  it('muestra copy vacio ante 401 manejado por interceptores', () => {
    setup(new HttpErrorResponse({ status: 401 }));

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe('');
  });

  it('muestra copy de red ante status 0', () => {
    setup(new HttpErrorResponse({ status: 0 }));

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No pudimos cargar el perfil. Reintent');
  });
});
