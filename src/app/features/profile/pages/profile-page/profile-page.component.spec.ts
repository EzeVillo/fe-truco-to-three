import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { ProfilePageComponent } from './profile-page.component';
import { AuthStore } from '../../../../core/auth/auth.store';
import { SessionStorageService } from '../../../../core/auth/session-storage.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { ProfileNotificationService } from '../../services/profile-notification.service';
import type {
  AchievementsCatalogResponse,
  PlayerProfile,
  UnlockedAchievement,
} from '../../../../core/models/profile.models';

const RETRUCO = 'WIN_GAME_THREE_ZERO_VIA_ACCEPTED_RETRUCO';
const FOLD = 'FOLD_BEFORE_ANY_CARD_IS_PLAYED';
const ANCHO = 'WIN_HAND_UNCONTESTED_WITH_ANCHO_DE_ESPADA';

const FULL_CATALOG: AchievementsCatalogResponse = {
  achievements: [
    { achievementCode: RETRUCO },
    { achievementCode: FOLD },
    { achievementCode: ANCHO },
  ],
};

const PROFILE_WITH_ACHIEVEMENTS: PlayerProfile = {
  achievements: [
    {
      achievementCode: RETRUCO,
      unlockedAt: 1772768158123,
      matchId: 'match-1',
      gameNumber: 1,
    },
  ],
  stats: { matchesPlayed: 3, matchesWon: 2, matchesLost: 1, winRate: 67 },
};

interface SetupOptions {
  catalog?: AchievementsCatalogResponse | HttpErrorResponse;
  unlockedSubject?: Subject<UnlockedAchievement>;
  username?: string;
}

function setup(profileOrError: PlayerProfile | HttpErrorResponse, options: SetupOptions = {}) {
  const fakeStorage: Record<string, string> = {};
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => fakeStorage[key] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    fakeStorage[key] = value;
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
    delete fakeStorage[key];
  });
  const achievementUnlocked$ = options.unlockedSubject ?? new Subject<UnlockedAchievement>();
  const catalog = options.catalog ?? FULL_CATALOG;
  TestBed.configureTestingModule({
    imports: [ProfilePageComponent],
    providers: [
      provideRouter([]),
      SessionStorageService,
      AuthStore,
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ username: options.username ?? 'juancho' }) },
        },
      },
      {
        provide: ProfileApiService,
        useValue: {
          getProfile: vi.fn().mockReturnValue(
            profileOrError instanceof HttpErrorResponse
              ? throwError(() => profileOrError)
              : of(profileOrError),
          ),
          getAchievementsCatalog: vi.fn().mockReturnValue(
            catalog instanceof HttpErrorResponse ? throwError(() => catalog) : of(catalog),
          ),
        },
      },
      {
        provide: ProfileNotificationService,
        useValue: { achievementUnlocked$: achievementUnlocked$ },
      },
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

  it('muestra todos los logros del catálogo: desbloqueados y bloqueados', () => {
    setup(PROFILE_WITH_ACHIEVEMENTS);

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    const views = fixture.componentInstance.achievements();
    expect(views).toHaveLength(3);
    expect(views.filter((v) => v.unlocked)).toHaveLength(1);
    expect(views.filter((v) => !v.unlocked)).toHaveLength(2);
  });

  it('con perfil sin desbloqueos muestra el catálogo completo en bloqueado', () => {
    setup({ achievements: [], stats: { matchesPlayed: 0, matchesWon: 0, matchesLost: 0, winRate: 0 } });

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    const views = fixture.componentInstance.achievements();
    expect(views).toHaveLength(3);
    expect(views.every((v) => !v.unlocked)).toBe(true);
  });

  it('ordena desbloqueados primero y muestra fecha solo en ellos; bloqueados con candado', () => {
    setup(PROFILE_WITH_ACHIEVEMENTS);

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    const views = fixture.componentInstance.achievements();
    expect(views[0].unlocked).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('time')).toHaveLength(1);
    expect(el.querySelectorAll('.profile-page__achievement--locked')).toHaveLength(2);
    expect(el.querySelectorAll('mat-icon')).toHaveLength(2);
  });

  it('degrada a solo-desbloqueados cuando el catálogo falla', () => {
    setup(PROFILE_WITH_ACHIEVEMENTS, { catalog: new HttpErrorResponse({ status: 500 }) });

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    const views = fixture.componentInstance.achievements();
    expect(views).toHaveLength(1);
    expect(views[0].unlocked).toBe(true);
    expect(fixture.componentInstance.error()).toBeNull();
  });

  it('renderiza estado vacio cuando no hay catálogo ni desbloqueos', () => {
    setup(
      { achievements: [], stats: { matchesPlayed: 0, matchesWon: 0, matchesLost: 0, winRate: 0 } },
      { catalog: { achievements: [] } },
    );

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

  it('desbloquea un logro en tiempo real y lo reubica entre los desbloqueados', () => {
    const unlocked$ = new Subject<UnlockedAchievement>();
    setup(PROFILE_WITH_ACHIEVEMENTS, { unlockedSubject: unlocked$ });

    TestBed.inject(AuthStore).setSession({
      playerId: 'p1',
      username: 'juancho',
      accessToken: 'jwt',
      refreshToken: 'refresh',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 2592000,
    });

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    unlocked$.next({ achievementCode: FOLD, unlockedAt: 9999999999999, matchId: 'm', gameNumber: 2 });
    fixture.detectChanges();

    const views = fixture.componentInstance.achievements();
    const fold = views.find((v) => v.code === FOLD);
    expect(fold?.unlocked).toBe(true);
    expect(views[0].code).toBe(FOLD);
    expect(views.filter((v) => v.code === FOLD)).toHaveLength(1);
  });

  it('ignora el evento de logro cuando se ve el perfil de otro usuario', () => {
    const unlocked$ = new Subject<UnlockedAchievement>();
    setup(PROFILE_WITH_ACHIEVEMENTS, { unlockedSubject: unlocked$, username: 'otro' });

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    const before = fixture.componentInstance.achievements();

    unlocked$.next({ achievementCode: FOLD, unlockedAt: 9999999999999, matchId: 'm', gameNumber: 2 });
    fixture.detectChanges();

    expect(fixture.componentInstance.achievements()).toEqual(before);
  });
});
