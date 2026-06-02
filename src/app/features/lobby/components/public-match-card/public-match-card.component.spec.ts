import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PublicMatchCardComponent } from './public-match-card.component';
import type { PublicMatchLobbyItem } from '../../models/public-match-lobby.models';

const item: PublicMatchLobbyItem = {
  matchId: 'm1',
  host: 'juancho',
  gamesToPlay: 3,
  totalSlots: 2,
  occupiedSlots: 1,
  status: 'WAITING_FOR_PLAYERS',
  joinCode: 'ABC123',
};

function createCard(overrides: Partial<{ own: boolean; busy: boolean; item: PublicMatchLobbyItem }> = {}) {
  TestBed.configureTestingModule({ imports: [PublicMatchCardComponent] });
  const fixture = TestBed.createComponent(PublicMatchCardComponent);
  fixture.componentRef.setInput('item', overrides.item ?? item);
  if (overrides.own !== undefined) fixture.componentRef.setInput('own', overrides.own);
  if (overrides.busy !== undefined) fixture.componentRef.setInput('busy', overrides.busy);
  fixture.detectChanges();
  return fixture;
}

describe('PublicMatchCardComponent', () => {
  it('muestra host, formato y lugares', () => {
    const fixture = createCard();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('juancho');
    expect(text).toContain('Mejor de 3');
    expect(text).toContain('1/2');
    expect(text).toContain('Unirse');
  });

  it('marca la partida propia y cambia la acción', () => {
    const fixture = createCard({ own: true });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Tuya');
    expect(text).toContain('Ir a tu partida');
  });

  it('emite act al tocar la acción', () => {
    const fixture = createCard();
    let emitted: PublicMatchLobbyItem | null = null;
    fixture.componentInstance.act.subscribe((i) => (emitted = i));
    fixture.nativeElement.querySelector('button').click();
    expect(emitted).toEqual(item);
  });

  it('no se puede unir si no hay joinCode y no es propia', () => {
    const fixture = createCard({ item: { ...item, joinCode: null } });
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
