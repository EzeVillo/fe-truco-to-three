import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardViewComponent } from './card-view.component';

describe('CardViewComponent', () => {
  let fixture: ComponentFixture<CardViewComponent>;
  let component: CardViewComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CardViewComponent],
    });
    fixture = TestBed.createComponent(CardViewComponent);
    component = fixture.componentInstance;
  });

  it('renders dorso.png when card is null', () => {
    component.card = null;
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('/cards/dorso.png');
  });

  it('renders correct card image URL when card is visible', () => {
    component.card = { suit: 'ESPADA', number: 1 };
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('/cards/1_espada.png');
  });

  it('computes alt text correctly', () => {
    component.card = { suit: 'ORO', number: 7 };
    expect(component.cardAltText).toBe('7 de Oro');
  });
});
