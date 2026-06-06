import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Component, signal } from '@angular/core';
import { SeriesFormatSelectorComponent } from './series-format-selector.component';
import type { SeriesFormat } from '../../../../core/models/match.models';

describe('SeriesFormatSelectorComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SeriesFormatSelectorComponent],
      providers: [provideAnimationsAsync()],
    });
  });

  it('renderiza las 3 opciones (BEST_OF_1, BEST_OF_3, BEST_OF_5)', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const options = fixture.debugElement.queryAll(By.css('.series-format__option'));
    expect(options.length).toBe(3);
  });

  it('el contenedor tiene role="radiogroup" y aria-label correcto', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const group = fixture.debugElement.query(By.css('.series-format'));
    expect(group.nativeElement.getAttribute('role')).toBe('radiogroup');
    expect(group.nativeElement.getAttribute('aria-label')).toBe('Formato de serie');
  });

  it('la opción activa tiene aria-checked="true" y la clase --active', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    TestBed.flushEffects();
    fixture.detectChanges();

    // Default: BEST_OF_3
    const options = fixture.debugElement.queryAll(By.css('.series-format__option'));
    const best3 = options.find((o) =>
      (o.nativeElement as HTMLElement).textContent?.includes('Mejor de 3'),
    );
    expect(best3).toBeTruthy();
    expect(best3!.nativeElement.getAttribute('aria-checked')).toBe('true');
    expect(
      (best3!.nativeElement as HTMLElement).classList.contains('series-format__option--active'),
    ).toBe(true);
  });

  it('las opciones inactivas tienen aria-checked="false"', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    TestBed.flushEffects();
    fixture.detectChanges();

    const options = fixture.debugElement.queryAll(By.css('.series-format__option'));
    const inactive = options.filter(
      (o) => (o.nativeElement as HTMLElement).getAttribute('aria-checked') === 'false',
    );
    expect(inactive.length).toBe(2);
  });

  it('cada opción tiene role="radio"', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const options = fixture.debugElement.queryAll(By.css('.series-format__option'));
    for (const opt of options) {
      expect((opt.nativeElement as HTMLElement).getAttribute('role')).toBe('radio');
    }
  });

  it('click en una opción emite formatChange con el valor correcto', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.formatChange.subscribe(spy);

    fixture.componentInstance.select('BEST_OF_5');

    expect(spy).toHaveBeenCalledWith('BEST_OF_5');
  });

  it('emite formatChange con BEST_OF_1 al hacer click en la opción correspondiente', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.formatChange.subscribe(spy);

    fixture.componentInstance.select('BEST_OF_1');

    expect(spy).toHaveBeenCalledWith('BEST_OF_1');
  });

  it('los labels visibles son "Mejor de 1", "Mejor de 3", "Mejor de 5"', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const options = fixture.debugElement.queryAll(By.css('.series-format__option'));
    const labels = options.map((o) => (o.nativeElement as HTMLElement).textContent?.trim());
    expect(labels).toContain('Mejor de 1');
    expect(labels).toContain('Mejor de 3');
    expect(labels).toContain('Mejor de 5');
  });

  it('los aria-labels son "Mejor de 1 partida", "Mejor de 3 partidas", "Mejor de 5 partidas"', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const options = fixture.debugElement.queryAll(By.css('.series-format__option'));
    const ariaLabels = options.map((o) =>
      (o.nativeElement as HTMLElement).getAttribute('aria-label'),
    );
    expect(ariaLabels).toContain('Mejor de 1 partida');
    expect(ariaLabels).toContain('Mejor de 3 partidas');
    expect(ariaLabels).toContain('Mejor de 5 partidas');
  });

  it('sólo los valores BEST_OF_1, BEST_OF_3, BEST_OF_5 están presentes (reglas de juego)', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const options = fixture.componentInstance.options.map((o) => o.value);
    expect(options).toEqual(['BEST_OF_1', 'BEST_OF_3', 'BEST_OF_5']);
    expect(options).not.toContain('BEST_OF_2');
    expect(options).not.toContain('BEST_OF_4');
  });

  it('por defecto el formato seleccionado es BEST_OF_3', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.format()).toBe('BEST_OF_3');
  });
});
