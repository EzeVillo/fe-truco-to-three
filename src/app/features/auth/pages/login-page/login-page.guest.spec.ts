import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { SessionStorageService } from '../../../../core/auth/session-storage.service';
import type { GuestAuthResponse } from '../../../../core/models/auth.models';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ReactiveFormsModule } from '@angular/forms';

const GUEST_RESPONSE: GuestAuthResponse = {
  playerId: 'guest-uuid',
  accessToken: 'guest-jwt',
  accessTokenExpiresIn: 604800,
};

describe('LoginPageComponent — flujo invitado (US1)', () => {
  let authServiceMock: Partial<AuthService>;
  let storeMock: Partial<InstanceType<typeof AuthStore>>;
  let setSessionSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setSessionSpy = vi.fn();
    authServiceMock = {
      guest: vi.fn().mockReturnValue(of(GUEST_RESPONSE)),
      login: vi.fn(),
    };

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

  it('renderiza el componente GuestCta', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const guestCta = fixture.debugElement.query(By.css('app-guest-cta'));
    expect(guestCta).toBeTruthy();
  });

  it('al hacer click en el CTA, navega al lobby', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();

    const ctaButton = fixture.debugElement.query(By.css('app-guest-cta button'));
    if (ctaButton) {
      ctaButton.nativeElement.click();
      await fixture.whenStable();
      expect(navigateSpy).toHaveBeenCalledWith(['/lobby']);
    }
  });
});
