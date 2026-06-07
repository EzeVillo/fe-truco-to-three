import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { SpectateScreenComponent } from './spectate-screen.component';
import { SpectateStateService } from '../../services/spectate-state.service';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { MatchState } from '../../../../core/models/match.models';
import type { GameWonPayload, EnvidoResolvedPayload, MatchEndedEvent, MatchWsEvent } from '../../../../features/match/models/match-ws-events';
import { MatchEventQueueService } from '../../../../features/match/services/match-event-queue.service';

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
    ...overrides,
  };
}

describe('SpectateScreenComponent', () => {
  let fixture: ComponentFixture<SpectateScreenComponent>;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
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
    init: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };

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
      init: vi.fn(),
      destroy: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [SpectateScreenComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
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
          { provide: MatchEventQueueService, useValue: { resumeAck: vi.fn(), isProcessingDelay: signal(false), clear: vi.fn(), init: vi.fn() } },
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

  it('muestra el banner "Estás mirando" con contador de espectadores', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState());
    mockService.spectatorCount.set(4);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Estás mirando');
    expect(text).toContain('4');
  });

  it('muestra resultado neutral cuando la partida termina (sin modal de jugador)', () => {
    mockService.loading.set(false);
    mockService.matchState.set(
      makeMatchState({ status: 'FINISHED', matchWinner: 'alice' }),
    );
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Ganó alice');
    expect(fixture.debugElement.query(By.css('app-game-board'))).toBeNull();
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

  it('llama destroy al destruir el componente', () => {
    fixture.destroy();
    expect(mockService.destroy).toHaveBeenCalled();
  });

  it('"Dejar de mirar" navega a /friends', () => {
    mockService.loading.set(false);
    mockService.matchState.set(makeMatchState());
    fixture.detectChanges();
    const leaveBtn = (fixture.nativeElement as HTMLElement).querySelector(
      '.spectate-screen__leave',
    ) as HTMLButtonElement | null;
    leaveBtn?.click();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/friends']);
  });
});
