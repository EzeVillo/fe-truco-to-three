import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { RulesSectionComponent } from '../../components/rules-section/rules-section.component';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import { AuthStore } from '../../../../core/auth/auth.store';
import { RulesPageComponent } from './rules-page.component';

describe('RulesPageComponent', () => {
  describe('sin sesión', () => {
    let fixture: ComponentFixture<RulesPageComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [RulesPageComponent],
        providers: [
          provideRouter([]),
          { provide: AuthStore, useValue: { isAuthenticated: signal(false) } },
        ],
      });
      fixture = TestBed.createComponent(RulesPageComponent);
      fixture.detectChanges();
    });

    it('renderiza la sección completa de reglas de variante', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(fixture.debugElement.query(By.directive(RulesSectionComponent))).toBeTruthy();
      expect(text).toContain('Truco a 3 puntos');
      expect(text).toContain('Punto exacto');
      expect(text).toContain('Falta envido');
      expect(text).not.toContain('FALTA_ENVIDO');
    });

    it('usa el topbar con botón de volver y título', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(fixture.debugElement.query(By.css('.rules-page__topbar'))).toBeTruthy();
      const backButton = fixture.debugElement.query(By.directive(BackButtonComponent));
      expect(backButton).toBeTruthy();
      expect(backButton.nativeElement.querySelector('button').getAttribute('aria-label')).toBe(
        'Volver',
      );
      expect(text).toContain('Reglas de la variante');
    });

    it('sin historial previo, volver navega al inicio', () => {
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const backButton = fixture.debugElement.query(By.directive(BackButtonComponent));
      backButton.componentInstance.back.emit();

      expect(navSpy).toHaveBeenCalledWith('/');
    });

    it('muestra el footer con CTA de invitado y de cuenta', () => {
      const footer = fixture.debugElement.query(By.css('.rules-page__footer'));
      expect(footer).toBeTruthy();

      const guestButton = footer.query(By.css('.guest-cta__button'));
      expect(guestButton).toBeTruthy();
      expect((guestButton.nativeElement as HTMLElement).textContent).toContain(
        'Jugar como invitado',
      );

      const links = footer.queryAll(By.css('a'));
      expect(
        links.some((l) =>
          (l.nativeElement as HTMLElement).textContent?.includes('Creá una cuenta o iniciá sesión'),
        ),
      ).toBe(true);
    });
  });

  describe('con sesión', () => {
    let fixture: ComponentFixture<RulesPageComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [RulesPageComponent],
        providers: [
          provideRouter([]),
          { provide: AuthStore, useValue: { isAuthenticated: signal(true) } },
        ],
      });
      fixture = TestBed.createComponent(RulesPageComponent);
      fixture.detectChanges();
    });

    it('sin historial previo, volver navega al lobby', () => {
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const backButton = fixture.debugElement.query(By.directive(BackButtonComponent));
      backButton.componentInstance.back.emit();

      expect(navSpy).toHaveBeenCalledWith('/lobby');
    });

    it('oculta el footer de CTAs', () => {
      expect(fixture.debugElement.query(By.css('.rules-page__footer'))).toBeNull();
    });
  });
});
