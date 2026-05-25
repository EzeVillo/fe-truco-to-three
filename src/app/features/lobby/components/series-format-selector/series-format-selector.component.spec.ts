import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { SeriesFormatSelectorComponent } from './series-format-selector.component';

describe('SeriesFormatSelectorComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SeriesFormatSelectorComponent],
      providers: [provideAnimationsAsync()],
    });
  });

  it('renderiza las 3 opciones y por defecto selecciona BEST_OF_3', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const toggles = fixture.debugElement.queryAll(By.css('mat-button-toggle'));
    expect(toggles.length).toBe(3);

    const group = fixture.debugElement.query(By.css('mat-button-toggle-group'));
    expect(group.nativeElement.getAttribute('aria-label')).toBe('Formato de serie');
    expect(fixture.componentInstance.format()).toBe('BEST_OF_3');
  });

  it('emite formatChange al seleccionar otra opción', () => {
    const fixture = TestBed.createComponent(SeriesFormatSelectorComponent);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.formatChange.subscribe(spy);

    fixture.componentInstance.onChange({ value: 'BEST_OF_5' } as never);

    expect(spy).toHaveBeenCalledWith('BEST_OF_5');
  });
});
