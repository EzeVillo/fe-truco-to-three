import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { LobbyPageComponent } from './lobby-page.component';

describe('LobbyPageComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LobbyPageComponent],
      providers: [provideRouter([]), provideAnimationsAsync()],
    });
  });

  it('renderiza el CTA "Jugar contra bots"', () => {
    const fixture = TestBed.createComponent(LobbyPageComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Jugar contra bots');
  });

  it('al click navega a /lobby/vs-bots', () => {
    const fixture = TestBed.createComponent(LobbyPageComponent);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('.lobby__cta'));
    btn.nativeElement.click();

    expect(navSpy).toHaveBeenCalledWith('/lobby/vs-bots');
  });
});
