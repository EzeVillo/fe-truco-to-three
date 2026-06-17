import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { SpectateScreenComponent } from './spectate-screen.component';
import { SpectateStateService } from '../../services/spectate-state.service';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { MatchState } from '../../../../core/models/match.models';
import type {
  GameWonPayload,
  EnvidoResolvedPayload,
  MatchEndedEvent,
  MatchWsEvent,
} from '../../../../features/match/models/match-ws-events';
import { MatchEventQueueService } from '../../../../features/match/services/match-event-queue.service';
import { BotsApiService } from '../../../lobby/services/bots-api.service';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import type { Card } from '../../../../core/models/match.models';

function makeMatchState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: 'match-1',
    status: 'IN_PROGRESS',
    viewerSeat: 'PLAYER_ONE',
    playerOneUsername: 'alice',
    playerTwoUsername: 'bob',
    gamesToPlay: 3,
    scorePlayerOne: 0,
    scorePlayerTwo: 0,
    gamesWonPlayerOne: 0,
    gamesWonPlayerTwo: 0,
    matchWinner: null,
    roundGame: null,
    lobby: null,
    ...overrides,
  };
}

const SAMPLE_CARD: Card = { suit: 'ESPADA', number: 1 };

/** Ronda mínima de bot-vs-bot: las manos boca arriba marcan la partida como propia. */
function makeBotVsBotRound(): MatchState['roundGame'] {
  return {
    status: 'IN_PROGRESS',
    currentTurn: 'alice',
    myCards: [],
    roundStatus: 'PLAYING',
    currentTrucoCall: null,
    currentEnvidoCall: null,
    winner: null,
    availableActions: [],
    playedHands: [],
    currentHand: { cardPlayerOne: null, cardPlayerTwo: null, mano: 'alice' },
    handPlayerOne: [SAMPLE_CARD],
    handPlayerTwo: [SAMPLE_CARD],
    actionDeadline: null,
    turnDurationMillis: null,
    actionDeadlineSeat: null,
  } as MatchState['roundGame'];
}

describe('SpectateScreenComponent', () => {
  let fixture: ComponentFixture<SpectateScreenComponent>;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let afterClosed$: Subject<void>;
  let dialogMock: { open: ReturnType<typeof vi.fn>; closeAll: ReturnType<typeof vi.fn> };
  let mockService: {
    matchState: ReturnType<typeof signal<MatchState | null>>;
    spectatorCount: ReturnType<typeof signal<number>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    serverClockOffsetMs: ReturnType<typeof signal<number>>;
    gameWon$: Subject<GameWonPayload>;
    envidoResolved$: Subject<EnvidoResolvedPayload>;
    matchEnded$: Subject<MatchEndedEvent>;
    matchEvent$: Subject<MatchWsEvent>;
    isProcessingDelay: ReturnType<typeof signal<boolean>>;
    init: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  let botsApiMock: { advanceBotVsBotMatch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    afterClosed$ = new Subject<void>();
    dialogMock = {
      open: vi.fn(() => ({
        afterClosed: () => afterClosed$.asObservable(),
      })),
      closeAll: vi.fn(),
    };

    mockService = {
      matchState: signal<MatchState | null>(null),
      spectatorCount: signal<number>(0),
      loading: signal<boolean>(true),
      error: signal<string | null>(null),
      serverClockOffsetMs: signal<number>(0),
      gameWon$: new Subject<GameWonPayload>(),
      envidoResolved$: new Subject<EnvidoResolvedPayload>(),
      matchEnded$: new Subject<MatchEndedEvent>(),
      matchEvent$: new Subject<MatchWsEvent>(),
      isProcessingDelay: signal<boolean>(false),
      init: vi.fn(),
      destroy: vi.fn(),
    };
    botsApiMock = { advanceBotVsBotMatch: vi.fn(() => of(undefined)) };

    TestBed.configureTestingModule({
      imports: [SpectateScreenComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: MatDialog, useValue: dialogMock },
        { provide: BotsApiService, useValue: botsApiMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'match-1' } } },
        },
      ],
    });

    // Override the component-level providers so the mocks are used instead of the real services
    TestBed.overrideComponent(SpectateScreenComponent, {
      set: {
        providers: [
          { provide: SpectateStateService, useValue: mockService },
          {
            provide: MatchEventQueueService,
            useValue: {
              resumeAck: vi.fn(),
              isProcessingDelay: signal(false),
              clear: vi.fn(),
              init: vi.fn(),
            },
          },
        ],
      },
    });

    fixture = TestBed.createComponent(SpectateScreenComponent);
    fixture.detectChanges();
  });

  it('llama init con el matchId del parámetro de ruta', () => {
    expect(mockService.init).toHaveBeenCalledWith('match-1');
  });

  it('muestra estado de carga mientras loading=true', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cargando');
    expect(fixture.debugElement.query(By.css('app-game-board'))).toBeNull();
  });

  it('muestra copy de error sin string crudo del backend', () => {
    mockService.loading.set(false);
    mockService.error.set('No pudiste entrar a mirar esta partida. Puede que ya haya terminado.');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No pudiste entrar a mirar esta partida',
    );
    expect(fixture.debugElement.query(By.css('app-game-board'))).toBeNull();
  });

  it('muestra el tablero cuando hay estado cargado', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState());
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-game-board'))).toBeTruthy();
  });

  it('no muestra el botón de avanzar en spectate con humanos (sin manos boca arriba)', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState());
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.spectate-screen__advance-btn'))).toBeNull();
  });

  it('muestra el botón de avanzar en partidas bot-vs-bot y dispara la request al hacer click', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState({ roundGame: makeBotVsBotRound() }));
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('.spectate-screen__advance-btn'));
    expect(btn).toBeTruthy();

    (btn.nativeElement as HTMLButtonElement).click();
    expect(botsApiMock.advanceBotVsBotMatch).toHaveBeenCalledWith('match-1');
  });

  it('sigue mostrando el botón aunque las manos queden null entre rondas (latch)', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState({ roundGame: makeBotVsBotRound() }));
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.spectate-screen__advance-btn'))).toBeTruthy();

    mockService.matchState.set(makeMatchState({ roundGame: null }));
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.spectate-screen__advance-btn'))).toBeTruthy();
  });

  it('deshabilita el botón mientras la cola procesa un delay', () => {
    mockService.loading.set(false);
    mockService.isProcessingDelay.set(true);
    mockService.matchState.set(makeMatchState({ roundGame: makeBotVsBotRound() }));
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('.spectate-screen__advance-btn'));
    expect((btn.nativeElement as HTMLButtonElement).disabled).toBe(true);
  });

  it('muestra copy de error mapeado si falla el avance', () => {
    botsApiMock.advanceBotVsBotMatch.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422 })),
    );
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState({ roundGame: makeBotVsBotRound() }));
    fixture.detectChanges();

    (
      fixture.debugElement.query(By.css('.spectate-screen__advance-btn'))
        .nativeElement as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No podés avanzar esta partida',
    );
  });

  it('no renderiza el banner de espectadores (vive en el header global)', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState());
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.spectate-screen__banner')).toBeNull();
    expect(el.querySelector('.spectate-screen__leave')).toBeNull();
    expect(el.textContent ?? '').not.toContain('Estás mirando');
  });

  it('al terminar el match abre el diálogo y al cerrarlo navega a /friends', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState());
    fixture.detectChanges();

    mockService.matchEnded$.next({
      winnerSeat: 'PLAYER_ONE',
      gamesWonPlayerOne: 2,
      gamesWonPlayerTwo: 1,
      reason: 'FINISHED',
    });

    expect(dialogMock.open).toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalledWith(['/friends']);

    afterClosed$.next();
    afterClosed$.complete();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/friends']);
  });

  it('muestra la respuesta de truco (¡No quiero!) sobre el asiento que respondió', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState());
    fixture.detectChanges();

    mockService.matchEvent$.next({
      eventType: 'TRUCO_RESPONDED',
      payload: { responderSeat: 'PLAYER_TWO', response: 'NO_QUIERO', call: 'TRUCO' },
    } as unknown as MatchWsEvent);
    fixture.detectChanges();

    expect(fixture.componentInstance.opponentCallText()).toBe('¡No quiero!');
    expect(fixture.componentInstance.selfCallText()).toBeNull();
  });

  it('muestra la respuesta de envido inferiendo el respondedor desde el último cantor', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState());
    fixture.detectChanges();

    mockService.matchEvent$.next({
      eventType: 'ENVIDO_CALLED',
      payload: { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' },
    } as unknown as MatchWsEvent);
    mockService.matchEvent$.next({
      eventType: 'ENVIDO_RESOLVED',
      payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' },
    } as unknown as MatchWsEvent);
    fixture.detectChanges();

    // Cantó PLAYER_ONE → responde PLAYER_TWO (bubble "opponent").
    expect(fixture.componentInstance.opponentCallText()).toBe('¡No quiero!');
  });

  it('muestra la respuesta de envido tras refresh, infiriendo el cantor desde el snapshot', () => {
    // Escenario refresh: el ENVIDO_CALLED ya pasó y no se reemite; el snapshot
    // trae el envido en curso con el cantor (currentEnvidoCaller). Sin hidratar
    // lastEnvidoCallerSeat, la respuesta no se mostraría al avanzar la jugada.
    mockService.loading.set(false);
    mockService.matchState.set(
      makeMatchState({
        roundGame: {
          ...makeBotVsBotRound(),
          roundStatus: 'ENVIDO_IN_PROGRESS',
          currentEnvidoCall: 'ENVIDO',
          currentEnvidoCaller: 'alice',
        } as MatchState['roundGame'],
      }),
    );
    fixture.detectChanges();

    // El canto se hidrata sobre el cantor (alice = PLAYER_ONE = bubble "self").
    expect(fixture.componentInstance.selfCallText()).toBe('¡Envido!');

    mockService.matchEvent$.next({
      eventType: 'ENVIDO_RESOLVED',
      payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' },
    } as unknown as MatchWsEvent);
    fixture.detectChanges();

    // Cantó PLAYER_ONE → responde PLAYER_TWO (bubble "opponent").
    expect(fixture.componentInstance.opponentCallText()).toBe('¡No quiero!');
  });

  it('llama destroy al destruir el componente', () => {
    fixture.destroy();
    expect(mockService.destroy).toHaveBeenCalled();
  });
});
