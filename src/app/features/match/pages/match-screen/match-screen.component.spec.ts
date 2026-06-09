import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatchScreenComponent } from './match-screen.component';
import { MatchStateService } from '../../services/match-state.service';
import { MatchEventQueueService } from '../../services/match-event-queue.service';
import { RematchStateService } from '../../services/rematch-state.service';
import { MatchCallAudioService } from '../../services/match-call-audio.service';
import { BackgroundMusicService } from '../../services/background-music.service';
import { GameWonDialogComponent } from '../../components/game-won-dialog/game-won-dialog.component';
import { EnvidoResultDialogComponent } from '../../components/envido-result-dialog/envido-result-dialog.component';
import {
  RematchDialogComponent,
  type RematchDialogResult,
} from '../../components/rematch-dialog/rematch-dialog.component';
import { mockMatchViewerPlayerOne } from '../../mocks/match-state.mocks';
import type { RematchSession } from '../../models/rematch.models';

function makeParamMap(params: Record<string, string>) {
  return {
    get: (key: string) => params[key] ?? null,
    has: (key: string) => key in params,
    getAll: (key: string) => (params[key] ? [params[key]] : []),
    keys: Object.keys(params),
  };
}

describe('MatchScreenComponent', () => {
  let fixture: ComponentFixture<MatchScreenComponent>;
  let matchStateService: MatchStateService;
  let matchCallAudioService: { playForEvent: ReturnType<typeof vi.fn> };
  let backgroundMusicService: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
  let paramMapSubject: BehaviorSubject<ReturnType<typeof makeParamMap>>;

  function setupComponent(params: Record<string, string> = {}): void {
    paramMapSubject = new BehaviorSubject(makeParamMap(params));
    matchCallAudioService = {
      playForEvent: vi.fn(),
    };
    backgroundMusicService = {
      start: vi.fn(),
      stop: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [
        MatchScreenComponent,
        MatDialogModule,
        GameWonDialogComponent,
        EnvidoResultDialogComponent,
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatchCallAudioService, useValue: matchCallAudioService },
        { provide: BackgroundMusicService, useValue: backgroundMusicService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
            snapshot: {
              paramMap: makeParamMap(params),
              queryParamMap: { get: () => null },
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(MatchScreenComponent);
    matchStateService = fixture.componentInstance.matchStateService;
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets matchId from route params', () => {
    setupComponent({ matchId: 'test-match-123' });
    expect(fixture.componentInstance.matchId()).toBe('test-match-123');
  });

  it('shows spinner while loading', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(true);
    matchStateService.state.set(null);
    matchStateService.error.set(false);
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('mat-progress-spinner');
    expect(spinner).toBeTruthy();
  });

  it('shows error state when loading fails', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(null);
    matchStateService.error.set(true);
    fixture.detectChanges();

    const errorText = fixture.nativeElement.querySelector('.match-screen__error-text');
    expect(errorText).toBeTruthy();
    expect(errorText.textContent).toContain('No pudimos cargar');
  });

  it('renders game board when state is loaded', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(mockMatchViewerPlayerOne);
    matchStateService.error.set(false);
    fixture.detectChanges();

    const gameBoard = fixture.nativeElement.querySelector('app-game-board');
    expect(gameBoard).toBeTruthy();
  });

  it('no arranca la musica en sala de espera', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set({
      ...mockMatchViewerPlayerOne,
      status: 'WAITING_FOR_PLAYERS',
      playerTwoUsername: null,
      roundGame: null,
    });
    matchStateService.error.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-waiting-room')).toBeTruthy();
    expect(backgroundMusicService.start).not.toHaveBeenCalled();
  });

  it('arranca la musica solo cuando la partida pasa a IN_PROGRESS', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set({
      ...mockMatchViewerPlayerOne,
      status: 'READY',
      roundGame: null,
    });
    matchStateService.error.set(false);
    fixture.detectChanges();

    expect(backgroundMusicService.start).not.toHaveBeenCalled();

    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    expect(backgroundMusicService.start).toHaveBeenCalled();
  });

  it('calls init on MatchStateService with matchId', () => {
    setupComponent({ matchId: 'test-match' });
    expect(matchStateService.loading()).toBe(true);
  });

  it('navigates to lobby on goToLobby', () => {
    setupComponent({ matchId: 'test-match' });
    const routerSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
    fixture.componentInstance.goToLobby();
    expect(routerSpy).toHaveBeenCalledWith(['/lobby']);
  });

  it('selfCallText y opponentCallText inician en null', () => {
    setupComponent({ matchId: 'test-match' });
    expect(fixture.componentInstance.selfCallText()).toBeNull();
    expect(fixture.componentInstance.opponentCallText()).toBeNull();
  });

  it('actualiza opponentCallText ante TRUCO_CALLED del rival', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const event = {
      matchId: 'test-match',
      eventType: 'TRUCO_CALLED',
      timestamp: Date.now(),
      payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
      stateVersion: 2,
    } as const;
    matchStateService.matchEvent$.next(event);

    expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Truco!');
    expect(fixture.componentInstance.selfCallText()).toBeNull();
    expect(matchCallAudioService.playForEvent).toHaveBeenCalledWith(event);
  });

  it('actualiza selfCallText ante ENVIDO_CALLED del jugador propio', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const event = {
      matchId: 'test-match',
      eventType: 'ENVIDO_CALLED',
      timestamp: Date.now(),
      payload: { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' },
      stateVersion: 2,
    } as const;
    matchStateService.matchEvent$.next(event);

    expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Envido!');
    expect(fixture.componentInstance.opponentCallText()).toBeNull();
    expect(matchCallAudioService.playForEvent).toHaveBeenCalledWith(event);
  });

  it('actualiza opponentCallText y reproduce audio ante TRUCO_RESPONDED del rival', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const event = {
      matchId: 'test-match',
      eventType: 'TRUCO_RESPONDED',
      timestamp: Date.now(),
      payload: { responderSeat: 'PLAYER_TWO', response: 'QUIERO', call: 'TRUCO' },
      stateVersion: 2,
    } as const;
    matchStateService.matchEvent$.next(event);

    expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Quiero!');
    expect(fixture.componentInstance.selfCallText()).toBeNull();
    expect(matchCallAudioService.playForEvent).toHaveBeenCalledWith(event);
  });

  it('actualiza selfCallText y reproduce audio ante FOLDED propio', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const event = {
      matchId: 'test-match',
      eventType: 'FOLDED',
      timestamp: Date.now(),
      payload: { seat: 'PLAYER_ONE' },
      stateVersion: 2,
    } as const;
    matchStateService.matchEvent$.next(event);

    expect(fixture.componentInstance.selfCallText()).toBe('Me voy al mazo');
    expect(fixture.componentInstance.opponentCallText()).toBeNull();
    expect(matchCallAudioService.playForEvent).toHaveBeenCalledWith(event);
  });

  it('mantiene el call text visible si el servicio de audio falla', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.state.set(mockMatchViewerPlayerOne);
    matchCallAudioService.playForEvent.mockImplementation(() => {
      throw new Error('audio failed');
    });
    fixture.detectChanges();

    matchStateService.matchEvent$.next({
      matchId: 'test-match',
      eventType: 'TRUCO_CALLED',
      timestamp: Date.now(),
      payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
      stateVersion: 2,
    });

    expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Truco!');
    expect(fixture.componentInstance.selfCallText()).toBeNull();
  });

  describe('auto-limpieza de aceptaciones (US2)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('limpia opponentCallText de aceptaci\u00f3n despu\u00e9s de 3 segundos', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'TRUCO_RESPONDED',
        timestamp: Date.now(),
        payload: { responderSeat: 'PLAYER_TWO', response: 'QUIERO', call: 'TRUCO' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Quiero!');

      vi.advanceTimersByTime(3000);
      fixture.detectChanges();

      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('cancela timer previo al llegar un nuevo evento (solo un call text visible)', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      // Emit QUIERO for opponent — starts timer
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'TRUCO_RESPONDED',
        timestamp: Date.now(),
        payload: { responderSeat: 'PLAYER_TWO', response: 'QUIERO', call: 'TRUCO' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Quiero!');

      // Before timer fires, emit a new call from the local player
      vi.advanceTimersByTime(1500);
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'TRUCO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_ONE', call: 'RETRUCO' },
        stateVersion: 3,
      });

      fixture.detectChanges();
      // Previous text cleared, new text on the other side
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Retruco!');

      // Original 3s timer should have been cancelled; new text remains
      vi.advanceTimersByTime(1500);
      fixture.detectChanges();
      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Retruco!');
    });

    it('no afecta textos de no-aceptaci\u00f3n con timer', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'TRUCO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_TWO', call: 'TRUCO' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Truco!');

      vi.advanceTimersByTime(5000);
      fixture.detectChanges();

      // Non-acceptance text should still be there (no auto-cleanup)
      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Truco!');
    });

    it('reemplaza texto previo del otro lado al llegar un nuevo evento', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      // Local player calls envido
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' },
        stateVersion: 2,
      });
      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Envido!');
      expect(fixture.componentInstance.opponentCallText()).toBeNull();

      // Opponent responds "quiero" — previous text on left must clear, new on right
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'TRUCO_RESPONDED',
        timestamp: Date.now(),
        payload: { responderSeat: 'PLAYER_TWO', response: 'QUIERO', call: 'TRUCO' },
        stateVersion: 3,
      });
      expect(fixture.componentInstance.selfCallText()).toBeNull();
      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Quiero!');
    });
  });

  describe('reset de call texts (US3)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function setCallText(): void {
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'TRUCO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat: 'PLAYER_ONE', call: 'TRUCO' },
        stateVersion: 2,
      });
    }

    it('limpia call texts ante ROUND_STARTED', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      setCallText();
      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Truco!');

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ROUND_STARTED',
        timestamp: Date.now(),
        payload: { roundNumber: 2, manoSeat: 'PLAYER_ONE' },
        stateVersion: 4,
      });

      expect(fixture.componentInstance.selfCallText()).toBeNull();
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('limpia call texts ante GAME_STARTED', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      setCallText();
      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Truco!');

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'GAME_STARTED',
        timestamp: Date.now(),
        payload: { gameNumber: 2 },
        stateVersion: 4,
      });

      expect(fixture.componentInstance.selfCallText()).toBeNull();
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('limpia call texts ante MATCH_FINISHED', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      setCallText();
      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Truco!');

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'MATCH_FINISHED',
        timestamp: Date.now(),
        payload: { winnerSeat: 'PLAYER_ONE', gamesWonPlayerOne: 1, gamesWonPlayerTwo: 0 },
        stateVersion: 4,
      });

      expect(fixture.componentInstance.selfCallText()).toBeNull();
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('limpia call texts ante MATCH_ABANDONED', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      setCallText();
      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Truco!');

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'MATCH_ABANDONED',
        timestamp: Date.now(),
        payload: {
          winnerSeat: 'PLAYER_ONE',
          abandonerSeat: 'PLAYER_TWO',
          gamesWonPlayerOne: 0,
          gamesWonPlayerTwo: 0,
        },
        stateVersion: 4,
      });

      expect(fixture.componentInstance.selfCallText()).toBeNull();
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('limpia call texts ante MATCH_FORFEITED', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      setCallText();
      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Truco!');

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'MATCH_FORFEITED',
        timestamp: Date.now(),
        payload: {
          winnerSeat: 'PLAYER_ONE',
          loserSeat: 'PLAYER_TWO',
          gamesWonPlayerOne: 0,
          gamesWonPlayerTwo: 0,
        },
        stateVersion: 4,
      });

      expect(fixture.componentInstance.selfCallText()).toBeNull();
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('cancela timers pendientes al resetear', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'TRUCO_RESPONDED',
        timestamp: Date.now(),
        payload: { responderSeat: 'PLAYER_TWO', response: 'QUIERO', call: 'TRUCO' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Quiero!');

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ROUND_STARTED',
        timestamp: Date.now(),
        payload: { roundNumber: 2, manoSeat: 'PLAYER_ONE' },
        stateVersion: 3,
      });

      expect(fixture.componentInstance.opponentCallText()).toBeNull();

      // Timer should have been cancelled; no re-appearance after 3s
      vi.advanceTimersByTime(3000);
      fixture.detectChanges();
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });
  });

  describe('ENVIDO_RESOLVED (US3/T021)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Helper: emite ENVIDO_CALLED para registrar el cantor antes del RESOLVED.
    const emitEnvidoCalled = (callerSeat: 'PLAYER_ONE' | 'PLAYER_TWO') => {
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_CALLED',
        timestamp: Date.now(),
        payload: { callerSeat, call: 'ENVIDO' },
        stateVersion: 1,
      });
    };

    it('muestra selfCallText para QUIERO cuando el jugador local respondi\u00f3 (rival cant\u00f3)', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      // Rival (PLAYER_TWO) cant\u00f3 envido; el local (PLAYER_ONE) responde.
      emitEnvidoCalled('PLAYER_TWO');
      matchCallAudioService.playForEvent.mockClear();
      const event = {
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      } as const;
      matchStateService.matchEvent$.next(event);

      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Quiero!');
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
      expect(matchCallAudioService.playForEvent).toHaveBeenCalledWith(event);
    });

    it('muestra opponentCallText para QUIERO cuando el rival respondi\u00f3 (local cant\u00f3)', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      // Local (PLAYER_ONE) cant\u00f3 envido; el rival (PLAYER_TWO) responde.
      emitEnvidoCalled('PLAYER_ONE');
      matchCallAudioService.playForEvent.mockClear();
      const event = {
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      } as const;
      matchStateService.matchEvent$.next(event);

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Quiero!');
      expect(fixture.componentInstance.selfCallText()).toBeNull();
      expect(matchCallAudioService.playForEvent).toHaveBeenCalledWith(event);
    });

    it('muestra selfCallText para NO_QUIERO cuando el jugador local rechaz\u00f3', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      emitEnvidoCalled('PLAYER_TWO');
      matchCallAudioService.playForEvent.mockClear();
      const event = {
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_TWO' },
        stateVersion: 2,
      } as const;
      matchStateService.matchEvent$.next(event);

      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1No quiero!');
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
      expect(matchCallAudioService.playForEvent).toHaveBeenCalledWith(event);
    });

    it('muestra opponentCallText para NO_QUIERO cuando el rival rechaz\u00f3', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      emitEnvidoCalled('PLAYER_ONE');
      matchCallAudioService.playForEvent.mockClear();
      const event = {
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      } as const;
      matchStateService.matchEvent$.next(event);

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1No quiero!');
      expect(fixture.componentInstance.selfCallText()).toBeNull();
      expect(matchCallAudioService.playForEvent).toHaveBeenCalledWith(event);
    });

    it('auto-limpia selfCallText de QUIERO a los 3 segundos', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      emitEnvidoCalled('PLAYER_TWO');
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Quiero!');

      vi.advanceTimersByTime(3000);
      fixture.detectChanges();

      expect(fixture.componentInstance.selfCallText()).toBeNull();
    });

    it('auto-limpia opponentCallText de NO_QUIERO a los 3 segundos', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      emitEnvidoCalled('PLAYER_ONE');
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1No quiero!');

      vi.advanceTimersByTime(3000);
      fixture.detectChanges();

      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('limpia opponentCallText de NO_QUIERO ante ROUND_STARTED', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      emitEnvidoCalled('PLAYER_ONE');
      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1No quiero!');

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ROUND_STARTED',
        timestamp: Date.now(),
        payload: { roundNumber: 2, manoSeat: 'PLAYER_ONE' },
        stateVersion: 3,
      });

      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });
  });

  it('opens GameWonDialog on gameWon$ when local player wins', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');

    matchStateService.gameWon$.next({ winnerSeat: 'PLAYER_ONE' });

    expect(dialogSpy).toHaveBeenCalledOnce();
    const call = dialogSpy.mock.calls[0];
    expect(call[0]).toBe(GameWonDialogComponent);
    expect(call[1]?.['data']).toMatchObject({
      matchFinished: false,
      localWonMatch: true,
    });
  });

  it('opens GameWonDialog on gameWon$ when local player loses', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');

    matchStateService.gameWon$.next({ winnerSeat: 'PLAYER_TWO' });

    expect(dialogSpy).toHaveBeenCalledOnce();
    const call = dialogSpy.mock.calls[0];
    expect(call[0]).toBe(GameWonDialogComponent);
    expect(call[1]?.['data']).toMatchObject({
      matchFinished: false,
      localWonMatch: false,
    });
  });

  it('opens EnvidoResultDialog on envidoResolved$', () => {
    vi.useFakeTimers();
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');

    matchStateService.envidoResolved$.next({
      response: 'QUIERO',
      winnerSeat: 'PLAYER_ONE',
      pointsMano: 28,
      pointsPie: 25,
    });

    // El modal se abre con delay para dejar ver el "¡Quiero!".
    expect(dialogSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1200);
    vi.useRealTimers();

    expect(dialogSpy).toHaveBeenCalledOnce();
    const call = dialogSpy.mock.calls[0];
    expect(call[0]).toBe(EnvidoResultDialogComponent);
    expect(call[1]?.['data']).toMatchObject({
      manoName: 'juancho',
      manoScore: 28,
      pieName: 'martina',
      pieScore: 25,
      won: true,
    });
  });

  it('no abre EnvidoResultDialog cuando el envido fue rechazado (NO_QUIERO)', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');

    matchStateService.envidoResolved$.next({
      response: 'NO_QUIERO',
      winnerSeat: 'PLAYER_ONE',
    });

    expect(dialogSpy).not.toHaveBeenCalled();
  });

  describe('US011 — ACK gating de la cola de eventos', () => {
    function mockDialogRef(afterClosedSubject: Subject<void>) {
      return {
        afterClosed: () => afterClosedSubject.asObservable(),
        close: () => afterClosedSubject.next(),
      };
    }

    it('ENVIDO_RESOLVED QUIERO: abre modal (tras delay) y llama resumeAck recién en afterClosed', () => {
      vi.useFakeTimers();
      setupComponent({ matchId: 'test-match' });
      matchStateService.loading.set(false);
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      const eventQueue = fixture.componentInstance['eventQueue'] as MatchEventQueueService;
      const resumeSpy = vi.spyOn(eventQueue, 'resumeAck');
      const afterClosed$ = new Subject<void>();
      const dialogSpy = vi
        .spyOn(fixture.componentInstance['dialog'], 'open')
        .mockReturnValue(
          mockDialogRef(afterClosed$) as unknown as ReturnType<
            (typeof fixture.componentInstance)['dialog']['open']
          >,
        );

      matchStateService.envidoResolved$.next({
        response: 'QUIERO',
        winnerSeat: 'PLAYER_ONE',
        pointsMano: 28,
        pointsPie: 25,
      });

      // El modal se difiere para dejar ver el "¡Quiero!"; la cola sigue pausada.
      expect(dialogSpy).not.toHaveBeenCalled();
      expect(resumeSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1200);
      vi.useRealTimers();

      expect(dialogSpy).toHaveBeenCalledOnce();
      expect(dialogSpy.mock.calls[0][0]).toBe(EnvidoResultDialogComponent);
      expect(resumeSpy).not.toHaveBeenCalled();

      afterClosed$.next();

      expect(resumeSpy).toHaveBeenCalledOnce();
    });

    it('ENVIDO_RESOLVED NO_QUIERO: no abre modal y llama resumeAck síncronamente', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.loading.set(false);
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      const eventQueue = fixture.componentInstance['eventQueue'] as MatchEventQueueService;
      const resumeSpy = vi.spyOn(eventQueue, 'resumeAck');
      const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');

      matchStateService.envidoResolved$.next({
        response: 'NO_QUIERO',
        winnerSeat: 'PLAYER_ONE',
      });

      expect(dialogSpy).not.toHaveBeenCalled();
      expect(resumeSpy).toHaveBeenCalledOnce();
    });

    it('GameWonDialog: abre modal y llama resumeAck recién en afterClosed', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.loading.set(false);
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      const eventQueue = fixture.componentInstance['eventQueue'] as MatchEventQueueService;
      const resumeSpy = vi.spyOn(eventQueue, 'resumeAck');
      const afterClosed$ = new Subject<void>();
      const dialogSpy = vi
        .spyOn(fixture.componentInstance['dialog'], 'open')
        .mockReturnValue(
          mockDialogRef(afterClosed$) as unknown as ReturnType<
            (typeof fixture.componentInstance)['dialog']['open']
          >,
        );

      matchStateService.gameWon$.next({ winnerSeat: 'PLAYER_ONE' });

      expect(dialogSpy).toHaveBeenCalledOnce();
      expect(dialogSpy.mock.calls[0][0]).toBe(GameWonDialogComponent);
      expect(resumeSpy).not.toHaveBeenCalled();

      afterClosed$.next();

      expect(resumeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('revancha — afterClosed del modal de resultado (feature 014)', () => {
    function mockDialogRefWith<T>(afterClosedSubject: Subject<T>) {
      return {
        afterClosed: () => afterClosedSubject.asObservable(),
        close: vi.fn(),
        componentInstance: {},
      };
    }

    it('navega al lobby si session() es null al cerrar el resultado', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.loading.set(false);
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      const routerSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
      const afterClosed$ = new Subject<void>();

      // Mock dialog.open para capturar el resultado dialog y poder cerrarlo
      const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');
      dialogSpy.mockReturnValue(mockDialogRefWith(afterClosed$) as never);

      matchStateService.matchEnded$.next({
        winnerSeat: 'PLAYER_ONE',
        gamesWonPlayerOne: 2,
        gamesWonPlayerTwo: 0,
        reason: 'FINISHED',
      });
      fixture.detectChanges();

      // Mock el puntual getSession para devolver 404
      const rematchApi = fixture.componentInstance['rematchApiService'];
      vi.spyOn(rematchApi, 'getSession').mockReturnValue(throwError(() => new Error('not found')));

      // Cerramos el resultado dialog; session() es null
      afterClosed$.next();
      fixture.detectChanges();

      // Sin sesion disponible por REST: el componente vuelve al lobby.
      expect(routerSpy).toHaveBeenCalledWith(['/lobby']);
    });

    it('abre RematchDialogComponent si session() ya está seteada al cerrar el resultado', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.loading.set(false);
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      const rematchStateService = fixture.componentInstance[
        'rematchStateService'
      ] as RematchStateService;
      const session: RematchSession = {
        sessionId: 'sid-1',
        originMatchId: 'test-match',
        status: 'OPEN',
        selfChoice: 'UNDECIDED',
        opponentChoice: 'UNDECIDED',
        expiresAt: Date.now() + 30_000,
        resultMatchId: null,
      };
      rematchStateService.session.set(session);

      const afterClosed$ = new Subject<void>();
      const dialogSpy = vi
        .spyOn(fixture.componentInstance['dialog'], 'open')
        .mockReturnValue(mockDialogRefWith(afterClosed$) as never);

      matchStateService.matchEnded$.next({
        winnerSeat: 'PLAYER_ONE',
        gamesWonPlayerOne: 2,
        gamesWonPlayerTwo: 0,
        reason: 'FINISHED',
      });
      fixture.detectChanges();

      afterClosed$.next(); // cierra modal de resultado
      fixture.detectChanges();

      // El segundo open() debe ser RematchDialogComponent
      const rematchCall = dialogSpy.mock.calls.find((c) => c[0] === RematchDialogComponent);
      expect(rematchCall).toBeTruthy();
    });

    it('re-init por cambio de matchId (navegación a la revancha confirmada)', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.loading.set(false);
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      const initSpy = vi.spyOn(matchStateService, 'init');
      const rematchStateService = fixture.componentInstance[
        'rematchStateService'
      ] as RematchStateService;
      const resetSpy = vi.spyOn(rematchStateService, 'reset');

      // Simular navegación a un nuevo matchId (paramMap cambia)
      paramMapSubject.next(makeParamMap({ matchId: 'new-match-42' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.matchId()).toBe('new-match-42');
      expect(initSpy).toHaveBeenCalled();
      expect(resetSpy).toHaveBeenCalled();
    });

    it('cierra el diálogo de revancha (sin re-navegar) si navegamos por fuera (carrera con presence)', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.loading.set(false);
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      const rematchStateService = fixture.componentInstance[
        'rematchStateService'
      ] as RematchStateService;
      rematchStateService.session.set({
        sessionId: 'sid-1',
        originMatchId: 'test-match',
        status: 'OPEN',
        selfChoice: 'WANTS_REMATCH',
        opponentChoice: 'UNDECIDED',
        expiresAt: Date.now() + 30_000,
        resultMatchId: null,
      });

      // Modal de resultado + modal de revancha comparten dialog.open; devolvemos refs distintos.
      const resultAfterClosed$ = new Subject<void>();
      const rematchAfterClosed$ = new Subject<RematchDialogResult | undefined>();
      const rematchClose = vi.fn();
      const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');
      dialogSpy
        .mockReturnValueOnce({
          afterClosed: () => resultAfterClosed$.asObservable(),
          close: vi.fn(),
          componentInstance: {},
        } as never)
        .mockReturnValueOnce({
          afterClosed: () => rematchAfterClosed$.asObservable(),
          close: rematchClose,
          componentInstance: {},
        } as never);

      const routerSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');

      // Fin de partida → modal de resultado → al cerrarlo se abre el de revancha.
      matchStateService.matchEnded$.next({
        winnerSeat: 'PLAYER_ONE',
        gamesWonPlayerOne: 2,
        gamesWonPlayerTwo: 0,
        reason: 'FINISHED',
      });
      fixture.detectChanges();
      resultAfterClosed$.next();
      fixture.detectChanges();

      // Presence gana la carrera: navega a la nueva partida → cambia el paramMap.
      paramMapSubject.next(makeParamMap({ matchId: 'new-match-42' }));
      fixture.detectChanges();

      // El diálogo de revancha se cierra pidiendo no re-navegar.
      expect(rematchClose).toHaveBeenCalledWith({
        confirmedMatchId: null,
        skipNavigation: true,
      });

      // Y su afterClosed con skipNavigation NO debe mandarnos al lobby.
      rematchAfterClosed$.next({ confirmedMatchId: null, skipNavigation: true });
      expect(routerSpy).not.toHaveBeenCalledWith(['/']);
    });
  });
});
