import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchStatusPanelComponent } from './match-status-panel.component';
import type { MatchView } from '../../utils/derive-match-view';

function createMockView(): MatchView {
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
    },
    currentTurnIsSelf: true,
    currentTurnUsername: 'juancho',
    roundStatus: 'PLAYING',
    playedHandsCount: 0,
    availableActions: [],
    currentTrucoCall: null,
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

  it('no renderiza call text cuando el input es null', () => {
    fixture.componentRef.setInput('view', createMockView());
    fixture.componentRef.setInput('selfCallText', null);
    fixture.componentRef.setInput('opponentCallText', null);
    fixture.detectChanges();

    const callEls = fixture.nativeElement.querySelectorAll('.status-panel__call-text');
    expect(callEls.length).toBe(0);
  });

  it('no renderiza call text cuando el input es undefined', () => {
    fixture.componentRef.setInput('view', createMockView());
    fixture.componentRef.setInput('selfCallText', undefined);
    fixture.componentRef.setInput('opponentCallText', undefined);
    fixture.detectChanges();

    const callEls = fixture.nativeElement.querySelectorAll('.status-panel__call-text');
    expect(callEls.length).toBe(0);
  });

  it('renderiza centeredCallText con clase centrada', () => {
    fixture.componentRef.setInput('view', createMockView());
    fixture.componentRef.setInput('centeredCallText', '\u00a1Quiero!');
    fixture.detectChanges();

    const centeredEl = fixture.nativeElement.querySelector('.status-panel__call-text--centered');
    expect(centeredEl).toBeTruthy();
    expect(centeredEl.textContent.trim()).toBe('\u00a1Quiero!');
  });
});
