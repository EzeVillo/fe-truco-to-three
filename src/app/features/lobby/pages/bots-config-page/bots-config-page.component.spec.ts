import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { BotsConfigPageComponent } from './bots-config-page.component';
import { BotsApiService } from '../../services/bots-api.service';
import { CampaignApiService } from '../../../campaign/services/campaign-api.service';
import type { Bot, BotCatalog } from '../../../../core/models/bot.models';
import type { CampaignResponse } from '../../../../core/models/campaign.models';
import type { CreateBotMatchResponse } from '../../../../core/models/match.models';

const BOTS: Bot[] = [
  { botId: 'b1', name: 'El Mentiroso' },
  { botId: 'b2', name: 'La Pescadora' },
  { botId: 'b3', name: 'El Temerario' },
];

/** Envuelve una lista de bots casuales en la forma de respuesta de GET /bots. */
function catalog(casual: Bot[], campaignUnlocked: Bot[] = []): BotCatalog {
  return { casual, campaignUnlocked };
}

function makeBots(n: number): Bot[] {
  return Array.from({ length: n }, (_, i) => ({
    botId: `bot-${i + 1}`,
    name: `Bot ${i + 1}`,
  }));
}

/** Respuesta mínima de campaña con el ranking dado (sin progreso relevante). */
function campaignResponse(ranking: CampaignResponse['ranking'] = []): CampaignResponse {
  return {
    playerPosition: 1,
    playerPoints: 0,
    totalBots: ranking.length,
    defeatedRivals: 0,
    topOneReached: false,
    allRivalsDefeated: false,
    pointsToNextPosition: null,
    activeChallengeMatchId: null,
    ranking,
  };
}

function setup(apiMock: Partial<BotsApiService>, campaignMock?: Partial<CampaignApiService>) {
  TestBed.configureTestingModule({
    imports: [BotsConfigPageComponent],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: BotsApiService, useValue: apiMock },
      {
        provide: CampaignApiService,
        useValue: campaignMock ?? { getCampaign: () => of(campaignResponse()) },
      },
    ],
  });
}

describe('BotsConfigPageComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('(a) muestra loading mientras se obtiene el catálogo', () => {
    const subj = new Subject<BotCatalog>();
    setup({ getBots: () => subj.asObservable(), createBotMatch: () => of({ matchId: 'x' }) });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.loadingCatalog()).toBe(true);
    expect(fixture.debugElement.query(By.css('mat-spinner'))).toBeTruthy();
  });

  it('(b) renderiza el catálogo cuando llega la respuesta', () => {
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.loadingCatalog()).toBe(false);
    const cards = fixture.debugElement.queryAll(By.css('app-bot-card'));
    expect(cards.length).toBe(BOTS.length);
  });

  it('(b2) muestra los bots de campaña desbloqueados en su propia sección', () => {
    const campaignBots: Bot[] = [{ botId: 'c42', name: 'Cacho Medina' }];
    setup({
      getBots: () => of(catalog(BOTS, campaignBots)),
      createBotMatch: () => of({ matchId: 'x' }),
    });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.campaignBots().length).toBe(1);
    expect(fixture.componentInstance.totalBots()).toBe(BOTS.length + 1);

    const section = fixture.debugElement.query(By.css('.bots-config__section'));
    expect(section).toBeTruthy();
    const allCards = fixture.debugElement.queryAll(By.css('app-bot-card'));
    expect(allCards.length).toBe(BOTS.length + 1);
  });

  it('(b4) los bots de campaña bloqueados aparecen deshabilitados y no son seleccionables', () => {
    const ranking: CampaignResponse['ranking'] = [
      {
        position: 1,
        participantId: 'locked-1',
        displayName: 'Cacho Bloqueado',
        points: 0,
        player: false,
        challengeable: false,
        record: null,
      },
      {
        position: 2,
        participantId: 'me',
        displayName: null,
        points: 0,
        player: true,
        challengeable: false,
        record: null,
      },
    ];
    setup(
      { getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) },
      { getCampaign: () => of(campaignResponse(ranking)) },
    );
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.lockedCampaignBots().length).toBe(1);
    // El bot bloqueado no cuenta como elegible.
    expect(fixture.componentInstance.totalBots()).toBe(BOTS.length);

    const section = fixture.debugElement.query(By.css('.bots-config__section'));
    expect(section).toBeTruthy();

    const lockedCard = fixture.debugElement.query(By.css('.bot-card--locked'));
    expect(lockedCard).toBeTruthy();
    expect((lockedCard.nativeElement as HTMLButtonElement).disabled).toBe(true);

    // Tap en el bloqueado no cambia la selección.
    (lockedCard.nativeElement as HTMLButtonElement).click();
    expect(fixture.componentInstance.selectedBotId()).toBeNull();
  });

  it('(b5) los bots ya desbloqueados no se duplican como bloqueados', () => {
    const campaignBots: Bot[] = [{ botId: 'c42', name: 'Cacho Medina' }];
    const ranking: CampaignResponse['ranking'] = [
      {
        position: 1,
        participantId: 'c42',
        displayName: 'Cacho Medina',
        points: 0,
        player: false,
        challengeable: true,
        record: { wins: 3, losses: 0 },
      },
    ];
    setup(
      {
        getBots: () => of(catalog(BOTS, campaignBots)),
        createBotMatch: () => of({ matchId: 'x' }),
      },
      { getCampaign: () => of(campaignResponse(ranking)) },
    );
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.lockedCampaignBots().length).toBe(0);
  });

  it('(b6) si falla la campaña el modo casual sigue funcionando sin bloqueados', () => {
    setup(
      { getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) },
      { getCampaign: () => throwError(() => new HttpErrorResponse({ status: 500 })) },
    );
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.lockedCampaignBots().length).toBe(0);
    expect(fixture.componentInstance.totalBots()).toBe(BOTS.length);
  });

  it('(b3) sin bots de campaña no renderiza la sección', () => {
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.bots-config__section'))).toBeNull();
  });

  it('(c) tap en una tarjeta mueve la selección (radio)', () => {
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSelectBot('b1');
    expect(fixture.componentInstance.selectedBotId()).toBe('b1');
    fixture.componentInstance.onSelectBot('b2');
    expect(fixture.componentInstance.selectedBotId()).toBe('b2');
  });

  it('(d) CTA deshabilitado sin selección; habilitado con selección', () => {
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.canCreate()).toBe(false);

    fixture.componentInstance.onSelectBot('b1');
    fixture.detectChanges();
    expect(fixture.componentInstance.canCreate()).toBe(true);
  });

  // T009 — US2: BEST_OF_3 → gamesToPlay: 3 (nunca 2)
  it('(e) POST dispara con body correcto (BEST_OF_3 → gamesToPlay: 3) y navega a /match/:matchId', async () => {
    const createSpy = vi.fn().mockReturnValue(of({ matchId: 'm-99' } as CreateBotMatchResponse));
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.onSelectBot('b2');
    fixture.componentInstance.onChangeFormat('BEST_OF_3');
    fixture.componentInstance.onCreate();

    // BEST_OF_3 → gamesToPlay: 3 (no 2)
    expect(createSpy).toHaveBeenCalledWith({ botId: 'b2', gamesToPlay: 3 });
    expect(navSpy).toHaveBeenCalledWith(['/match', 'm-99']);
  });

  // T009 — US2: BEST_OF_1 → gamesToPlay: 1
  it('BEST_OF_1 → gamesToPlay: 1', () => {
    const createSpy = vi.fn().mockReturnValue(of({ matchId: 'm-1' } as CreateBotMatchResponse));
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onChangeFormat('BEST_OF_1');
    fixture.componentInstance.onCreate();

    expect(createSpy).toHaveBeenCalledWith({ botId: 'b1', gamesToPlay: 1 });
  });

  // T009 — US2: BEST_OF_5 → gamesToPlay: 5
  it('BEST_OF_5 → gamesToPlay: 5', () => {
    const createSpy = vi.fn().mockReturnValue(of({ matchId: 'm-5' } as CreateBotMatchResponse));
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.onSelectBot('b3');
    fixture.componentInstance.onChangeFormat('BEST_OF_5');
    fixture.componentInstance.onCreate();

    expect(createSpy).toHaveBeenCalledWith({ botId: 'b3', gamesToPlay: 5 });
  });

  it('(f) error 404 al crear: recarga catálogo y resetea selección', () => {
    const getBotsSpy = vi.fn().mockReturnValue(of(catalog(BOTS)));
    const createSpy = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    setup({ getBots: getBotsSpy, createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    expect(getBotsSpy).toHaveBeenCalledTimes(1);

    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedBotId()).toBeNull();
    expect(getBotsSpy).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.createMatchError()).toBe(
      'El bot ya no está disponible, actualizá la lista.',
    );
  });

  it('(g) error 5xx muestra copy y mantiene la selección', () => {
    const createSpy = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedBotId()).toBe('b1');
    expect(fixture.componentInstance.createMatchError()).toBe(
      'No pudimos crear la partida. Reintentá en unos segundos.',
    );
    expect(fixture.componentInstance.creatingMatch()).toBe(false);
  });

  // T009 — US2: InvalidGamesToPlayException (422) no expone ApiError.message crudo
  it('error 422 InvalidGamesToPlayException: muestra copy del catálogo, no ApiError.message', () => {
    const createSpy = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'InvalidGamesToPlayException', message: 'raw backend message' },
          }),
      ),
    );
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.detectChanges();

    const errorText = fixture.componentInstance.createMatchError();
    expect(errorText).toBeTruthy();
    expect(errorText).not.toContain('raw backend message');
  });

  // T009 — US2: BotNotFoundException (404) no expone ApiError.message crudo
  it('error 404 BotNotFoundException: el copy del catálogo no contiene ApiError.message', () => {
    const createSpy = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { code: 'BotNotFoundException', message: 'raw backend message' },
          }),
      ),
    );
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.detectChanges();

    const errorText = fixture.componentInstance.createMatchError();
    expect(errorText).toBeTruthy();
    expect(errorText).not.toContain('raw backend message');
  });

  // T009 — US2: PlayerHasActiveMatchException (422) no expone ApiError.message crudo
  it('error 422 PlayerHasActiveMatchException: muestra copy del catálogo, no ApiError.message', () => {
    const createSpy = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'PlayerHasActiveMatchException', message: 'raw backend message' },
          }),
      ),
    );
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.detectChanges();

    const errorText = fixture.componentInstance.createMatchError();
    expect(errorText).toBeTruthy();
    expect(errorText).not.toContain('raw backend message');
  });

  // T009 — US2: PlayerHasOpenRematchSessionException (422) no expone ApiError.message crudo
  it('error 422 PlayerHasOpenRematchSessionException: copy correcto', () => {
    const createSpy = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'PlayerHasOpenRematchSessionException',
              message: 'raw backend message',
            },
          }),
      ),
    );
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.detectChanges();

    const errorText = fixture.componentInstance.createMatchError();
    expect(errorText).toBeTruthy();
    expect(errorText).not.toContain('raw backend message');
  });

  // T009 — US2: PlayerAlreadyInQueueException (422) no expone ApiError.message crudo
  it('error 422 PlayerAlreadyInQueueException: copy correcto', () => {
    const createSpy = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'PlayerAlreadyInQueueException', message: 'raw backend message' },
          }),
      ),
    );
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.detectChanges();

    const errorText = fixture.componentInstance.createMatchError();
    expect(errorText).toBeTruthy();
    expect(errorText).not.toContain('raw backend message');
  });

  it('(h) doble tap dispara una sola request', () => {
    const subj = new Subject<CreateBotMatchResponse>();
    const createSpy = vi.fn().mockReturnValue(subj.asObservable());
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: createSpy });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.componentInstance.onCreate();

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.creatingMatch()).toBe(true);
    expect(fixture.componentInstance.canCreate()).toBe(false);
  });

  it('error al cargar catálogo: muestra copy + opción Reintentar', () => {
    const calls = [throwError(() => new HttpErrorResponse({ status: 500 })), of(catalog(BOTS))];
    const getBotsSpy = vi.fn().mockImplementation(() => calls.shift());
    setup({ getBots: getBotsSpy, createBotMatch: () => of({ matchId: 'x' }) });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.catalogError()).toBe('No pudimos cargar los bots. Reintentá.');

    fixture.componentInstance.retry();
    fixture.detectChanges();
    expect(fixture.componentInstance.catalogError()).toBeNull();
    expect(fixture.componentInstance.totalBots()).toBe(BOTS.length);
  });

  it('estado vacío cuando el catálogo devuelve []', () => {
    setup({ getBots: () => of(catalog([])), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No hay bots disponibles');
    expect(fixture.componentInstance.canCreate()).toBe(false);
  });

  it('botón Volver navega a /lobby', () => {
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.goBack();

    expect(navSpy).toHaveBeenCalledWith('/lobby');
  });

  // T029 — US3: con catálogo de 30 bots, el scroll renderiza todas las tarjetas y
  // mantiene a la bottom bar como hermano siguiente (no como hijo) para que el
  // padding-bottom reservado pueda evitar el overlap.
  it('US3: con 30 bots renderiza la grilla completa y la bottom bar queda fuera del scroll', () => {
    setup({ getBots: () => of(catalog(makeBots(30))), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const scroll = root.querySelector('.bots-config__scroll') as HTMLElement;
    const bottomBar = root.querySelector('.bots-config__bottom-bar') as HTMLElement;
    const cards = root.querySelectorAll('app-bot-card');

    expect(cards.length).toBe(30);
    expect(scroll).toBeTruthy();
    expect(bottomBar).toBeTruthy();
    expect(scroll.contains(bottomBar)).toBe(false);
  });

  // US3: CTA "Crear partida" usa clase t3-btn--primary
  it('US3: CTA "Crear partida" tiene clase t3-btn--primary cuando está habilitado', () => {
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSelectBot('b1');
    fixture.detectChanges();

    const cta = fixture.debugElement.query(By.css('.bots-config__cta'));
    expect(cta).toBeTruthy();
    expect((cta.nativeElement as HTMLElement).classList.contains('t3-btn--primary')).toBe(true);
  });

  // US3: CTA deshabilitado cuando no hay selección
  it('US3: CTA tiene atributo disabled cuando canCreate() es false', () => {
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: () => of({ matchId: 'x' }) });
    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    // Sin selección → disabled
    const cta = fixture.debugElement.query(By.css('.bots-config__cta'));
    expect((cta.nativeElement as HTMLElement).hasAttribute('disabled')).toBe(true);
  });

  // US3: estado busy muestra spinner y aria-busy
  it('US3: estado busy muestra aria-busy="true" durante la creación', () => {
    const createSubj = new Subject<CreateBotMatchResponse>();
    setup({ getBots: () => of(catalog(BOTS)), createBotMatch: () => createSubj.asObservable() });

    const fixture = TestBed.createComponent(BotsConfigPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSelectBot('b1');
    fixture.componentInstance.onCreate();
    fixture.detectChanges();

    const cta = fixture.debugElement.query(By.css('.bots-config__cta'));
    expect((cta.nativeElement as HTMLElement).getAttribute('aria-busy')).toBe('true');
  });
});
