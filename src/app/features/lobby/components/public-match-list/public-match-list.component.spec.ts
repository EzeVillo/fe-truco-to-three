import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { PublicMatchListComponent } from './public-match-list.component';
import type { PublicMatchLobbyItem } from '../../models/public-match-lobby.models';
import type { PublicLobbyStatus } from '../../../../shared/public-lobby/public-lobby.types';

const item: PublicMatchLobbyItem = {
  matchId: 'm1',
  host: 'juancho',
  gamesToPlay: 3,
  totalSlots: 2,
  occupiedSlots: 1,
  status: 'WAITING_FOR_PLAYERS',
  joinCode: 'ABC123',
};

function createList(items: PublicMatchLobbyItem[], status: PublicLobbyStatus) {
  TestBed.configureTestingModule({
    imports: [PublicMatchListComponent],
    providers: [provideAnimationsAsync()],
  });
  const fixture = TestBed.createComponent(PublicMatchListComponent);
  fixture.componentRef.setInput('items', items);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return fixture;
}

describe('PublicMatchListComponent', () => {
  it('muestra estado vacío cuando ready sin items', () => {
    const fixture = createList([], 'ready');
    expect(fixture.nativeElement.textContent).toContain('No hay partidas públicas abiertas');
  });

  it('muestra error con reintento cuando status error sin items', () => {
    const fixture = createList([], 'error');
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
  });

  it('renderiza una card por partida', () => {
    const fixture = createList([item, { ...item, matchId: 'm2', host: 'pedro' }], 'ready');
    expect(fixture.nativeElement.querySelectorAll('app-public-match-card')).toHaveLength(2);
  });
});
