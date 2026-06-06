import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { IncomingRequestRowComponent } from './incoming-request-row.component';

describe('IncomingRequestRowComponent', () => {
  let fixture: ComponentFixture<IncomingRequestRowComponent>;
  let component: IncomingRequestRowComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IncomingRequestRowComponent] });
    fixture = TestBed.createComponent(IncomingRequestRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('requesterUsername', 'leo');
    fixture.detectChanges();
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  }

  it('muestra el username del remitente', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('leo');
  });

  it('emite accept con el username', () => {
    let emitted: string | null = null;
    component.accept.subscribe((v) => (emitted = v));
    buttons()[0].click();
    expect(emitted).toBe('leo');
  });

  it('emite decline con el username', () => {
    let emitted: string | null = null;
    component.decline.subscribe((v) => (emitted = v));
    buttons()[1].click();
    expect(emitted).toBe('leo');
  });
});
