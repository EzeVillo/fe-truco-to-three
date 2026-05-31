import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { WaitingRoomComponent, WaitingRoomClipboard } from './waiting-room.component';

function setup(clipboardMock?: Partial<WaitingRoomClipboard>) {
  TestBed.configureTestingModule({
    imports: [WaitingRoomComponent],
    providers: [
      provideAnimationsAsync(),
      ...(clipboardMock ? [{ provide: WaitingRoomClipboard, useValue: clipboardMock }] : []),
    ],
  });
}

describe('WaitingRoomComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('anfitrión sin rival: muestra el código y "Esperando rival…", Iniciar deshabilitado', () => {
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
    expect((startBtn.nativeElement as HTMLButtonElement).textContent?.trim()).toBe('Esperando al rival...');
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

  it('copiar el código usa el clipboard y marca "¡Copiado!"', async () => {
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
});
