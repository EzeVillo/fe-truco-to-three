import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { BackButtonComponent } from './back-button.component';

describe('BackButtonComponent', () => {
  let fixture: ComponentFixture<BackButtonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BackButtonComponent] });
    fixture = TestBed.createComponent(BackButtonComponent);
  });

  it('usa "Volver" como aria-label por defecto', () => {
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Volver');
    expect(button.textContent).toContain('arrow_back');
  });

  it('permite personalizar el aria-label', () => {
    fixture.componentRef.setInput('label', 'Volver al lobby');
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Volver al lobby');
  });

  it('emite el evento back al hacer clic', () => {
    let emitted = false;
    fixture.componentInstance.back.subscribe(() => (emitted = true));
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    expect(emitted).toBe(true);
  });
});
