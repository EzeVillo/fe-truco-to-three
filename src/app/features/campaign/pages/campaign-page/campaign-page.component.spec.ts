import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CampaignPageComponent } from './campaign-page.component';
import { CampaignApiService } from '../../services/campaign-api.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { AuthService } from '../../../../core/auth/auth.service';
import type {
  CampaignRankingEntry,
  CampaignResponse,
  CreateCampaignChallengeResponse,
} from '../../../../core/models/campaign.models';

function rankingEntry(overrides: Partial<CampaignRankingEntry>): CampaignRankingEntry {
  return {
    position: 1,
    participantId: 'x',
    displayName: 'Bot',
    points: 0,
    player: false,
    challengeable: false,
    record: null,
    ...overrides,
  };
}

function campaignResponse(overrides: Partial<CampaignResponse> = {}): CampaignResponse {
  return {
    playerPosition: 42,
    playerPoints: 14230,
    totalBots: 100,
    defeatedRivals: 58,
    topOneReached: false,
    allRivalsDefeated: false,
    pointsToNextPosition: 370,
    activeChallengeMatchId: null,
    ranking: [
      rankingEntry({
        position: 41,
        participantId: 'c41',
        displayName: 'Cacho Toledo',
        points: 14600,
        challengeable: true,
        record: { wins: 0, losses: 1 },
      }),
      rankingEntry({
        position: 42,
        participantId: 'p1',
        displayName: null,
        points: 14230,
        player: true,
      }),
    ],
    ...overrides,
  };
}

const CHALLENGE: CreateCampaignChallengeResponse = {
  matchId: 'm-99',
  rivalId: 'c41',
  rivalName: 'Cacho Toledo',
  rivalPosition: 41,
};

function setup(
  apiMock: Partial<CampaignApiService>,
  username: string | null = null,
  isGuest = false,
  authServiceMock: Partial<AuthService> = { logout: () => of(undefined) },
) {
  TestBed.configureTestingModule({
    imports: [CampaignPageComponent],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: CampaignApiService, useValue: apiMock },
      { provide: AuthStore, useValue: { username: signal(username), isGuest: signal(isGuest) } },
      { provide: AuthService, useValue: authServiceMock },
    ],
  });
}

describe('CampaignPageComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra loading mientras se obtiene la campaña', () => {
    const subj = new Subject<CampaignResponse>();
    setup({ getCampaign: () => subj.asObservable(), createChallenge: () => of(CHALLENGE) });

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(true);
    expect(fixture.debugElement.query(By.css('mat-spinner'))).toBeTruthy();
  });

  it('renderiza el ranking con el username del jugador en su fila', () => {
    setup(
      { getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) },
      'Juancho',
    );
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('.campaign__row'));
    expect(rows.length).toBe(2);

    const playerRow = fixture.debugElement.query(By.css('.campaign__row--player'));
    expect(playerRow).toBeTruthy();
    expect((playerRow.nativeElement as HTMLElement).textContent).toContain('Juancho');
  });

  it('cae a "Vos" en la fila del jugador cuando es invitado (sin username)', () => {
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const playerRow = fixture.debugElement.query(By.css('.campaign__row--player'));
    expect((playerRow.nativeElement as HTMLElement).textContent).toContain('Vos');
  });

  it('muestra el progreso del jugador (posición, puntos, rivales vencidos, faltante)', () => {
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('#42');
    expect(text).toContain('14230 pts');
    expect(text).toContain('58/100');
    expect(text).toContain('370');
  });

  it('oculta el faltante de puntos cuando pointsToNextPosition es null (#1)', () => {
    setup({
      getCampaign: () => of(campaignResponse({ pointsToNextPosition: null, topOneReached: true })),
      createChallenge: () => of(CHALLENGE),
    });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('para superar al siguiente rival');
    expect(text).toContain('Llegaste al #1');
  });

  it('solo el rival challengeable muestra el botón Desafiar', () => {
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const ctas = fixture.debugElement.queryAll(By.css('.campaign__row-cta'));
    expect(ctas.length).toBe(1);
  });

  it('desafiar antes del #1: POST sin botId y navega a /match/:matchId', () => {
    const createSpy = vi.fn().mockReturnValue(of(CHALLENGE));
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: createSpy });

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const rival = campaignResponse().ranking[0];
    fixture.componentInstance.onChallenge(rival);

    expect(createSpy).toHaveBeenCalledWith(undefined);
    expect(navSpy).toHaveBeenCalledWith(['/match', 'm-99']);
  });

  it('desafiar tras alcanzar el #1: POST con el botId del rival elegido', () => {
    const createSpy = vi.fn().mockReturnValue(of(CHALLENGE));
    setup({
      getCampaign: () =>
        of(
          campaignResponse({
            topOneReached: true,
            ranking: [
              rankingEntry({
                position: 7,
                participantId: 'c07',
                displayName: 'La Pescadora',
                challengeable: true,
              }),
              rankingEntry({ position: 1, participantId: 'p1', displayName: null, player: true }),
            ],
          }),
        ),
      createChallenge: createSpy,
    });

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.onChallenge(
      rankingEntry({ position: 7, participantId: 'c07', challengeable: true }),
    );

    expect(createSpy).toHaveBeenCalledWith('c07');
  });

  it('con desafío activo muestra el banner Continuar y bloquea los CTAs', () => {
    setup({
      getCampaign: () => of(campaignResponse({ activeChallengeMatchId: 'm-en-curso' })),
      createChallenge: () => of(CHALLENGE),
    });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.hasActiveChallenge()).toBe(true);
    expect(fixture.componentInstance.challengeBlocked()).toBe(true);

    const banner = fixture.debugElement.query(By.css('.campaign__active'));
    expect(banner).toBeTruthy();

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.continueChallenge();
    expect(navSpy).toHaveBeenCalledWith(['/match', 'm-en-curso']);
  });

  it('doble tap dispara una sola request', () => {
    const subj = new Subject<CreateCampaignChallengeResponse>();
    const createSpy = vi.fn().mockReturnValue(subj.asObservable());
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: createSpy });

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const rival = campaignResponse().ranking[0];
    fixture.componentInstance.onChallenge(rival);
    fixture.componentInstance.onChallenge(rival);

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.challengeBlocked()).toBe(true);
  });

  it('invitado: ve el aviso de "solo para registrados"', () => {
    setup(
      { getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) },
      null,
      true,
    );
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.campaign__guest-note'))).toBeTruthy();
  });

  it('registrado: no muestra el aviso de "solo para registrados"', () => {
    setup(
      { getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) },
      'Juancho',
      false,
    );
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.campaign__guest-note'))).toBeNull();
  });

  it('invitado: al desafiar no manda request al BE y abre el modal', () => {
    const createSpy = vi.fn().mockReturnValue(of(CHALLENGE));
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: createSpy }, null, true);

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as ReturnType<MatDialog['open']>);

    fixture.componentInstance.onChallenge(campaignResponse().ranking[0]);

    expect(createSpy).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.challengingId()).toBeNull();
  });

  it('invitado: confirmar el modal desloguea y navega a /register con returnUrl', () => {
    const logoutSpy = vi.fn().mockReturnValue(of(undefined));
    setup(
      { getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) },
      null,
      true,
      { logout: logoutSpy },
    );

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as ReturnType<MatDialog['open']>);

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.onChallenge(campaignResponse().ranking[0]);

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(navSpy).toHaveBeenCalledWith(['/register'], {
      queryParams: { returnUrl: '/lobby/campaign' },
    });
  });

  it('error 422 al desafiar: copy del catálogo (sin ApiError.message) y recarga la campaña', () => {
    const getSpy = vi.fn().mockReturnValue(of(campaignResponse()));
    const createSpy = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'ChallengeNotAllowedException', message: 'raw backend message' },
          }),
      ),
    );
    setup({ getCampaign: getSpy, createChallenge: createSpy });

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();
    expect(getSpy).toHaveBeenCalledTimes(1);

    fixture.componentInstance.onChallenge(campaignResponse().ranking[0]);
    fixture.detectChanges();

    const errorText = fixture.componentInstance.challengeError();
    expect(errorText).toBeTruthy();
    expect(errorText).not.toContain('raw backend message');
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.challengingId()).toBeNull();
  });

  it('error 5xx al desafiar: muestra copy y no recarga', () => {
    const getSpy = vi.fn().mockReturnValue(of(campaignResponse()));
    const createSpy = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    setup({ getCampaign: getSpy, createChallenge: createSpy });

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onChallenge(campaignResponse().ranking[0]);
    fixture.detectChanges();

    expect(fixture.componentInstance.challengeError()).toBe(
      'No pudimos crear el desafío. Reintentá en unos segundos.',
    );
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('error al cargar la campaña: muestra copy + Reintentar recarga', () => {
    const calls = [
      throwError(() => new HttpErrorResponse({ status: 500 })),
      of(campaignResponse()),
    ];
    const getSpy = vi.fn().mockImplementation(() => calls.shift());
    setup({ getCampaign: getSpy, createChallenge: () => of(CHALLENGE) });

    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.loadError()).toBe('No pudimos cargar la campaña. Reintentá.');

    fixture.componentInstance.retry();
    fixture.detectChanges();
    expect(fixture.componentInstance.loadError()).toBeNull();
    expect(fixture.componentInstance.campaign()?.ranking.length).toBe(2);
  });

  it('botón Volver navega a /lobby', () => {
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.goBack();

    expect(navSpy).toHaveBeenCalledWith('/lobby');
  });

  it('muestra el head-to-head del rival cuando hay record', () => {
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const record = fixture.debugElement.query(By.css('.campaign__row-record'));
    expect(record).toBeTruthy();
    expect((record.nativeElement as HTMLElement).textContent).toContain('G 0 · P 1');
    // wins(0) < losses(1) → rojo.
    expect((record.nativeElement as HTMLElement).classList).toContain(
      'campaign__row-record--behind',
    );
  });

  it('muestra 0-0 neutro para un rival que el BE devuelve sin record (record: null)', () => {
    const response = campaignResponse({
      ranking: [
        rankingEntry({
          position: 41,
          participantId: 'c41',
          displayName: 'Cacho Toledo',
          challengeable: true,
          record: null,
        }),
        rankingEntry({ position: 42, participantId: 'p1', displayName: null, player: true }),
      ],
    });
    setup({ getCampaign: () => of(response), createChallenge: () => of(CHALLENGE) });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const record = fixture.debugElement.query(By.css('.campaign__row-record'));
    expect(record).toBeTruthy();
    expect((record.nativeElement as HTMLElement).textContent).toContain('G 0 · P 0');
    // Empate / nunca jugado → sin clase de tono (gris por defecto).
    const classes = (record.nativeElement as HTMLElement).classList;
    expect(classes).not.toContain('campaign__row-record--ahead');
    expect(classes).not.toContain('campaign__row-record--behind');
  });

  it('pinta de verde el head-to-head cuando el jugador va arriba', () => {
    const response = campaignResponse({
      ranking: [
        rankingEntry({
          position: 41,
          participantId: 'c41',
          displayName: 'Cacho Toledo',
          challengeable: true,
          record: { wins: 3, losses: 1 },
        }),
        rankingEntry({ position: 42, participantId: 'p1', displayName: null, player: true }),
      ],
    });
    setup({ getCampaign: () => of(response), createChallenge: () => of(CHALLENGE) });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const record = fixture.debugElement.query(By.css('.campaign__row-record'));
    expect((record.nativeElement as HTMLElement).classList).toContain(
      'campaign__row-record--ahead',
    );
  });

  it('no muestra historial en la fila del propio jugador', () => {
    setup({ getCampaign: () => of(campaignResponse()), createChallenge: () => of(CHALLENGE) });
    const fixture = TestBed.createComponent(CampaignPageComponent);
    fixture.detectChanges();

    const playerRow = fixture.debugElement.query(By.css('.campaign__row--player'));
    expect(playerRow.query(By.css('.campaign__row-record'))).toBeNull();
  });
});
