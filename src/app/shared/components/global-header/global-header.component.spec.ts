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
import { ConfirmLogoutDialogComponent } from '../confirm-logout-dialog/confirm-logout-dialog.component';
import type { FullAuthResponse } from '../../../core/models/auth.models';

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

  TestBed.configureTestingModule({
    imports: [GlobalHeaderComponent],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
      SessionStorageService,
      AuthStore,
      { provide: PresenceCoordinatorService, useValue: { busy: presenceBusy } },
      { provide: MatDialog, useValue: dialogMock },
    ],
  });

  return { presenceBusy };
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
        { provide: PresenceCoordinatorService, useValue: { busy: signal(false) } },
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
    expect(el.querySelector('button.global-header__menu-item')?.textContent ?? '').toContain(
      'Salir',
    );
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

    const btn = fixture.debugElement.query(By.css('button.global-header__menu-item'));
    btn.nativeElement.click();

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
});
