import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter, Router, RouterLink } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { RegisterPageComponent } from './register-page.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { SessionStorageService } from '../../../../core/auth/session-storage.service';
import type { FullAuthResponse } from '../../../../core/models/auth.models';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ReactiveFormsModule } from '@angular/forms';

const FULL_RESPONSE: FullAuthResponse = {
  playerId: 'player-new',
  accessToken: 'access-jwt',
  refreshToken: 'refresh-opaque',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

describe('RegisterPageComponent (US3)', () => {
  let authServiceMock: Partial<AuthService>;

  beforeEach(() => {
    const fakeStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => fakeStorage[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    authServiceMock = {
      register: vi.fn().mockReturnValue(of(FULL_RESPONSE)),
    };

    TestBed.configureTestingModule({
      imports: [RegisterPageComponent, ReactiveFormsModule],
      providers: [
        provideRouter([{ path: 'lobby', component: RegisterPageComponent }]),
        provideAnimationsAsync(),
        SessionStorageService,
        AuthStore,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('renderiza el formulario de registro', async () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.debugElement.query(By.css('form'));
    expect(form).toBeTruthy();
  });

  it('bloquea submit con username con tilde (validación client-side, sin request)', async () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.registerForm.setValue({
      username: 'martín',
      password: 'Clave1!',
    });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    fixture.detectChanges();

    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it('bloquea submit con password corta (< 5 chars), sin request', async () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.registerForm.setValue({ username: 'juancho', password: '123' });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    fixture.detectChanges();

    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it('bloquea submit con password sin número', async () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.registerForm.setValue({ username: 'juancho', password: 'Clave!' });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    fixture.detectChanges();

    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it('bloquea submit con password sin símbolo', async () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.registerForm.setValue({ username: 'juancho', password: 'Clave1' });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    fixture.detectChanges();

    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it('navega a /lobby tras registro exitoso', async () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.registerForm.setValue({ username: 'juancho', password: 'Clave1!' });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    await fixture.whenStable();

    expect(authServiceMock.register).toHaveBeenCalledWith({
      username: 'juancho',
      password: 'Clave1!',
    });
    expect(navigateSpy).toHaveBeenCalledWith('/lobby');
  });

  it('preserva returnUrl en la pestaña para volver al login', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: {
          queryParamMap: {
            get: (key: string) => (key === 'returnUrl' ? '/join/ABC123' : null),
          },
        },
      },
    });

    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const loginLink = fixture.debugElement.query(By.directive(RouterLink));
    expect(loginLink).toBeTruthy();
    expect(loginLink.injector.get(RouterLink).queryParams).toEqual({
      returnUrl: '/join/ABC123',
    });
  });

  it('muestra error "Ese usuario ya está en uso" ante 422 username-taken', async () => {
    authServiceMock.register = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { errorCode: 'UsernameConflict', message: 'Username already in use' },
          }),
      ),
    );

    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.registerForm.setValue({ username: 'juancho', password: 'Clave1!' });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()?.kind).toBe('username-taken');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
