import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { GlobalHeaderComponent } from './global-header.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { SessionStorageService } from '../../../core/auth/session-storage.service';
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

function setupTestBed(dialogMock: Partial<MatDialog>) {
  const fakeStorage: Record<string, string> = {};
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => fakeStorage[k] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => {
    fakeStorage[k] = v;
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((k) => {
    delete fakeStorage[k];
  });

  TestBed.configureTestingModule({
    imports: [GlobalHeaderComponent],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
      SessionStorageService,
      AuthStore,
      { provide: MatDialog, useValue: dialogMock },
    ],
  });
}

describe('GlobalHeaderComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marca siempre visible; sin sesión NO muestra username ni Salir', () => {
    setupTestBed({ open: vi.fn() });
    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.global-header__brand')).toBeTruthy();
    expect(el.querySelector('.global-header__logout')).toBeNull();
    expect(el.querySelector('.global-header__user')).toBeNull();
  });

  it('con sesión muestra username y botón Salir', () => {
    setupTestBed({ open: vi.fn() });
    const fixture = TestBed.createComponent(GlobalHeaderComponent);
    const store = TestBed.inject(AuthStore);
    store.setSession(FULL_AUTH);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const userLink = el.querySelector('.global-header__user') as HTMLAnchorElement;
    expect(userLink).toBeTruthy();
    expect(userLink.textContent ?? '').toContain('juancho');
    expect(userLink.getAttribute('href')).toBe('/profile/juancho');
    expect(el.querySelector('.global-header__logout')?.textContent ?? '').toContain('Salir');
  });

  it('con sesion invitada muestra Invitado sin link de perfil', () => {
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
    expect(el.querySelector('.global-header__user-link')).toBeNull();
    expect(el.querySelector('.global-header__user')?.textContent ?? '').toContain('Invitado');
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

    const btn = fixture.debugElement.query(By.css('.global-header__logout'));
    btn.nativeElement.click();

    expect(openSpy).toHaveBeenCalledWith(ConfirmLogoutDialogComponent, expect.any(Object));
  });
});
