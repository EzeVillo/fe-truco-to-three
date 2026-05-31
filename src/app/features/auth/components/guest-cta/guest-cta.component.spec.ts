import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { GuestCtaComponent } from './guest-cta.component';
import { AuthService } from '../../../../core/auth/auth.service';
import type { GuestAuthResponse } from '../../../../core/models/auth.models';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

const GUEST_RESPONSE: GuestAuthResponse = {
  playerId: 'guest-uuid',
  accessToken: 'guest-jwt',
  accessTokenExpiresIn: 604800,
};

describe('GuestCtaComponent', () => {
  let authServiceMock: Partial<AuthService>;

  beforeEach(() => {
    authServiceMock = {
      guest: vi.fn().mockReturnValue(of(GUEST_RESPONSE)),
    };

    TestBed.configureTestingModule({
      imports: [GuestCtaComponent],
      providers: [
        provideRouter([{ path: 'lobby', component: GuestCtaComponent }]),
        provideAnimationsAsync(),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('se renderiza correctamente con el botón "Jugar como invitado"', async () => {
    const fixture = TestBed.createComponent(GuestCtaComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.debugElement.query(By.css('button'));
    expect(button).toBeTruthy();
    expect(button.nativeElement.textContent).toContain('Jugar como invitado');
  });

  it('muestra spinner cuando está en loading', async () => {
    const guestSubject = new Subject<GuestAuthResponse>();
    authServiceMock.guest = vi.fn().mockReturnValue(guestSubject.asObservable());

    const fixture = TestBed.createComponent(GuestCtaComponent);
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();
    fixture.detectChanges();

    // Mientras el Subject no emite, loading = true
    expect(fixture.componentInstance.loading()).toBe(true);
    const spinner = fixture.debugElement.query(By.css('mat-spinner, .loading-spinner'));
    expect(spinner).toBeTruthy();

    // Resolver
    guestSubject.next(GUEST_RESPONSE);
    guestSubject.complete();
    await fixture.whenStable();
  });

  it('navega a /lobby tras una respuesta exitosa', async () => {
    const fixture = TestBed.createComponent(GuestCtaComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/lobby');
  });

  it('navega a returnUrl si está definido', async () => {
    const fixture = TestBed.createComponent(GuestCtaComponent);
    fixture.componentInstance.returnUrl = '/partido/123';
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/partido/123');
  });

  it('muestra mensaje de error cuando guest() falla', async () => {
    authServiceMock.guest = vi
      .fn()
      .mockReturnValue(
        throwError(() => ({ status: 500, error: { errorCode: 'ServerError', message: 'Error' } })),
      );

    const fixture = TestBed.createComponent(GuestCtaComponent);
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.error()).toBeTruthy();
  });
});
