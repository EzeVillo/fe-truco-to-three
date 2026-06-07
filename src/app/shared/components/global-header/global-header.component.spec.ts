import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { GlobalHeaderComponent } from './global-header.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { SessionStorageService } from '../../../core/auth/session-storage.service';
import { PresenceCoordinatorService } from '../../../core/services/presence-coordinator.service';
import { SpectatorCountStore } from '../../services/spectator-count.store';
import { ConfirmLogoutDialogComponent } from '../confirm-logout-dialog/confirm-logout-dialog.component';
import type { FullAuthResponse } from '../../../core/models/auth.models';
import type { UserPresenceResponse } from '../../../core/models/presence.models';

const FULL_AUTH: FullAuthResponse = {
  playerId: 'p-1',
  username: 'juancho',
  accessToken: 'tok',
  refreshToken: 'rt',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

function setupStorageMock(): void {
  const fakeStorage: Record<string, string> = {};
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => fakeStorage[k] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => {
    fakeStorage[k] = v;
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((k) => {
    delete fakeStorage[k];
  });
}

function setupTestBed(dialogMock: Partial<MatDialog>, busy = false) {
  setupStorageMock();
  const presenceBusy = signal(busy);
  const presence = signal<UserPresenceResponse | null>(null);

  TestBed.configureTestingModule({
    imports: [GlobalHeaderComponent],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
      SessionStorageService,
      AuthStore,
      { provide: PresenceCoordinatorService, useValue: { busy: presenceBusy, presence } },
      { provide: MatDialog, useValue: dialogMock },
    ],
  });

  return { presenceBusy, presence };
}

function openMenu(fixture: ComponentFixture<GlobalHeaderComponent>): void {
  fixture.debugElement.query(By.css('.global-header__menu-button')).nativeElement.click();
  fixture.detectChanges();
}

describe('GlobalHeaderComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marca siempre visible; sin sesion NO muestra menu', () => {
    setupTestBed({ open: vi.fn() });
    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.global-header__brand')).toBeTruthy();
    expect(el.querySelector('.global-header__menu-button')).toBeNull();
    expect(el.querySelector('.global-header__menu-panel')).toBeNull();
  });

  it('con sesion muestra Mi perfil y boton Salir dentro del menu', () => {
    setupTestBed({ open: vi.fn() });
    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    const store = TestBed.inject(AuthStore);
    store.setSession(FULL_AUTH);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.global-header__menu-panel')).toBeNull();

    openMenu(fixture);

    const userLink = el.querySelector('.global-header__menu-item[href="/profile/juancho"]');
    expect(el.querySelector('.global-header__menu-item[href="/friends"]')).toBeTruthy();
    expect(userLink).toBeTruthy();
    expect(userLink?.textContent ?? '').toContain('Mi perfil');
    expect(el.querySelector('button.global-header__menu-item')?.textContent ?? '').toContain(
      'Salir',
    );
  });

  it('si la presencia indica ocupado oculta Amigos y Mi perfil aunque no este en /match', () => {
    setupTestBed({ open: vi.fn() }, true);
    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    const store = TestBed.inject(AuthStore);
    store.setSession(FULL_AUTH);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    openMenu(fixture);

    expect(el.querySelector('.global-header__menu-item[href]')).toBeNull();
    expect(el.querySelector('button.global-header__menu-item')?.textContent ?? '').toContain(
      'Salir',
    );
  });

  it('con sesion invitada muestra Invitado sin link de perfil dentro del menu', () => {
    setupTestBed({ open: vi.fn() });
    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    const store = TestBed.inject(AuthStore);
    store.setSession({
      playerId: 'guest-1',
      accessToken: 'guest-token',
      accessTokenExpiresIn: 604800,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    openMenu(fixture);

    expect(el.querySelector('.global-header__menu-item[href]')).toBeNull();
    expect(el.querySelector('.global-header__menu-item--readonly')?.textContent ?? '').toContain(
      'Invitado',
    );
  });

  it('dentro de una partida deshabilita la marca y oculta navegacion del menu, pero mantiene Salir', async () => {
    @Component({ standalone: true, template: '' })
    class StubComponent {}

    setupStorageMock();
    TestBed.configureTestingModule({
      imports: [GlobalHeaderComponent],
      providers: [
        provideRouter([{ path: 'match/:matchId', component: StubComponent }]),
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        SessionStorageService,
        AuthStore,
        {
          provide: PresenceCoordinatorService,
          useValue: {
            busy: signal(false),
            presence: signal<UserPresenceResponse | null>({
              busy: true,
              match: { id: 'abc-123', status: 'IN_PROGRESS' },
              league: null,
              cup: null,
              rematch: null,
              quickMatch: null,
              spectating: null,
            }),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });

    const router = TestBed.inject(Router);
    const store = TestBed.inject(AuthStore);
    store.setSession(FULL_AUTH);
    await router.navigateByUrl('/match/abc-123');

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const brand = el.querySelector('.global-header__brand');
    expect(brand).toBeTruthy();
    expect((brand as HTMLElement).tagName).toBe('SPAN');
    expect(brand?.getAttribute('href')).toBeNull();

    openMenu(fixture);

    expect(el.querySelector('.global-header__menu-item[href]')).toBeNull();
    expect(el.querySelector('.global-header__menu-item--readonly')).toBeNull();
    const buttons = Array.from(
      el.querySelectorAll<HTMLButtonElement>('button.global-header__menu-item'),
    ).map((b) => b.textContent ?? '');
    expect(buttons.some((t) => t.includes('Salir'))).toBe(true);
    expect(buttons.some((t) => t.includes('Abandonar partida'))).toBe(true);
  });

  it('click en "Salir" abre ConfirmLogoutDialog', () => {
    const dialogRefMock = {
      afterClosed: () => of(false),
    } as unknown as MatDialogRef<ConfirmLogoutDialogComponent, boolean>;
    const openSpy = vi.fn().mockReturnValue(dialogRefMock);
    setupTestBed({ open: openSpy } as Partial<MatDialog>);

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    const store = TestBed.inject(AuthStore);
    store.setSession(FULL_AUTH);
    fixture.detectChanges();
    openMenu(fixture);

    const btn = fixture.debugElement
      .queryAll(By.css('button.global-header__menu-item'))
      .find((de) => (de.nativeElement as HTMLElement).textContent?.includes('Salir'));
    expect(btn).toBeTruthy();
    btn!.nativeElement.click();

    expect(openSpy).toHaveBeenCalledWith(ConfirmLogoutDialogComponent, expect.any(Object));
  });

  it('cierra el menu con Escape', () => {
    setupTestBed({ open: vi.fn() });
    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    const store = TestBed.inject(AuthStore);
    store.setSession(FULL_AUTH);
    fixture.detectChanges();

    openMenu(fixture);
    expect(fixture.nativeElement.querySelector('.global-header__menu-panel')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.global-header__menu-panel')).toBeNull();
  });

  async function setupRoutedHeader(url: string, presenceValue: UserPresenceResponse | null = null) {
    @Component({ standalone: true, template: '' })
    class StubComponent {}

    setupStorageMock();
    TestBed.configureTestingModule({
      imports: [GlobalHeaderComponent],
      providers: [
        provideRouter([
          { path: 'match/:matchId', component: StubComponent },
          { path: 'spectate/:matchId', component: StubComponent },
          { path: 'lobby', component: StubComponent },
        ]),
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        SessionStorageService,
        AuthStore,
        {
          provide: PresenceCoordinatorService,
          useValue: { busy: signal(presenceValue?.busy === true), presence: signal(presenceValue) },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });

    const router = TestBed.inject(Router);
    TestBed.inject(AuthStore).setSession(FULL_AUTH);
    await router.navigateByUrl(url);
    return router;
  }

  it('muestra el badge de espectadores en /match con conteo >= 1', async () => {
    await setupRoutedHeader('/match/abc-123');
    TestBed.inject(SpectatorCountStore).set(2);

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.global-header__spectator-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent ?? '').toContain('2');
  });

  it('oculta el badge de espectadores cuando el conteo es 0', async () => {
    await setupRoutedHeader('/spectate/abc-123');
    TestBed.inject(SpectatorCountStore).set(0);

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.global-header__spectator-badge')).toBeNull();
  });

  it('oculta el badge fuera de una partida aunque el store tenga conteo', async () => {
    await setupRoutedHeader('/lobby');
    TestBed.inject(SpectatorCountStore).set(3);

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.global-header__spectator-badge')).toBeNull();
  });

  it('en /spectate ofrece "Dejar de ver" en el menu y navega a /friends', async () => {
    const router = await setupRoutedHeader('/spectate/abc-123');
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();
    openMenu(fixture);

    const el = fixture.nativeElement as HTMLElement;
    const leaveBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('button.global-header__menu-item'),
    ).find((b) => (b.textContent ?? '').includes('Dejar de ver'));
    expect(leaveBtn).toBeTruthy();

    leaveBtn?.click();
    expect(navSpy).toHaveBeenCalledWith(['/friends']);
  });

  it('en /match NO ofrece "Dejar de ver"', async () => {
    await setupRoutedHeader('/match/abc-123', {
      busy: true,
      match: { id: 'abc-123', status: 'IN_PROGRESS' },
      league: null,
      cup: null,
      rematch: null,
      quickMatch: null,
      spectating: null,
    });

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();
    openMenu(fixture);

    const el = fixture.nativeElement as HTMLElement;
    const hasLeave = Array.from(
      el.querySelectorAll<HTMLButtonElement>('button.global-header__menu-item'),
    ).some((b) => (b.textContent ?? '').includes('Dejar de ver'));
    expect(hasLeave).toBe(false);
  });

  it('abandonar partida no navega directo al lobby; espera el modal de resultado', async () => {
    const router = await setupRoutedHeader('/match/abc-123', {
      busy: true,
      match: { id: 'abc-123', status: 'IN_PROGRESS' },
      league: null,
      cup: null,
      rematch: null,
      quickMatch: null,
      spectating: null,
    });
    const dialog = TestBed.inject(MatDialog) as unknown as {
      open: ReturnType<typeof vi.fn>;
    };
    dialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();
    const abandonSpy = vi
      .spyOn(fixture.componentInstance['matchActions'], 'abandon')
      .mockReturnValue(of(undefined));
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    openMenu(fixture);

    const el = fixture.nativeElement as HTMLElement;
    const abandonBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('button.global-header__menu-item'),
    ).find((b) => (b.textContent ?? '').includes('Abandonar partida'));
    expect(abandonBtn).toBeTruthy();

    abandonBtn?.click();

    expect(abandonSpy).toHaveBeenCalledWith('abc-123');
    expect(navSpy).not.toHaveBeenCalledWith('/lobby');
  });

  it('en sala de espera ofrece "Salir de la sala" y no "Abandonar partida"', async () => {
    await setupRoutedHeader('/match/abc-123', {
      busy: true,
      match: { id: 'abc-123', status: 'WAITING_FOR_PLAYERS' },
      league: null,
      cup: null,
      rematch: null,
      quickMatch: null,
      spectating: null,
    });

    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();
    openMenu(fixture);

    const el = fixture.nativeElement as HTMLElement;
    const labels = Array.from(
      el.querySelectorAll<HTMLButtonElement>('button.global-header__menu-item'),
    ).map((b) => b.textContent ?? '');

    expect(labels.some((t) => t.includes('Salir de la sala'))).toBe(true);
    expect(labels.some((t) => t.includes('Abandonar partida'))).toBe(false);
  });
});
