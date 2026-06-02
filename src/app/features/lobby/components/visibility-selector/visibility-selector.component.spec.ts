import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { VisibilitySelectorComponent } from './visibility-selector.component';
import type { Visibility } from '../../../../core/models/enums';

function createSelector(visibility: Visibility = 'PRIVATE') {
  TestBed.configureTestingModule({ imports: [VisibilitySelectorComponent] });
  const fixture = TestBed.createComponent(VisibilitySelectorComponent);
  fixture.componentRef.setInput('visibility', visibility);
  fixture.detectChanges();
  return fixture;
}

describe('VisibilitySelectorComponent', () => {
  it('ofrece Pública y Privada', () => {
    const fixture = createSelector();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Pública');
    expect(text).toContain('Privada');
  });

  it('marca la opción activa según el input', () => {
    const fixture = createSelector('PUBLIC');
    const active = fixture.nativeElement.querySelector('[aria-checked="true"]') as HTMLElement;
    expect(active.textContent).toContain('Pública');
  });

  it('emite visibilityChange al seleccionar', () => {
    const fixture = createSelector('PRIVATE');
    let emitted: Visibility | null = null;
    fixture.componentInstance.visibilityChange.subscribe((v) => (emitted = v));
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click(); // Pública
    expect(emitted).toBe('PUBLIC');
  });
});
