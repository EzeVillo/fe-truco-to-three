import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { InvitationToastComponent } from './invitation-toast.component';
import { SocialStore } from '../../services/social.store';
import type { IncomingResourceInvitation } from '../../../../core/models/social.models';

const incomingInvitationToast = signal<IncomingResourceInvitation | null>(null);
const storeMock = {
  incomingInvitationToast,
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  dismissInvitationToast: vi.fn(),
};
const routerMock = { navigate: vi.fn() };

function invitation(): IncomingResourceInvitation {
  return {
    invitationId: 'inv-1',
    senderUsername: 'leo',
    targetType: 'MATCH',
    targetId: 'match-1',
    status: 'PENDING',
    expiresAt: 1000,
  };
}

describe('InvitationToastComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    incomingInvitationToast.set(null);
    TestBed.configureTestingModule({
      imports: [InvitationToastComponent],
      providers: [
        { provide: SocialStore, useValue: storeMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(InvitationToastComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('no renderiza nada sin invitación', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.invitation-toast')).toBeNull();
  });

  it('renderiza el toast con el remitente', () => {
    incomingInvitationToast.set(invitation());
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.invitation-toast')).not.toBeNull();
    expect(el.textContent).toContain('leo');
  });

  it('aceptar: llama acceptInvitation y navega al match por fallback', () => {
    incomingInvitationToast.set(invitation());
    storeMock.acceptInvitation.mockImplementation((_id: string, onJoined: (t: string) => void) =>
      onJoined('match-1'),
    );
    const fixture = render();
    fixture.debugElement
      .query(By.css('.friend-request-toast__btn--primary'))
      .nativeElement.dispatchEvent(new MouseEvent('click'));
    expect(storeMock.acceptInvitation).toHaveBeenCalledWith('inv-1', expect.any(Function));
    expect(routerMock.navigate).toHaveBeenCalledWith(['/match', 'match-1']);
  });

  it('rechazar: llama declineInvitation', () => {
    incomingInvitationToast.set(invitation());
    const fixture = render();
    fixture.debugElement
      .query(By.css('.friend-request-toast__btn--danger'))
      .nativeElement.dispatchEvent(new MouseEvent('click'));
    expect(storeMock.declineInvitation).toHaveBeenCalledWith('inv-1');
  });

  it('no muestra cierre manual: la invitaciÃ³n se resuelve aceptando o rechazando', () => {
    incomingInvitationToast.set(invitation());
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.invitation-toast__close')).toBeNull();
    expect(storeMock.declineInvitation).not.toHaveBeenCalled();
  });
});
