import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { RematchDialogComponent } from './rematch-dialog.component';
import { RematchStateService } from '../../services/rematch-state.service';
import { MatchStateService } from '../../services/match-state.service';
import type { RematchSession } from '../../models/rematch.models';

function makeSession(overrides: Partial<RematchSession> = {}): RematchSession {
  return {
    sessionId: 'sid-1',
    originMatchId: 'mid-1',
    status: 'OPEN',
    selfChoice: 'UNDECIDED',
    opponentChoice: 'UNDECIDED',
    expiresAt: Date.now() + 60_000,
    resultMatchId: null,
    ...overrides,
  };
}

class MockRematchStateService {
  session = signal<RematchSession | null>(null);
  errorMessage = signal('');
  accept = vi.fn();
  leave = vi.fn();
}

class MockMatchStateService {
  serverClockOffsetMs = signal(0);
}

class MockDialogRef {
  close = vi.fn();
}

describe('RematchDialogComponent', () => {
  let fixture: ComponentFixture<RematchDialogComponent>;
  let component: RematchDialogComponent;
  let mockRematchState: MockRematchStateService;
  let mockDialogRef: MockDialogRef;

  beforeEach(() => {
    mockRematchState = new MockRematchStateService();
    mockDialogRef = new MockDialogRef();

    TestBed.configureTestingModule({
      imports: [RematchDialogComponent],
      providers: [
        { provide: RematchStateService, useValue: mockRematchState },
        { provide: MatchStateService, useValue: new MockMatchStateService() },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    });

    fixture = TestBed.createComponent(RematchDialogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- estados de UI ---

  it('botón "Revancha" visible cuando canAccept es true (OPEN + UNDECIDED)', () => {
    mockRematchState.session.set(makeSession({ status: 'OPEN', selfChoice: 'UNDECIDED' }));
    fixture.detectChanges();

    const btns = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from<Element>(btns).map((b) => (b as HTMLElement).textContent?.trim());
    expect(labels).toContain('Revancha');
    expect(labels).toContain('Salir');
  });

  it('solo "Salir" visible cuando opponentLeft (CLOSED_BY_LEAVE)', () => {
    mockRematchState.session.set(makeSession({ status: 'CLOSED_BY_LEAVE' }));
    fixture.detectChanges();

    const btns = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from<Element>(btns).map((b) => (b as HTMLElement).textContent?.trim());
    expect(labels).not.toContain('Revancha');
    expect(labels).toContain('Salir');
  });

  it('muestra "El rival no quiere revancha" cuando CLOSED_BY_LEAVE', () => {
    mockRematchState.session.set(makeSession({ status: 'CLOSED_BY_LEAVE' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El rival no quiere revancha');
  });

  it('muestra "Esperando al rival…" cuando selfChoice=WANTS_REMATCH y OPEN', () => {
    mockRematchState.session.set(makeSession({ status: 'OPEN', selfChoice: 'WANTS_REMATCH' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Esperando al rival');
  });

  it('muestra "El rival quiere revancha" cuando opponentWants y OPEN', () => {
    mockRematchState.session.set(makeSession({ status: 'OPEN', opponentChoice: 'WANTS_REMATCH' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El rival quiere revancha');
  });

  it('muestra "La revancha venció" cuando EXPIRED', () => {
    mockRematchState.session.set(makeSession({ status: 'EXPIRED' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La revancha venció');
  });

  it('muestra "¡Revancha! Empezando…" cuando CONFIRMED', () => {
    mockRematchState.session.set(makeSession({ status: 'CONFIRMED', resultMatchId: 'new-mid' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Revancha! Empezando');
  });

  // --- CTAs: solo t3-btn (guardarraíl III) ---

  it('los botones usan t3-btn, nunca mat-flat-button ni color="primary"', () => {
    mockRematchState.session.set(makeSession());
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    for (const btn of Array.from(buttons)) {
      const el = btn as HTMLElement;
      expect(el.hasAttribute('mat-flat-button'), 'no debe usar mat-flat-button').toBe(false);
      expect(el.getAttribute('color')).toBeNull();
      expect(el.classList.contains('t3-btn')).toBe(true);
    }
  });

  // --- acciones ---

  it('click en "Revancha" llama rematchState.accept()', () => {
    mockRematchState.session.set(makeSession({ status: 'OPEN', selfChoice: 'UNDECIDED' }));
    fixture.detectChanges();

    const btns: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const rematchBtn = btns.find((b) => b.textContent?.trim() === 'Revancha');
    rematchBtn?.click();

    expect(mockRematchState.accept).toHaveBeenCalledTimes(1);
  });

  it('click en "Salir" llama rematchState.leave() y cierra el diálogo', () => {
    mockRematchState.session.set(makeSession());
    fixture.detectChanges();

    const btns: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const salirBtn = btns.find((b) => b.textContent?.trim() === 'Salir');
    salirBtn?.click();

    expect(mockRematchState.leave).toHaveBeenCalledTimes(1);
    expect(mockDialogRef.close).toHaveBeenCalledWith({ confirmedMatchId: null });
  });

  it.each(['EXPIRED', 'CLOSED_BY_LEAVE'] as const)(
    'click en "Salir" NO llama leave() cuando status=%s (solo cierra)',
    (status) => {
      mockRematchState.session.set(makeSession({ status }));
      fixture.detectChanges();

      const btns: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      );
      const salirBtn = btns.find((b) => b.textContent?.trim() === 'Salir');
      salirBtn?.click();

      expect(mockRematchState.leave).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ confirmedMatchId: null });
    },
  );

  it('"Salir" sigue habilitado si solo aceptó el jugador (el rival no decidió)', () => {
    mockRematchState.session.set(
      makeSession({ status: 'OPEN', selfChoice: 'WANTS_REMATCH', opponentChoice: 'UNDECIDED' }),
    );
    fixture.detectChanges();

    const btns: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const salirBtn = btns.find((b) => b.textContent?.trim() === 'Salir');
    expect(salirBtn?.disabled).toBe(false);

    salirBtn?.click();
    expect(mockRematchState.leave).toHaveBeenCalledTimes(1);
    expect(mockDialogRef.close).toHaveBeenCalledWith({ confirmedMatchId: null });
  });

  it('muestra loader sin botones cuando ambos aceptaron (revancha inminente)', () => {
    mockRematchState.session.set(
      makeSession({
        status: 'OPEN',
        selfChoice: 'WANTS_REMATCH',
        opponentChoice: 'WANTS_REMATCH',
      }),
    );
    fixture.detectChanges();

    // Ya no hay botón "Salir" deshabilitado: se reemplaza por un loader.
    const btns: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const salirBtn = btns.find((b) => b.textContent?.trim() === 'Salir');
    expect(salirBtn).toBeUndefined();

    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Revancha! Empezando');
  });

  // --- navegación en CONFIRMED ---

  it('cierra el diálogo con confirmedMatchId cuando session pasa a CONFIRMED', async () => {
    mockRematchState.session.set(makeSession({ status: 'OPEN', selfChoice: 'UNDECIDED' }));
    fixture.detectChanges();

    // Simular CONFIRMED
    mockRematchState.session.set(
      makeSession({ status: 'CONFIRMED', resultMatchId: 'new-match-42' }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockDialogRef.close).toHaveBeenCalledWith({ confirmedMatchId: 'new-match-42' });
  });

  // --- error copy: nunca texto crudo del BE ---

  it('muestra errorMessage del catálogo (no crudo del BE)', () => {
    mockRematchState.session.set(makeSession());
    mockRematchState.errorMessage.set('La revancha ya no está disponible.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La revancha ya no está disponible.');
  });
});
