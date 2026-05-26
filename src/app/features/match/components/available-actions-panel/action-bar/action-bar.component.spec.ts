import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActionBarComponent } from './action-bar.component';
import type { AvailableActionType } from '../../../../../core/models/enums';

describe('ActionBarComponent', () => {
  let fixture: ComponentFixture<ActionBarComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ActionBarComponent],
    });
    fixture = TestBed.createComponent(ActionBarComponent);
  });

  it('T015: envido option enabled when CALL_ENVIDO is in availableActions', () => {
    fixture.componentRef.setInput('availableActions', [
      { type: 'CALL_ENVIDO' as AvailableActionType },
      { type: 'CALL_TRUCO' as AvailableActionType },
    ]);
    fixture.detectChanges();

    const items = fixture.componentInstance.items();
    const envidoItem = items.find((i) => i.label === 'Envido');
    expect(envidoItem).toBeTruthy();
    expect(envidoItem!.enabled).toBe(true);
  });

  it('T015: envido option disabled when CALL_ENVIDO is NOT in availableActions', () => {
    fixture.componentRef.setInput('availableActions', [
      { type: 'CALL_TRUCO' as AvailableActionType },
      { type: 'FOLD' as AvailableActionType },
    ]);
    fixture.detectChanges();

    const items = fixture.componentInstance.items();
    const envidoItem = items.find((i) => i.label === 'Envido');
    expect(envidoItem).toBeTruthy();
    expect(envidoItem!.enabled).toBe(false);
  });

  it('envido click does not emit when disabled', () => {
    fixture.componentRef.setInput('availableActions', [
      { type: 'CALL_TRUCO' as AvailableActionType },
    ]);
    fixture.detectChanges();

    let envidoEmitted = false;
    fixture.componentInstance.envidoClicked.subscribe(() => {
      envidoEmitted = true;
    });

    const items = fixture.componentInstance.items();
    const envidoItem = items.find((i) => i.label === 'Envido')!;
    fixture.componentInstance.onClick(envidoItem);

    expect(envidoEmitted).toBe(false);
  });

  it('envido click emits when enabled', () => {
    fixture.componentRef.setInput('availableActions', [
      { type: 'CALL_ENVIDO' as AvailableActionType },
    ]);
    fixture.detectChanges();

    let envidoEmitted = false;
    fixture.componentInstance.envidoClicked.subscribe(() => {
      envidoEmitted = true;
    });

    const items = fixture.componentInstance.items();
    const envidoItem = items.find((i) => i.label === 'Envido')!;
    fixture.componentInstance.onClick(envidoItem);

    expect(envidoEmitted).toBe(true);
  });
});
