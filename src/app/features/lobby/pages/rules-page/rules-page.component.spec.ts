import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { RulesSectionComponent } from '../../components/rules-section/rules-section.component';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import { RulesPageComponent } from './rules-page.component';

describe('RulesPageComponent', () => {
  let fixture: ComponentFixture<RulesPageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RulesPageComponent],
      providers: [provideRouter([])],
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

  it('permite volver al lobby', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const backButton = fixture.debugElement.query(By.directive(BackButtonComponent));
    backButton.componentInstance.back.emit();

    expect(navSpy).toHaveBeenCalledWith('/lobby');
  });

  it('usa el topbar consistente con las paginas del lobby', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(fixture.debugElement.query(By.css('.rules-page__topbar'))).toBeTruthy();
    const backButton = fixture.debugElement.query(By.directive(BackButtonComponent));
    expect(backButton).toBeTruthy();
    expect(backButton.nativeElement.querySelector('button').getAttribute('aria-label')).toBe(
      'Volver al lobby',
    );
    expect(text).toContain('Reglas de la variante');
  });
});
