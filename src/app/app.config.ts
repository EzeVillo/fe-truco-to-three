import type { ApplicationConfig } from '@angular/core';
import { isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth/jwt.interceptor';
import { refreshInterceptor } from './core/auth/refresh.interceptor';
import { serverActivityInterceptor } from './core/services/server-activity.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `PreloadAllModules`: tras el boot, bajamos en segundo plano los chunks de
    // las rutas lazy. Así, cuando el usuario toca una CTA, el componente ya suele
    // estar cacheado y la navegación es instantánea aun con red mala (evita el
    // doble-tap por falta de feedback la primera vez que se entra a una ruta).
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    // Orden importante: jwt primero (añade el token), refresh segundo (maneja 401),
    // actividad al final (marca tráfico exitoso para el re-chequeo de wake).
    provideHttpClient(
      withInterceptors([jwtInterceptor, refreshInterceptor, serverActivityInterceptor]),
    ),
    provideAnimationsAsync(),
    provideStore(),
    provideEffects(),
    // PWA: el service worker (ngsw) habilita el prompt de instalación del navegador
    // y cachea los assets. Sólo en producción; en dev no existe ngsw-worker.js.
    // `registerWhenStable`: espera a que la app esté estable para no competir con
    // el boot (WS/STOMP incluido); a los 30 s registra igual.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
