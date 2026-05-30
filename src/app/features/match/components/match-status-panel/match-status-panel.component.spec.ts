import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchStatusPanelComponent } from './match-status-panel.component';
import type { MatchView } from '../../utils/derive-match-view';

function createMockView(deadlineSeat: 'PLAYER_ONE' | 'PLAYER_TWO' | null = null): MatchView {
  return {
    matchId: 'test-match',
    status: 'IN_PROGRESS',
    gamesToPlay: 3,
    seriesLabel: 'Mejor de 3',
    self: {
      seat: 'PLAYER_ONE',
      username: 'juancho',
      score: 1,
      gamesWon: 0,
      handCards: null,
      handCount: 3,
      playedInCurrentHand: null,
      playedInPreviousHands: [],
      hasActiveDeadline: deadlineSeat === 'PLAYER_ONE',
    },
    opponent: {
      seat: 'PLAYER_TWO',
      username: 'martina',
      score: 0,
      gamesWon: 0,
      handCards: null,
      handCount: 3,
      playedInCurrentHand: null,
      playedInPreviousHands: [],
      hasActiveDeadline: deadlineSeat === 'PLAYER_TWO',
    },
    currentTurnIsSelf: true,
    currentTurnUsername: 'juancho',
    roundStatus: 'PLAYING',
    playedHandsCount: 0,
    availableActions: [],
    currentTrucoCall: null,
    actionDeadline: deadlineSeat === null ? null : 1_000_030_000,
    turnDurationMillis: deadlineSeat === null ? null : 30_000,
    deadlineIsSelf: deadlineSeat === null ? null : deadlineSeat === 'PLAYER_ONE',
  };
}

describe('MatchStatusPanelComponent', () => {
  let fixture: ComponentFixture<MatchStatusPanelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatchStatusPanelComponent],
    });
    fixture = TestBed.createComponent(MatchStatusPanelComponent);
  });

  it('renderiza selfCallText debajo del nombre del jugador propio', () => {
    fixture.componentRef.setInput('view', createMockView());
    fixture.componentRef.setInput('selfCallText', '\u00a1Envido!');
    fixture.componentRef.setInput('opponentCallText', null);
    fixture.detectChanges();

    const selfCallEl = fixture.nativeElement.querySelector('.status-panel__player-col:not(.status-panel__player-col--right) .status-panel__call-text');
    expect(selfCallEl).toBeTruthy();
    expect(selfCallEl.textContent.trim()).toBe('\u00a1Envido!');
  });

  it('renderiza opponentCallText debajo del nombre del rival', () => {
    fixture.componentRef.setInput('view', createMockView());
    fixture.componentRef.setInput('selfCallText', null);
    fixture.componentRef.setInput('opponentCallText', '\u00a1Truco!');
    fixture.detectChanges();

    const opponentCallEl = fixture.nativeElement.querySelector('.status-panel__player-col--right .status-panel__call-text');
    expect(opponentCallEl).toBeTruthy();
    expect(opponentCallEl.textContent.trim()).toBe('\u00a1Truco!');
  });

  it('renderiza el call text vacío cuando el input es null (reserva el alto)', () => {
    fixture.componentRef.setInput('view', createMockView());
    fixture.componentRef.setInput('selfCallText', null);
    fixture.componentRef.setInput('opponentCallText', null);
    fixture.detectChanges();

    const callEls = fixture.nativeElement.querySelectorAll('.status-panel__call-text');
    expect(callEls.length).toBe(2);
    for (const el of callEls) {
      expect(el.textContent.trim()).toBe('');
    }
  });

  it('renderiza el call text vacío cuando el input es undefined (reserva el alto)', () => {
    fixture.componentRef.setInput('view', createMockView());
    fixture.componentRef.setInput('selfCallText', undefined);
    fixture.componentRef.setInput('opponentCallText', undefined);
    fixture.detectChanges();

    const callEls = fixture.nativeElement.querySelectorAll('.status-panel__call-text');
    expect(callEls.length).toBe(2);
    for (const el of callEls) {
      expect(el.textContent.trim()).toBe('');
    }
  });

  describe('temporizador de turno (013-turn-timer)', () => {
    it('no renderiza el anillo y muestra los turn-dots cuando no hay plazo activo', () => {
      fixture.componentRef.setInput('view', createMockView(null));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.status-panel__turn-ring').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('.status-panel__turn-dot').length).toBe(2);
    });

    it('renderiza el anillo sobre el asiento propio (US1)', () => {
      fixture.componentRef.setInput('view', createMockView('PLAYER_ONE'));
      fixture.componentRef.setInput('timerRemainingFraction', 0.5);
      fixture.detectChanges();

      const selfHeader = fixture.nativeElement.querySelector(
        '.status-panel__player-col:not(.status-panel__player-col--right) .status-panel__player-header',
      );
      expect(selfHeader.querySelector('.status-panel__turn-ring')).toBeTruthy();
    });

    it('renderiza el anillo sobre el asiento del rival (US2)', () => {
      fixture.componentRef.setInput('view', createMockView('PLAYER_TWO'));
      fixture.detectChanges();

      const rightHeader = fixture.nativeElement.querySelector('.status-panel__player-header--right');
      expect(rightHeader.querySelector('.status-panel__turn-ring')).toBeTruthy();
    });

    it('aplica la clase de urgencia cuando timerIsUrgent es true (FR-006)', () => {
      fixture.componentRef.setInput('view', createMockView('PLAYER_ONE'));
      fixture.componentRef.setInput('timerIsUrgent', true);
      fixture.detectChanges();

      const ring = fixture.nativeElement.querySelector('.status-panel__turn-ring');
      expect(ring.classList.contains('is-urgent')).toBe(true);
    });
  });
});
