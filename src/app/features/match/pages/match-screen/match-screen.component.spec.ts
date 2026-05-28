import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { MatchScreenComponent } from './match-screen.component';
import { MatchStateService } from '../../services/match-state.service';
import { MatchEventQueueService } from '../../services/match-event-queue.service';
import { GameWonDialogComponent } from '../../components/game-won-dialog/game-won-dialog.component';
import { EnvidoResultDialogComponent } from '../../components/envido-result-dialog/envido-result-dialog.component';
import { mockMatchViewerPlayerOne } from '../../mocks/match-state.mocks';

describe('MatchScreenComponent', () => {
  let fixture: ComponentFixture<MatchScreenComponent>;
  let matchStateService: MatchStateService;

  function setupComponent(params: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      imports: [MatchScreenComponent, MatDialogModule, GameWonDialogComponent, EnvidoResultDialogComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => params[key] ?? null,
              },
              queryParamMap: {
                get: () => null,
              },
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

  it('calls init on MatchStateService with matchId', () => {
    setupComponent({ matchId: 'test-match' });
    expect(matchStateService.loading()).toBe(true);
  });

  it('navigates to lobby on goToLobby', () => {
    setupComponent({ matchId: 'test-match' });
    const routerSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
    fixture.componentInstance.goToLobby();
    expect(routerSpy).toHaveBeenCalledWith(['/']);
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

  it('actualiza selfCallText ante ENVIDO_CALLED del jugador propio', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    matchStateService.matchEvent$.next({
      matchId: 'test-match',
      eventType: 'ENVIDO_CALLED',
      timestamp: Date.now(),
      payload: { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' },
      stateVersion: 2,
    });

    expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Envido!');
    expect(fixture.componentInstance.opponentCallText()).toBeNull();
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
        payload: { winnerSeat: 'PLAYER_ONE', abandonerSeat: 'PLAYER_TWO', gamesWonPlayerOne: 0, gamesWonPlayerTwo: 0 },
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
        payload: { winnerSeat: 'PLAYER_ONE', loserSeat: 'PLAYER_TWO', gamesWonPlayerOne: 0, gamesWonPlayerTwo: 0 },
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

    it('muestra selfCallText para QUIERO cuando el jugador local acept\u00f3', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1Quiero!');
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('muestra opponentCallText para QUIERO cuando el rival acept\u00f3', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'QUIERO', winnerSeat: 'PLAYER_TWO' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1Quiero!');
      expect(fixture.componentInstance.selfCallText()).toBeNull();
    });

    it('muestra selfCallText para NO_QUIERO cuando el jugador local rechaz\u00f3', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_TWO' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.selfCallText()).toBe('\u00a1No quiero!');
      expect(fixture.componentInstance.opponentCallText()).toBeNull();
    });

    it('muestra opponentCallText para NO_QUIERO cuando el rival rechaz\u00f3', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1No quiero!');
      expect(fixture.componentInstance.selfCallText()).toBeNull();
    });

    it('auto-limpia selfCallText de QUIERO a los 3 segundos', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

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

    it('no auto-limpia opponentCallText de NO_QUIERO', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      matchStateService.matchEvent$.next({
        matchId: 'test-match',
        eventType: 'ENVIDO_RESOLVED',
        timestamp: Date.now(),
        payload: { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' },
        stateVersion: 2,
      });

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1No quiero!');

      vi.advanceTimersByTime(5000);
      fixture.detectChanges();

      expect(fixture.componentInstance.opponentCallText()).toBe('\u00a1No quiero!');
    });

    it('limpia opponentCallText de NO_QUIERO ante ROUND_STARTED', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

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

    it('ENVIDO_RESOLVED QUIERO: abre modal y llama resumeAck recién en afterClosed', () => {
      setupComponent({ matchId: 'test-match' });
      matchStateService.loading.set(false);
      matchStateService.state.set(mockMatchViewerPlayerOne);
      fixture.detectChanges();

      const eventQueue = fixture.componentInstance['eventQueue'] as MatchEventQueueService;
      const resumeSpy = vi.spyOn(eventQueue, 'resumeAck');
      const afterClosed$ = new Subject<void>();
      const dialogSpy = vi
        .spyOn(fixture.componentInstance['dialog'], 'open')
        .mockReturnValue(mockDialogRef(afterClosed$) as unknown as ReturnType<typeof fixture.componentInstance['dialog']['open']>);

      matchStateService.envidoResolved$.next({
        response: 'QUIERO',
        winnerSeat: 'PLAYER_ONE',
        pointsMano: 28,
        pointsPie: 25,
      });

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
        .mockReturnValue(mockDialogRef(afterClosed$) as unknown as ReturnType<typeof fixture.componentInstance['dialog']['open']>);

      matchStateService.gameWon$.next({ winnerSeat: 'PLAYER_ONE' });

      expect(dialogSpy).toHaveBeenCalledOnce();
      expect(dialogSpy.mock.calls[0][0]).toBe(GameWonDialogComponent);
      expect(resumeSpy).not.toHaveBeenCalled();

      afterClosed$.next();

      expect(resumeSpy).toHaveBeenCalledOnce();
    });
  });
});
