import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BotCardComponent } from './bot-card.component';

describe('BotCardComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BotCardComponent] });
  });

  it('renderiza el nombre y las iniciales sobre un círculo de color', () => {
    const fixture = TestBed.createComponent(BotCardComponent);
    fixture.componentRef.setInput('bot', { botId: 'abc-123', name: 'El Mentiroso' });
    fixture.componentRef.setInput('selected', false);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('El Mentiroso');

    const avatar = fixture.debugElement.query(By.css('.bot-card__avatar'));
    expect(avatar.nativeElement.textContent.trim()).toBe('EM');
    expect((avatar.nativeElement.style.backgroundColor as string).length).toBeGreaterThan(0);
  });

  it('aria-pressed refleja el input selected', () => {
    const fixture = TestBed.createComponent(BotCardComponent);
    fixture.componentRef.setInput('bot', { botId: 'b1', name: 'Bot' });
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn.nativeElement.getAttribute('aria-pressed')).toBe('true');
    expect(btn.nativeElement.classList.contains('bot-card--selected')).toBe(true);
  });

  it('emite select con el botId al click', () => {
    const fixture = TestBed.createComponent(BotCardComponent);
    fixture.componentRef.setInput('bot', { botId: 'b1', name: 'Bot' });
    fixture.componentRef.setInput('selected', false);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.select.subscribe(spy);

    fixture.debugElement.query(By.css('button')).nativeElement.click();

    expect(spy).toHaveBeenCalledWith('b1');
  });

  it('fallback "Bot anónimo" cuando el nombre viene vacío', () => {
    const fixture = TestBed.createComponent(BotCardComponent);
    fixture.componentRef.setInput('bot', { botId: 'b1', name: '' });
    fixture.componentRef.setInput('selected', false);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Bot anónimo');
  });
});
