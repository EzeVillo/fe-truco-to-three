import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { OnlineMatchPageComponent } from './online-match-page.component';
import { MatchesApiService } from '../../services/matches-api.service';

function setup(apiMock: Partial<MatchesApiService>) {
  TestBed.configureTestingModule({
    imports: [OnlineMatchPageComponent],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: MatchesApiService, useValue: apiMock },
    ],
  });
}

describe('OnlineMatchPageComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── US1: crear partida privada ───────────────────────────────────────────

  it('crea una partida privada con el formato elegido y navega a /match/:id', () => {
    const createSpy = vi.fn().mockReturnValue(of({ matchId: 'm1', joinCode: 'ABC123', visibility: 'PRIVATE' }));
    setup({ createPrivateMatch: createSpy });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    const navSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
    fixture.detectChanges();

    fixture.componentInstance.onChangeFormat('BEST_OF_5');
    fixture.componentInstance.onCreate();

    expect(createSpy).toHaveBeenCalledWith({ gamesToPlay: 5, visibility: 'PRIVATE' });
    expect(navSpy).toHaveBeenCalledWith(['/match', 'm1'], { state: { joinCode: 'ABC123' } });
  });

  it('persiste el joinCode en sessionStorage al crear (recuperable tras recarga)', () => {
    setup({ createPrivateMatch: () => of({ matchId: 'm2', joinCode: 'XYZ789', visibility: 'PRIVATE' }) });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    vi.spyOn(fixture.componentInstance['router'], 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.componentInstance.onCreate();

    expect(sessionStorage.getItem('t3.joinCode.m2')).toBe('XYZ789');
  });

  it('muestra copy de error de creación sin exponer el mensaje del backend (422)', () => {
    const err = new HttpErrorResponse({ status: 422, error: { message: 'PlayerAlreadyInMatch' } });
    setup({ createPrivateMatch: () => throwError(() => err) });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onCreate();

    expect(fixture.componentInstance.creating()).toBe(false);
    expect(fixture.componentInstance.createError()).toBe('Ya estás en una partida o tenés una revancha pendiente.');
  });

  // ─── US2: unirse por código ────────────────────────────────────────────────

  it('se une con un código MATCH y navega a /match/:targetId', () => {
    const joinSpy = vi.fn().mockReturnValue(of({ targetType: 'MATCH', targetId: 'm9' }));
    setup({ joinByCode: joinSpy });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    const navSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
    fixture.detectChanges();

    fixture.componentInstance.onJoinCodeInput('abc999');
    fixture.componentInstance.onJoin();

    expect(joinSpy).toHaveBeenCalledWith('abc999');
    expect(navSpy).toHaveBeenCalledWith(['/match', 'm9']);
  });

  it('no permite unirse con el input vacío', () => {
    const joinSpy = vi.fn();
    setup({ joinByCode: joinSpy });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onJoinCodeInput('   ');
    expect(fixture.componentInstance.canJoin()).toBe(false);
    fixture.componentInstance.onJoin();
    expect(joinSpy).not.toHaveBeenCalled();
  });

  it('muestra copy de error 404 (código inexistente) al unirse', () => {
    const err = new HttpErrorResponse({ status: 404 });
    setup({ joinByCode: () => throwError(() => err) });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onJoinCodeInput('nope');
    fixture.componentInstance.onJoin();

    expect(fixture.componentInstance.joining()).toBe(false);
    expect(fixture.componentInstance.joinError()).toBe('Ese código no corresponde a ninguna partida.');
  });

  it('si el código no resuelve a MATCH, informa y no navega', () => {
    const navResult = { targetType: 'LEAGUE', targetId: 'l1' } as const;
    setup({ joinByCode: () => of(navResult) });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    const navSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
    fixture.detectChanges();

    fixture.componentInstance.onJoinCodeInput('league-code');
    fixture.componentInstance.onJoin();

    expect(navSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.joinError()).toBe('Ese código no corresponde a una partida.');
  });
});
