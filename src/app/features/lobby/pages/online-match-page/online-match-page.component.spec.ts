import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { EMPTY, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { OnlineMatchPageComponent } from './online-match-page.component';
import { MatchesApiService } from '../../services/matches-api.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { SocialStore } from '../../../social/services/social.store';

function setup(
  apiMock: Partial<MatchesApiService>,
  joinCode: string | null = null,
  inviteFriend: string | null = null,
) {
  // El store del lobby (provisto en el componente) llama listPublicMatches al
  // arrancar y se suscribe al topic; damos defaults para que no rompa el TestBed.
  const api: Partial<MatchesApiService> = {
    listPublicMatches: () => of({ items: [], nextCursor: null }),
    ...apiMock,
  };

  TestBed.configureTestingModule({
    imports: [OnlineMatchPageComponent],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: MatchesApiService, useValue: api },
      {
        provide: WebSocketService,
        useValue: { connect: vi.fn(), connected: EMPTY, subscribe: () => EMPTY },
      },
      {
        provide: SocialStore,
        useValue: { inviteFriend: vi.fn() },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: (key: string) => (key === 'joinCode' ? joinCode : null),
            },
            queryParamMap: {
              get: (key: string) => (key === 'inviteFriend' ? inviteFriend : null),
            },
          },
        },
      },
    ],
  });
}

describe('OnlineMatchPageComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── US1: crear partida privada ───────────────────────────────────────────

  it('crea una partida privada con el formato elegido y navega a /match/:id', () => {
    const createSpy = vi
      .fn()
      .mockReturnValue(of({ matchId: 'm1', joinCode: 'ABC123', visibility: 'PRIVATE' }));
    setup({ createMatch: createSpy });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    const navSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
    fixture.detectChanges();

    fixture.componentInstance.onChangeFormat('BEST_OF_5');
    fixture.componentInstance.onCreate();

    expect(createSpy).toHaveBeenCalledWith({ gamesToPlay: 5, visibility: 'PRIVATE' });
    expect(navSpy).toHaveBeenCalledWith(['/match', 'm1'], { state: { joinCode: 'ABC123' } });
  });

  it('crea una partida pública cuando se elige visibilidad PUBLIC', () => {
    const createSpy = vi
      .fn()
      .mockReturnValue(of({ matchId: 'mp', joinCode: 'PUB123', visibility: 'PUBLIC' }));
    setup({ createMatch: createSpy });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    vi.spyOn(fixture.componentInstance['router'], 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.componentInstance.onChangeVisibility('PUBLIC');
    fixture.componentInstance.onCreate();

    expect(createSpy).toHaveBeenCalledWith({ gamesToPlay: 3, visibility: 'PUBLIC' });
  });

  it('desde Amigos oculta lobby, unirse por codigo y selector de visibilidad', () => {
    setup(
      { createMatch: () => of({ matchId: 'm', joinCode: 'C', visibility: 'PRIVATE' }) },
      null,
      'martina',
    );
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Invitar a partida');
    expect(text).toContain('Crear e invitar');
    expect(text).not.toContain('Partidas públicas');
    expect(text).not.toContain('Unirme con código');
    expect(fixture.nativeElement.querySelector('app-visibility-selector')).toBeNull();
  });

  it('desde Amigos crea privada, invita al amigo y navega con joinCode visible en sala', () => {
    const createSpy = vi
      .fn()
      .mockReturnValue(of({ matchId: 'mf', joinCode: 'FRIEND1', visibility: 'PRIVATE' }));
    setup({ createMatch: createSpy }, null, 'martina');
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    const navSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
    const social = TestBed.inject(SocialStore) as unknown as {
      inviteFriend: ReturnType<typeof vi.fn>;
    };
    fixture.detectChanges();

    fixture.componentInstance.onChangeVisibility('PUBLIC');
    fixture.componentInstance.onCreate();

    expect(createSpy).toHaveBeenCalledWith({ gamesToPlay: 3, visibility: 'PRIVATE' });
    expect(social.inviteFriend).toHaveBeenCalledWith('martina', 'mf');
    expect(navSpy).toHaveBeenCalledWith(['/match', 'mf'], { state: { joinCode: 'FRIEND1' } });
  });

  it('por defecto la visibilidad es PRIVATE', () => {
    setup({ createMatch: () => of({ matchId: 'm', joinCode: 'C', visibility: 'PRIVATE' }) });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.visibility()).toBe('PRIVATE');
  });

  it('persiste el joinCode en sessionStorage al crear (recuperable tras recarga)', () => {
    setup({ createMatch: () => of({ matchId: 'm2', joinCode: 'XYZ789', visibility: 'PRIVATE' }) });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    vi.spyOn(fixture.componentInstance['router'], 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.componentInstance.onCreate();

    expect(sessionStorage.getItem('t3.joinCode.m2')).toBe('XYZ789');
  });

  it('muestra copy de error de creación sin exponer el mensaje del backend (422)', () => {
    const err = new HttpErrorResponse({ status: 422, error: { message: 'PlayerAlreadyInMatch' } });
    setup({ createMatch: () => throwError(() => err) });
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onCreate();

    expect(fixture.componentInstance.creating()).toBe(false);
    expect(fixture.componentInstance.createError()).toBe(
      'Ya estás en una partida o tenés una revancha pendiente.',
    );
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

  it('si entra por /join/:joinCode, precarga el código y dispara el join automático', () => {
    const joinSpy = vi.fn().mockReturnValue(of({ targetType: 'MATCH', targetId: 'm10' }));
    setup({ joinByCode: joinSpy }, 'INVITE42');
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    const navSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
    fixture.detectChanges();

    expect(fixture.componentInstance.joinCodeInput()).toBe('INVITE42');
    expect(joinSpy).toHaveBeenCalledWith('INVITE42');
    expect(navSpy).toHaveBeenCalledWith(['/match', 'm10']);
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
    expect(fixture.componentInstance.joinError()).toBe(
      'Ese código no corresponde a ninguna partida.',
    );
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

  it('en modo enlace oculta la creación de partida', () => {
    setup({ joinByCode: () => of({ targetType: 'MATCH', targetId: 'm11' }) }, 'INVITE42');
    const fixture = TestBed.createComponent(OnlineMatchPageComponent);
    vi.spyOn(fixture.componentInstance['router'], 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Crear partida');
    expect(fixture.nativeElement.textContent).toContain('Unirme con enlace');
  });
});
