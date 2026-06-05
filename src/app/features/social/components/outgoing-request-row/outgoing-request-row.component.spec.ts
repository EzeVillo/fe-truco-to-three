import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { OutgoingRequestRowComponent } from './outgoing-request-row.component';

describe('OutgoingRequestRowComponent', () => {
  let fixture: ComponentFixture<OutgoingRequestRowComponent>;
  let component: OutgoingRequestRowComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OutgoingRequestRowComponent] });
    fixture = TestBed.createComponent(OutgoingRequestRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('addresseeUsername', 'martina');
    fixture.detectChanges();
  });

  it('muestra el username del destinatario', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('martina');
  });

  it('emite cancel con el username', () => {
    let emitted: string | null = null;
    component.cancel.subscribe((v) => (emitted = v));
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    expect(emitted).toBe('martina');
  });
});
