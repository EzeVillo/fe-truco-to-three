import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
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
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    expect(emitted).toBe('martina');
  });
});
