import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  WaitingRoomClipboard,
  WaitingRoomComponent,
  WaitingRoomLinkSharer,
} from './waiting-room.component';
import { SocialStore } from '../../../social/services/social.store';
import type { OutgoingResourceInvitation } from '../../../../core/models/social.models';

// Fake del SocialStore compartido por el componente y el picker embebido.
const friends = signal<unknown[]>([]);
const inviteActionError = signal<string | null>(null);
const outgoingInvitations = signal<OutgoingResourceInvitation[]>([]);
const socialMock = {
  friends,
  inviteActionError,
  outgoingInvitations,
  start: vi.fn(),
  bootstrap: vi.fn(),
  clearInviteActionError: vi.fn(),
  inviteFriend: vi.fn(),
  cancelInvitation: vi.fn(),
};

function setup(
  clipboardMock?: Partial<WaitingRoomClipboard>,
  linkSharerMock?: Partial<WaitingRoomLinkSharer>,
) {
  TestBed.configureTestingModule({
    imports: [WaitingRoomComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: SocialStore, useValue: socialMock },
      ...(clipboardMock ? [{ provide: WaitingRoomClipboard, useValue: clipboardMock }] : []),
      ...(linkSharerMock ? [{ provide: WaitingRoomLinkSharer, useValue: linkSharerMock }] : []),
    ],
  });
}

describe('WaitingRoomComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    friends.set([]);
    inviteActionError.set(null);
    outgoingInvitations.set([]);
  });

  it('anfitrion sin rival en flujo normal: muestra codigo y deja Iniciar deshabilitado', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('joinCode', 'ABC123');
    fixture.componentRef.setInput('hostUsername', 'juancho');
    fixture.componentRef.setInput('rivalPresent', false);
    fixture.componentRef.setInput('canStart', false);
    fixture.detectChanges();

    const code = fixture.debugElement.query(By.css('.waiting-room__code'));
    expect((code.nativeElement as HTMLElement).textContent?.trim()).toBe('ABC123');

    const empty = fixture.debugElement.query(By.css('.waiting-room__player-name--empty'));
    expect(empty).toBeTruthy();

    const startBtn = fixture.debugElement.query(By.css('.waiting-room__start'));
    expect((startBtn.nativeElement as HTMLButtonElement).disabled).toBe(true);
  });

  it('anfitrion: muestra codigo aunque el flujo haya pedido ocultar controles', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('joinCode', 'ABC123');
    fixture.componentRef.setInput('hostUsername', 'juancho');
    fixture.componentRef.setInput('rivalPresent', false);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.waiting-room__code-block'))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('ABC123');
  });

  it('anfitrion con rival presente: "Estoy listo" habilitado y emite start', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('rivalUsername', 'martina');
    fixture.componentRef.setInput('rivalPresent', true);
    fixture.componentRef.setInput('canStart', true);
    fixture.detectChanges();

    const startBtn = fixture.debugElement.query(By.css('.waiting-room__start'));
    expect((startBtn.nativeElement as HTMLButtonElement).disabled).toBe(false);
    expect((startBtn.nativeElement as HTMLButtonElement).textContent?.trim()).toBe('Estoy listo');

    const spy = vi.fn();
    fixture.componentInstance.start.subscribe(spy);
    (startBtn.nativeElement as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('invitado con rival presente: no muestra codigo y puede marcarse listo', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', false);
    fixture.componentRef.setInput('hostUsername', 'juancho');
    fixture.componentRef.setInput('rivalUsername', 'martina');
    fixture.componentRef.setInput('rivalPresent', true);
    fixture.componentRef.setInput('canStart', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.waiting-room__code-block'))).toBeNull();
    const startBtn = fixture.debugElement.query(By.css('.waiting-room__start'));
    expect(startBtn).toBeTruthy();
    expect((startBtn.nativeElement as HTMLButtonElement).disabled).toBe(false);
    expect((startBtn.nativeElement as HTMLButtonElement).textContent?.trim()).toBe('Estoy listo');
    expect(fixture.nativeElement.textContent).toContain('Cuando ambos confirmen');
  });

  it('muestra que el rival ya esta listo cuando llega su confirmacion', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('hostUsername', 'juancho');
    fixture.componentRef.setInput('rivalUsername', 'martina');
    fixture.componentRef.setInput('rivalPresent', true);
    fixture.componentRef.setInput('canStart', true);
    fixture.componentRef.setInput('opponentReady', true);
    fixture.componentRef.setInput('rivalReady', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El rival ya esta listo.');
    expect(fixture.nativeElement.textContent).toContain('Listo');
  });

  it('cuando el visor ya esta listo deshabilita el boton y espera al rival', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', false);
    fixture.componentRef.setInput('hostUsername', 'juancho');
    fixture.componentRef.setInput('rivalUsername', 'martina');
    fixture.componentRef.setInput('rivalPresent', true);
    fixture.componentRef.setInput('canStart', true);
    fixture.componentRef.setInput('selfReady', true);
    fixture.detectChanges();

    const startBtn = fixture.debugElement.query(By.css('.waiting-room__start'));
    expect((startBtn.nativeElement as HTMLButtonElement).disabled).toBe(true);
    expect((startBtn.nativeElement as HTMLButtonElement).textContent?.trim()).toBe(
      'Esperando al rival...',
    );
    expect(fixture.nativeElement.textContent).toContain('Esperando a que el rival confirme.');
  });

  it('emite leave al pulsar Salir', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.leave.subscribe(spy);
    const leaveBtn = fixture.debugElement.query(By.css('.waiting-room__leave'));
    (leaveBtn.nativeElement as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('copiar el codigo usa el clipboard y marca "Copiado"', async () => {
    const copySpy = vi.fn().mockResolvedValue(true);
    setup({ copy: copySpy });
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('joinCode', 'ABC123');
    fixture.detectChanges();

    await fixture.componentInstance.onCopy();
    expect(copySpy).toHaveBeenCalledWith('ABC123');
    expect(fixture.componentInstance.copied()).toBe(true);
  });

  it('compartir el enlace usa la URL canonica de invitacion', async () => {
    const shareSpy = vi.fn().mockResolvedValue(true);
    setup(undefined, { share: shareSpy });
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('joinCode', 'ABC123');
    fixture.detectChanges();

    await fixture.componentInstance.onShareLink();
    expect(shareSpy).toHaveBeenCalledWith(expect.stringContaining('/join/ABC123'));
    expect(fixture.componentInstance.linkShareState()).toBe('shared');
  });

  it('si no hay Web Share API, copia el enlace', async () => {
    const copySpy = vi.fn().mockResolvedValue(true);
    setup({ copy: copySpy }, { share: vi.fn().mockResolvedValue(false) });
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('joinCode', 'ABC123');
    fixture.detectChanges();

    await fixture.componentInstance.onShareLink();
    expect(copySpy).toHaveBeenCalledWith(expect.stringContaining('/join/ABC123'));
    expect(fixture.componentInstance.linkShareState()).toBe('copied');
  });

  // ─── Invitar amigos (feature 025, US1/US3) ─────────────────────────────────

  it('anfitrión sin rival: muestra el botón "Invitar amigo" y abre el picker', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('matchId', 'match-1');
    fixture.componentRef.setInput('rivalPresent', false);
    fixture.detectChanges();

    const toggle = fixture.debugElement.query(By.css('.waiting-room__invite-toggle'));
    expect(toggle).toBeTruthy();
    expect(fixture.debugElement.query(By.css('app-invite-friend-picker'))).toBeNull();

    (toggle.nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-invite-friend-picker'))).toBeTruthy();
  });

  it('no muestra invitar si hay rival presente', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('matchId', 'match-1');
    fixture.componentRef.setInput('rivalPresent', true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.waiting-room__invite-toggle'))).toBeNull();
  });

  it('onInvitePicked() invita por el store con el matchId', () => {
    setup();
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('matchId', 'match-1');
    fixture.detectChanges();

    fixture.componentInstance.onInvitePicked('martina');
    expect(socialMock.inviteFriend).toHaveBeenCalledWith('martina', 'match-1');
  });

  it('lista las invitaciones enviadas de esta partida y permite cancelar', () => {
    setup();
    outgoingInvitations.set([
      {
        invitationId: 'inv-1',
        recipientUsername: 'martina',
        targetType: 'MATCH',
        targetId: 'match-1',
        status: 'PENDING',
        expiresAt: 1000,
      },
      {
        invitationId: 'inv-2',
        recipientUsername: 'otra',
        targetType: 'MATCH',
        targetId: 'otro-match',
        status: 'PENDING',
        expiresAt: 1000,
      },
    ]);
    const fixture = TestBed.createComponent(WaitingRoomComponent);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('matchId', 'match-1');
    fixture.componentRef.setInput('rivalPresent', false);
    fixture.detectChanges();

    const sent = fixture.debugElement.queryAll(By.css('.waiting-room__invite-sent'));
    expect(sent).toHaveLength(1); // sólo la de match-1
    expect((sent[0].nativeElement as HTMLElement).textContent).toContain('martina');

    const cancelBtn = sent[0].query(By.css('.waiting-room__invite-cancel'));
    (cancelBtn.nativeElement as HTMLButtonElement).click();
    expect(socialMock.cancelInvitation).toHaveBeenCalledWith('inv-1');
  });
});
