import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerHandComponent } from './player-hand.component';
import { MatchActionsService } from '../../services/match-actions.service';
import { of } from 'rxjs';

describe('PlayerHandComponent', () => {
  let fixture: ComponentFixture<PlayerHandComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlayerHandComponent],
      providers: [
        {
          provide: MatchActionsService,
          useValue: {
            playCard: vi.fn().mockReturnValue(of(undefined)),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PlayerHandComponent);
  });

  it('T017: click on card triggers playCard when playCardsEnabled is true', () => {
    fixture.componentRef.setInput('cards', [{ suit: 'ESPADA', number: 1 }]);
    fixture.componentRef.setInput('matchId', 'match-123');
    fixture.componentRef.setInput('playCardsEnabled', true);
    fixture.detectChanges();

    const service = TestBed.inject(MatchActionsService) as unknown as {
      playCard: ReturnType<typeof vi.fn>;
    };
    const cardBtn = fixture.nativeElement.querySelector('.player-hand__card-btn');
    expect(cardBtn).toBeTruthy();

    cardBtn.click();
    expect(service.playCard).toHaveBeenCalledWith('match-123', { suit: 'ESPADA', number: 1 });
  });

  it('T017: click on card does NOT trigger playCard when playCardsEnabled is false', () => {
    fixture.componentRef.setInput('cards', [{ suit: 'ESPADA', number: 1 }]);
    fixture.componentRef.setInput('matchId', 'match-123');
    fixture.componentRef.setInput('playCardsEnabled', false);
    fixture.detectChanges();

    const service = TestBed.inject(MatchActionsService) as unknown as {
      playCard: ReturnType<typeof vi.fn>;
    };
    const cardBtn = fixture.nativeElement.querySelector('.player-hand__card-btn');
    expect(cardBtn).toBeTruthy();

    cardBtn.click();
    expect(service.playCard).not.toHaveBeenCalled();
  });

  it('card buttons are disabled when playCardsEnabled is false', () => {
    fixture.componentRef.setInput('cards', [{ suit: 'ORO', number: 7 }]);
    fixture.componentRef.setInput('matchId', 'match-123');
    fixture.componentRef.setInput('playCardsEnabled', false);
    fixture.detectChanges();

    const cardBtn = fixture.nativeElement.querySelector(
      '.player-hand__card-btn',
    ) as HTMLButtonElement;
    expect(cardBtn.disabled).toBe(true);
  });

  it('card buttons are enabled when playCardsEnabled is true', () => {
    fixture.componentRef.setInput('cards', [{ suit: 'ORO', number: 7 }]);
    fixture.componentRef.setInput('matchId', 'match-123');
    fixture.componentRef.setInput('playCardsEnabled', true);
    fixture.detectChanges();

    const cardBtn = fixture.nativeElement.querySelector(
      '.player-hand__card-btn',
    ) as HTMLButtonElement;
    expect(cardBtn.disabled).toBe(false);
  });
});
