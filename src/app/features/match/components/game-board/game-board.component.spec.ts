import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { GameBoardComponent } from './game-board.component';
import { deriveMatchView } from '../../utils/derive-match-view';
import { mockMatchViewerPlayerOne } from '../../mocks/match-state.mocks';

describe('GameBoardComponent', () => {
  let fixture: ComponentFixture<GameBoardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GameBoardComponent],
      providers: [provideHttpClient(), provideRouter([])],
    });
    fixture = TestBed.createComponent(GameBoardComponent);
    fixture.componentRef.setInput('view', deriveMatchView(mockMatchViewerPlayerOne));
    fixture.componentRef.setInput('matchId', 'mock-match-001');
    fixture.detectChanges();
  });

  it('modo jugador: renderiza el panel de acciones disponibles', () => {
    fixture.componentRef.setInput('spectator', false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-available-actions-panel'))).toBeTruthy();
  });

  it('modo espectador: NO renderiza el panel de acciones disponibles', () => {
    fixture.componentRef.setInput('spectator', true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-available-actions-panel'))).toBeNull();
  });

  it('modo espectador: sigue renderizando el tablero (oponente, cartas jugadas, área propia)', () => {
    fixture.componentRef.setInput('spectator', true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-opponent-area'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('app-played-cards-area'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('app-player-area'))).toBeTruthy();
  });
});
