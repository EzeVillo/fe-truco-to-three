import { HttpErrorResponse } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocketService } from '../../../../core/services/websocket.service';
import type { MatchWsEvent } from '../../../match/models/match-ws-events';
import { MatchesApiService } from '../../services/matches-api.service';
import { QuickMatchPageComponent } from './quick-match-page.component';

function setup() {
  const matchEvents$ = new Subject<MatchWsEvent>();
  const apiMock = {
    enterQuickMatch: vi.fn(),
    cancelQuickMatch: vi.fn(),
  };
  const webSocketMock = {
    connect: vi.fn(),
    subscribe: vi.fn(() => matchEvents$.asObservable()),
  };

  TestBed.configureTestingModule({
    imports: [QuickMatchPageComponent],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: MatchesApiService, useValue: apiMock },
      { provide: WebSocketService, useValue: webSocketMock },
    ],
  });

  const fixture = TestBed.createComponent(QuickMatchPageComponent);
  const router = TestBed.inject(Router);
  const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  return {
    fixture,
    component: fixture.componentInstance,
    apiMock,
    webSocketMock,
    matchEvents$,
    navigateSpy,
    navigateByUrlSpy,
  };
}

describe('QuickMatchPageComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('usa BEST_OF_3 por default y se suscribe a eventos de match', () => {
    const { component, webSocketMock } = setup();

    expect(component.seriesFormat()).toBe('BEST_OF_3');
    expect(component.selectedFormatLabel()).toBe('Mejor de 3');
    expect(webSocketMock.connect).toHaveBeenCalled();
    expect(webSocketMock.subscribe).toHaveBeenCalledWith('/user/queue/match');
  });

  it('envía gamesToPlay: 3 al buscar con el default', () => {
    const { component, apiMock } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'SEARCHING', matchId: null, enqueuedAt: '2026-05-20T10:00:00Z' }),
    );

    component.onSearch();

    expect(apiMock.enterQuickMatch).toHaveBeenCalledWith({ gamesToPlay: 3 });
    expect(component.state()).toBe('searching');
  });

  it('envía gamesToPlay según el formato elegido', () => {
    const { component, apiMock } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'SEARCHING', matchId: null, enqueuedAt: '2026-05-20T10:00:00Z' }),
    );

    component.onChangeFormat('BEST_OF_5');
    component.onSearch();

    expect(apiMock.enterQuickMatch).toHaveBeenCalledWith({ gamesToPlay: 5 });
  });

  it('renderiza estado SEARCHING con enqueuedAt y formato elegido', () => {
    const { fixture, component, apiMock } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'SEARCHING', matchId: null, enqueuedAt: '2026-05-20T10:00:00Z' }),
    );

    component.onSearch();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Buscando rival');
    expect(text).toContain('Serie Mejor de 3');
    expect(text).toContain('2026-05-20T10:00:00Z');
  });

  it('cancela búsqueda y vuelve a idle', () => {
    const { component, apiMock } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'SEARCHING', matchId: null, enqueuedAt: '2026-05-20T10:00:00Z' }),
    );
    apiMock.cancelQuickMatch.mockReturnValue(of(void 0));

    component.onSearch();
    component.cancelSearch();

    expect(apiMock.cancelQuickMatch).toHaveBeenCalled();
    expect(component.state()).toBe('idle');
    expect(component.enqueuedAt()).toBeNull();
  });

  it('volver al lobby durante búsqueda cancela antes de navegar', () => {
    const { component, apiMock, navigateByUrlSpy } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'SEARCHING', matchId: null, enqueuedAt: '2026-05-20T10:00:00Z' }),
    );
    apiMock.cancelQuickMatch.mockReturnValue(of(void 0));

    component.onSearch();
    component.goBack();

    expect(apiMock.cancelQuickMatch).toHaveBeenCalled();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/lobby');
  });

  it('navega directo si la respuesta REST es MATCHED', () => {
    const { component, apiMock, navigateSpy } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'MATCHED', matchId: 'm-quick', enqueuedAt: '2026-05-20T10:00:00Z' }),
    );

    component.onSearch();

    expect(component.state()).toBe('matched');
    expect(navigateSpy).toHaveBeenCalledWith(['/match', 'm-quick']);
  });

  it('navega con GAME_STARTED mientras está buscando', () => {
    const { component, apiMock, matchEvents$, navigateSpy } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'SEARCHING', matchId: null, enqueuedAt: '2026-05-20T10:00:00Z' }),
    );

    component.onSearch();
    matchEvents$.next({
      matchId: 'm-ws',
      eventType: 'GAME_STARTED',
      timestamp: 1772768158123,
      payload: { gameNumber: 1 },
      stateVersion: 1,
    });

    expect(component.state()).toBe('matched');
    expect(navigateSpy).toHaveBeenCalledWith(['/match', 'm-ws']);
  });

  it('ignora eventos no GAME_STARTED o sin búsqueda activa', () => {
    const { component, apiMock, matchEvents$, navigateSpy } = setup();

    matchEvents$.next({
      matchId: 'm-idle',
      eventType: 'GAME_STARTED',
      timestamp: 1772768158123,
      payload: { gameNumber: 1 },
      stateVersion: 1,
    });
    expect(navigateSpy).not.toHaveBeenCalled();

    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'SEARCHING', matchId: null, enqueuedAt: '2026-05-20T10:00:00Z' }),
    );
    component.onSearch();
    matchEvents$.next({
      matchId: 'm-turn',
      eventType: 'TURN_CHANGED',
      timestamp: 1772768158124,
      payload: {},
      stateVersion: 2,
    });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('muestra copy controlado para error 422 de búsqueda', () => {
    const { fixture, component, apiMock } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'PlayerAlreadyInMatchException' },
          }),
      ),
    );

    component.onSearch();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.state()).toBe('error');
    expect(text).toContain(
      'Ya estás en una partida, una revancha pendiente o una búsqueda activa.',
    );
    expect(text).not.toContain('PlayerAlreadyInMatchException');
  });

  it('muestra copy recuperable para error de red y permite reintentar', () => {
    const { component, apiMock } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0, error: { message: 'offline' } })),
    );

    component.onSearch();

    expect(component.state()).toBe('error');
    expect(component.canSearch()).toBe(true);
    expect(component.error()).toBe('No pudimos buscar rival. Reintentá en unos segundos.');
  });

  it('mantiene estado recuperable si falla la cancelación', () => {
    const { component, apiMock } = setup();
    apiMock.enterQuickMatch.mockReturnValue(
      of({ status: 'SEARCHING', matchId: null, enqueuedAt: '2026-05-20T10:00:00Z' }),
    );
    apiMock.cancelQuickMatch.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'boom' } })),
    );

    component.onSearch();
    component.cancelSearch();

    expect(component.state()).toBe('error');
    expect(component.error()).toBe('No pudimos buscar rival. Reintentá en unos segundos.');
  });
});
