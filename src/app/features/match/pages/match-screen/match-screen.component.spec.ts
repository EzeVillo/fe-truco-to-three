import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MatchScreenComponent } from './match-screen.component';
import { MatchStateService } from '../../services/match-state.service';
import { RoundWonDialogComponent } from '../../components/round-won-dialog/round-won-dialog.component';
import { EnvidoResultDialogComponent } from '../../components/envido-result-dialog/envido-result-dialog.component';
import { mockMatchViewerPlayerOne } from '../../mocks/match-state.mocks';

describe('MatchScreenComponent', () => {
  let fixture: ComponentFixture<MatchScreenComponent>;
  let matchStateService: MatchStateService;

  function setupComponent(params: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      imports: [MatchScreenComponent, MatDialogModule, RoundWonDialogComponent, EnvidoResultDialogComponent],
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

  it('opens RoundWonDialog on roundEnded$ when local player wins', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');

    matchStateService.roundEnded$.next({ winnerSeat: 'PLAYER_ONE' });

    expect(dialogSpy).toHaveBeenCalledOnce();
    const call = dialogSpy.mock.calls[0];
    expect(call[0]).toBe(RoundWonDialogComponent);
    expect(call[1]?.['data']).toMatchObject({
      matchFinished: false,
      localWonMatch: true,
    });
  });

  it('opens RoundWonDialog on roundEnded$ when local player loses', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');

    matchStateService.roundEnded$.next({ winnerSeat: 'PLAYER_TWO' });

    expect(dialogSpy).toHaveBeenCalledOnce();
    const call = dialogSpy.mock.calls[0];
    expect(call[0]).toBe(RoundWonDialogComponent);
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

  it('opens EnvidoResultDialog showing "Son buenas" when scores are missing', () => {
    setupComponent({ matchId: 'test-match' });
    matchStateService.loading.set(false);
    matchStateService.state.set(mockMatchViewerPlayerOne);
    fixture.detectChanges();

    const dialogSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open');

    matchStateService.envidoResolved$.next({
      response: 'NO_QUIERO',
      winnerSeat: 'PLAYER_ONE',
    });

    expect(dialogSpy).toHaveBeenCalledOnce();
    const call = dialogSpy.mock.calls[0];
    expect(call[0]).toBe(EnvidoResultDialogComponent);
    expect(call[1]?.['data']).toMatchObject({
      manoScore: null,
      pieScore: null,
      won: true,
    });
  });
});
