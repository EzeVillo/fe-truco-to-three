import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { App } from './app';
import { AuthStore } from './core/auth/auth.store';
import { SessionStorageService } from './core/auth/session-storage.service';
import { ProfileNotificationService } from './features/profile/services/profile-notification.service';
import { ServerWakeService } from './core/services/server-wake.service';

describe('App', () => {
  beforeEach(async () => {
    const fakeStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => fakeStorage[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      fakeStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete fakeStorage[key];
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideHttpClient(),
        provideStore(),
        provideEffects(),
        SessionStorageService,
        AuthStore,
      ],
    }).compileComponents();
  });

  it('crea el componente raíz', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('no muestra la toolbar cuando no hay sesión', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    // Sin sesión: no debe haber toolbar
    expect(compiled.querySelector('mat-toolbar')).toBeNull();
  });

  it('inicializa las notificaciones de perfil', () => {
    // ServerWakeService usa fetch real y nunca llega a 'ready' en tests.
    // Mockeamos la señal isReady a true para que el effect dispare bootBackendServices().
    TestBed.overrideProvider(ServerWakeService, {
      useValue: {
        isReady: signal(true),
        overlayVisible: signal(false),
        status: signal('ready'),
        start: vi.fn(),
        notifyActivity: vi.fn(),
        retry: vi.fn(),
      },
    });

    const service = TestBed.inject(ProfileNotificationService);
    const startSpy = vi.spyOn(service, 'start');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(startSpy).toHaveBeenCalledTimes(1);
  });
});
