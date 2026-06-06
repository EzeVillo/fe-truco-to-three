import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InviteFriendPickerComponent } from './invite-friend-picker.component';
import { SocialStore } from '../../services/social.store';
import type {
  FriendSummary,
  OutgoingResourceInvitation,
} from '../../../../core/models/social.models';

function friend(overrides: Partial<FriendSummary> & { friendUsername: string }): FriendSummary {
  return {
    online: false,
    availability: 'AVAILABLE',
    busyReason: null,
    ...overrides,
  };
}

describe('InviteFriendPickerComponent', () => {
  const friends = signal<FriendSummary[]>([]);
  const inviteActionError = signal<string | null>(null);
  const outgoingInvitations = signal<OutgoingResourceInvitation[]>([]);

  beforeEach(() => {
    friends.set([]);
    inviteActionError.set(null);
    outgoingInvitations.set([]);
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [InviteFriendPickerComponent],
      providers: [
        {
          provide: SocialStore,
          useValue: {
            friends,
            inviteActionError,
            outgoingInvitations,
            start: () => undefined,
            bootstrap: () => undefined,
            clearInviteActionError: () => undefined,
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render(matchId: string | null = 'match-1') {
    const fixture = TestBed.createComponent(InviteFriendPickerComponent);
    fixture.componentRef.setInput('matchId', matchId);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra estado vacío sin amigos', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.invite-picker__empty')).not.toBeNull();
  });

  it('habilita invitar para AVAILABLE+online y deshabilita (con motivo) para BUSY+online', () => {
    friends.set([
      friend({ friendUsername: 'ana', online: true }),
      friend({
        friendUsername: 'leo',
        online: true,
        availability: 'BUSY',
        busyReason: 'IN_MATCH',
      }),
    ]);
    const el = render().nativeElement as HTMLElement;
    const rows = el.querySelectorAll('.invite-picker__row');
    expect(rows).toHaveLength(2);
    // ana: botón invitar presente
    expect(rows[0].querySelector('button.invite-picker__action')).not.toBeNull();
    // leo: sin botón, con motivo
    expect(rows[1].querySelector('button.invite-picker__action')).toBeNull();
    expect(rows[1].querySelector('.invite-picker__reason')?.textContent).toContain('En partida');
  });

  it('AVAILABLE pero offline: oculta el botón y no muestra motivo', () => {
    friends.set([friend({ friendUsername: 'ana', online: false })]);
    const el = render().nativeElement as HTMLElement;
    const row = el.querySelector('.invite-picker__row')!;
    expect(row.querySelector('button.invite-picker__action')).toBeNull();
    expect(row.querySelector('.invite-picker__reason')).toBeNull();
  });

  it('BUSY y offline: no muestra motivo (prevalece offline)', () => {
    friends.set([
      friend({
        friendUsername: 'leo',
        online: false,
        availability: 'BUSY',
        busyReason: 'IN_MATCH',
      }),
    ]);
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.invite-picker__reason')).toBeNull();
  });

  it('emite invite(username) al tocar Invitar de un AVAILABLE+online', () => {
    friends.set([friend({ friendUsername: 'ana', online: true })]);
    const fixture = render();
    const emitted: string[] = [];
    fixture.componentInstance.invite.subscribe((u) => emitted.push(u));
    (
      fixture.nativeElement.querySelector('button.invite-picker__action') as HTMLButtonElement
    ).click();
    expect(emitted).toEqual(['ana']);
  });

  it('muestra el error de acción del store', () => {
    inviteActionError.set('No se pudo invitar.');
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.invite-picker__error')?.textContent).toContain('No se pudo invitar.');
  });

  it('deshabilita todos los botones cuando ya hay una invitación pendiente para esta partida', () => {
    friends.set([
      friend({ friendUsername: 'ana', online: true }),
      friend({ friendUsername: 'leo', online: true }),
    ]);
    outgoingInvitations.set([
      {
        invitationId: 'inv-1',
        recipientUsername: 'ana',
        targetType: 'MATCH',
        targetId: 'match-1',
        status: 'PENDING',
        expiresAt: Date.now() + 60000,
      },
    ]);
    const el = render('match-1').nativeElement as HTMLElement;
    const rows = el.querySelectorAll('.invite-picker__row');
    expect(rows[0].querySelector('button.invite-picker__action')).toBeNull();
    expect(rows[1].querySelector('button.invite-picker__action')).toBeNull();
    expect(rows[0].querySelector('.invite-picker__reason')?.textContent).toContain(
      'Invitación enviada',
    );
    expect(rows[1].querySelector('.invite-picker__reason')?.textContent).toContain(
      'Invitación enviada',
    );
  });

  it('deshabilita el resto de botones mientras se envía una invitación (in-flight)', () => {
    friends.set([
      friend({ friendUsername: 'ana', online: true }),
      friend({ friendUsername: 'leo', online: true }),
    ]);
    const fixture = render('match-1');
    const emitted: string[] = [];
    fixture.componentInstance.invite.subscribe((u) => emitted.push(u));

    const rows = fixture.nativeElement.querySelectorAll('.invite-picker__row');
    (rows[0].querySelector('button.invite-picker__action') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Emitió el evento
    expect(emitted).toEqual(['ana']);
    // La fila de ana muestra "Invitando…"
    expect(rows[0].querySelector('.invite-picker__reason')?.textContent).toContain('Invitando');
    // La fila de leo muestra "Invitación enviada"
    expect(rows[1].querySelector('.invite-picker__reason')?.textContent).toContain(
      'Invitación enviada',
    );
    // Ninguna fila tiene botón
    expect(rows[0].querySelector('button.invite-picker__action')).toBeNull();
    expect(rows[1].querySelector('button.invite-picker__action')).toBeNull();
  });

  it('limpia el estado in-flight cuando la invitación aparece en el store', () => {
    friends.set([friend({ friendUsername: 'ana', online: true })]);
    const fixture = render('match-1');
    const btn = fixture.nativeElement.querySelector(
      'button.invite-picker__action',
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    // Estado in-flight: sin botón
    expect(fixture.nativeElement.querySelector('button.invite-picker__action')).toBeNull();

    // Simular que el store recibió la invitación
    outgoingInvitations.set([
      {
        invitationId: 'inv-1',
        recipientUsername: 'ana',
        targetType: 'MATCH',
        targetId: 'match-1',
        status: 'PENDING',
        expiresAt: Date.now() + 60000,
      },
    ]);
    fixture.detectChanges();

    // Sigue sin botón (porque hay pending), pero el texto ya no dice "Invitando…"
    expect(fixture.nativeElement.querySelector('button.invite-picker__action')).toBeNull();
    expect(fixture.nativeElement.querySelector('.invite-picker__reason')?.textContent).toContain(
      'Invitación enviada',
    );
  });

  it('limpia el estado in-flight ante un error del store', () => {
    friends.set([friend({ friendUsername: 'ana', online: true })]);
    const fixture = render('match-1');
    const btn = fixture.nativeElement.querySelector(
      'button.invite-picker__action',
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    // Estado in-flight
    expect(fixture.nativeElement.querySelector('button.invite-picker__action')).toBeNull();

    // Error del store
    inviteActionError.set('No se pudo invitar.');
    fixture.detectChanges();

    // El botón vuelve a estar disponible (no hay pending en store)
    expect(fixture.nativeElement.querySelector('button.invite-picker__action')).not.toBeNull();
  });

  it('limpia el estado in-flight tras el timeout de seguridad', () => {
    friends.set([friend({ friendUsername: 'ana', online: true })]);
    const fixture = render('match-1');
    const btn = fixture.nativeElement.querySelector(
      'button.invite-picker__action',
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button.invite-picker__action')).toBeNull();

    vi.advanceTimersByTime(8001);
    fixture.detectChanges();

    // El botón vuelve a estar disponible
    expect(fixture.nativeElement.querySelector('button.invite-picker__action')).not.toBeNull();
  });
});
