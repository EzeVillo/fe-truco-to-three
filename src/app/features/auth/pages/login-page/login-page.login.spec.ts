import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { SessionStorageService } from '../../../../core/auth/session-storage.service';
import type { FullAuthResponse } from '../../../../core/models/auth.models';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ReactiveFormsModule } from '@angular/forms';

const FULL_RESPONSE: FullAuthResponse = {
  playerId: 'player-123',
  accessToken: 'access-jwt',
  refreshToken: 'refresh-opaque',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2592000,
};

describe('LoginPageComponent — formulario de login (US2)', () => {
  let authServiceMock: Partial<AuthService>;

  beforeEach(() => {
    const fakeStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key) => fakeStorage[key] ?? null,
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key, value) => {
        fakeStorage[key] = value;
      },
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    authServiceMock = {
      guest: vi
        .fn()
        .mockReturnValue(of({ playerId: 'g', accessToken: 'g-jwt', accessTokenExpiresIn: 100 })),
      login: vi.fn().mockReturnValue(of(FULL_RESPONSE)),
    };

    TestBed.configureTestingModule({
      imports: [LoginPageComponent, ReactiveFormsModule],
      providers: [
        provideRouter([{ path: 'lobby', component: LoginPageComponent }]),
        provideAnimationsAsync(),
        SessionStorageService,
        AuthStore,
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('botón de login está disponible con formulario vacío (validación al submit)', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    // El botón no está disabled en el estado inicial — se valida al hacer submit
    expect(button).toBeTruthy();
  });

  it('muestra errores de validación cuando username y password están vacíos al submit', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.loginForm.invalid).toBe(true);
    // authService.login NO debe haberse llamado
    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it('no envía el formulario con password de menos de 5 chars', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.loginForm.setValue({ username: 'juan', password: '123' });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    fixture.detectChanges();

    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it('navega a returnUrl (o /lobby) tras login exitoso', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.loginForm.setValue({ username: 'juancho', password: 'Clave1!' });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    await fixture.whenStable();

    expect(authServiceMock.login).toHaveBeenCalledWith({
      username: 'juancho',
      password: 'Clave1!',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/lobby']);
  });

  it('muestra error "Usuario o contraseña incorrectos" ante 401', async () => {
    authServiceMock.login = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { errorCode: 'UnauthorizedAccessException', message: 'Bad credentials' },
          }),
      ),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.loginForm.setValue({ username: 'juan', password: 'wrong123!' });
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    button.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()?.kind).toBe('invalid-credentials');
    expect(fixture.componentInstance.errorMessage()).toContain('Usuario o contraseña incorrectos');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
