import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from '../../../../app.routes';
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

  it('renderiza el CTA "Partida rápida" y navega a /lobby/quick-match', () => {
    const fixture = TestBed.createComponent(LobbyPageComponent);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Partida rápida');
    expect(text).toContain('Buscá rival automáticamente y jugá online');

    const buttons = fixture.debugElement.queryAll(By.css('.lobby__cta'));
    buttons[1].nativeElement.click();

    expect(navSpy).toHaveBeenCalledWith('/lobby/quick-match');
  });

  // T005 — US1: tests de layout y tokens
  it('US1: el CTA no usa mat-flat-button', () => {
    const fixture = TestBed.createComponent(LobbyPageComponent);
    fixture.detectChanges();
    const matBtn = fixture.debugElement.query(By.css('[mat-flat-button]'));
    expect(matBtn).toBeNull();
  });

  it('US1: el CTA tiene título y descripción en spans separados', () => {
    const fixture = TestBed.createComponent(LobbyPageComponent);
    fixture.detectChanges();
    const title = fixture.debugElement.query(By.css('.lobby__cta-title'));
    const subtitle = fixture.debugElement.query(By.css('.lobby__cta-subtitle'));
    expect(title).toBeTruthy();
    expect(subtitle).toBeTruthy();
    expect(title.nativeElement.textContent.trim()).toBe('Jugar contra bots');
    expect(subtitle.nativeElement.textContent.trim()).toBeTruthy();
  });

  it('US1: el CTA tiene jerarquía vertical (título sobre descripción)', () => {
    const fixture = TestBed.createComponent(LobbyPageComponent);
    fixture.detectChanges();
    const cta = fixture.debugElement.query(By.css('.lobby__cta'));
    const title = fixture.debugElement.query(By.css('.lobby__cta-title'));
    const subtitle = fixture.debugElement.query(By.css('.lobby__cta-subtitle'));

    // Ambos spans deben ser hijos directos del CTA
    expect(cta.nativeElement.contains(title.nativeElement)).toBe(true);
    expect(cta.nativeElement.contains(subtitle.nativeElement)).toBe(true);

    // El título debe aparecer antes que el subtítulo en el DOM
    const children = Array.from(cta.nativeElement.children) as Element[];
    const titleIdx = children.findIndex((el) => el.classList.contains('lobby__cta-title'));
    const subtitleIdx = children.findIndex((el) => el.classList.contains('lobby__cta-subtitle'));
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(subtitleIdx).toBeGreaterThan(titleIdx);
  });

  it('renderiza un CTA para abrir las reglas de variante', () => {
    const fixture = TestBed.createComponent(LobbyPageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Reglas de la variante');
    expect(text).toContain('Consultá qué cambia en Truco a 3 puntos');
    expect(text).not.toContain('Punto exacto');
  });

  it('al click del CTA de reglas navega a /reglas', () => {
    const fixture = TestBed.createComponent(LobbyPageComponent);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.detectChanges();
    const buttons = fixture.debugElement.queryAll(By.css('.lobby__cta'));
    buttons[3].nativeElement.click();

    expect(navSpy).toHaveBeenCalledWith('/reglas');
  });

  it('la ruta de reglas está en /reglas (accesible sin auth)', () => {
    const rulesRoutes = routes.filter(
      (route) => route.path?.includes('reglas') || route.path?.includes('rules'),
    );

    expect(rulesRoutes.map((route) => route.path)).toEqual(['reglas']);
  });
});
