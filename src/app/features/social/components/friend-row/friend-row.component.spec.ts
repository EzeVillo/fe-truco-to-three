import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { FriendRowComponent } from './friend-row.component';

describe('FriendRowComponent', () => {
  let fixture: ComponentFixture<FriendRowComponent>;
  let component: FriendRowComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FriendRowComponent] });
    fixture = TestBed.createComponent(FriendRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('friendUsername', 'martina');
    fixture.detectChanges();
  });

  it('muestra el username del amigo', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('martina');
  });

  it('emite remove con el username', () => {
    let emitted: string | null = null;
    component.remove.subscribe((v) => (emitted = v));
    (fixture.nativeElement as HTMLElement)
      .querySelector('.t3-btn--destructive')!
      .dispatchEvent(new MouseEvent('click'));
    expect(emitted).toBe('martina');
  });

  it('AVAILABLE + online: muestra "Invitar a partida" y emite invite', () => {
    fixture.componentRef.setInput('availability', 'AVAILABLE');
    fixture.componentRef.setInput('online', true);
    fixture.detectChanges();
    let emitted: string | null = null;
    component.invite.subscribe((v) => (emitted = v));
    const inviteBtn = fixture.debugElement.query(By.css('.t3-btn--primary'));
    expect((inviteBtn.nativeElement as HTMLElement).textContent).toContain('Invitar a partida');
    (inviteBtn.nativeElement as HTMLButtonElement).click();
    expect(emitted).toBe('martina');
  });

  it('AVAILABLE pero offline: oculta el botón y no muestra motivo', () => {
    fixture.componentRef.setInput('availability', 'AVAILABLE');
    fixture.componentRef.setInput('online', false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.t3-btn--primary'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.social-row__reason'))).toBeNull();
  });

  it('BUSY + online: oculta el botón invitar y muestra el motivo', () => {
    fixture.componentRef.setInput('availability', 'BUSY');
    fixture.componentRef.setInput('busyReason', 'IN_MATCH');
    fixture.componentRef.setInput('online', true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.t3-btn--primary'))).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('En partida');
  });

  it('BUSY pero offline: no muestra motivo (prevalece offline)', () => {
    fixture.componentRef.setInput('availability', 'BUSY');
    fixture.componentRef.setInput('busyReason', 'IN_MATCH');
    fixture.componentRef.setInput('online', false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.t3-btn--primary'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.social-row__reason'))).toBeNull();
  });

  it('online: refleja el indicador de conexión', () => {
    fixture.componentRef.setInput('online', true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.social-row__dot--online'))).toBeTruthy();
  });
});
