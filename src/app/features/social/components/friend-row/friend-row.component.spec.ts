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

  it('AVAILABLE + online: muestra botón invitar y emite invite', () => {
    fixture.componentRef.setInput('availability', 'AVAILABLE');
    fixture.componentRef.setInput('online', true);
    fixture.detectChanges();
    let emitted: string | null = null;
    component.invite.subscribe((v) => (emitted = v));
    const inviteBtn = fixture.debugElement.query(By.css('.t3-btn--primary'));
    expect(inviteBtn).toBeTruthy();
    (inviteBtn.nativeElement as HTMLButtonElement).click();
    expect(emitted).toBe('martina');
  });

  it('AVAILABLE pero offline: oculta el botón y el dot es muted', () => {
    fixture.componentRef.setInput('availability', 'AVAILABLE');
    fixture.componentRef.setInput('online', false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.t3-btn--primary'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.social-row__dot--online'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.social-row__dot--busy'))).toBeNull();
  });

  it('BUSY + online: oculta el botón invitar y muestra dot rojo', () => {
    fixture.componentRef.setInput('availability', 'BUSY');
    fixture.componentRef.setInput('busyReason', 'IN_MATCH');
    fixture.componentRef.setInput('online', true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.t3-btn--primary'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.social-row__dot--busy'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.social-row__dot--online'))).toBeNull();
  });

  it('BUSY pero offline: oculta el botón y el dot es muted', () => {
    fixture.componentRef.setInput('availability', 'BUSY');
    fixture.componentRef.setInput('busyReason', 'IN_MATCH');
    fixture.componentRef.setInput('online', false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.t3-btn--primary'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.social-row__dot--online'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.social-row__dot--busy'))).toBeNull();
  });

  it('AVAILABLE + online: refleja el indicador verde', () => {
    fixture.componentRef.setInput('availability', 'AVAILABLE');
    fixture.componentRef.setInput('online', true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.social-row__dot--online'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.social-row__dot--busy'))).toBeNull();
  });

  // ─── Spectate (feature 026) ───────────────────────────────────────────────

  it('sin spectatableMatchId: no muestra botón mirar', () => {
    fixture.componentRef.setInput('spectatableMatchId', null);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.t3-btn--neutral'))).toBeNull();
  });

  it('con spectatableMatchId: muestra botón mirar', () => {
    fixture.componentRef.setInput('spectatableMatchId', 'match-abc');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.t3-btn--neutral'))).toBeTruthy();
  });

  it('click en botón mirar emite spectate con el matchId', () => {
    fixture.componentRef.setInput('spectatableMatchId', 'match-xyz');
    fixture.detectChanges();
    let emitted: string | null = null;
    component.spectate.subscribe((v) => (emitted = v));
    const mirrarBtn = fixture.debugElement.query(By.css('.t3-btn--neutral'));
    expect(mirrarBtn).toBeTruthy();
    (mirrarBtn.nativeElement as HTMLButtonElement).click();
    expect(emitted).toBe('match-xyz');
  });
});
