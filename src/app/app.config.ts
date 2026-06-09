import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `PreloadAllModules`: tras el boot, bajamos en segundo plano los chunks de
    // las rutas lazy. Así, cuando el usuario toca una CTA, el componente ya suele
    // estar cacheado y la navegación es instantánea aun con red mala (evita el
    // doble-tap por falta de feedback la primera vez que se entra a una ruta).
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    // Orden importante: jwt primero (añade el token), refresh segundo (maneja 401)
    provideHttpClient(withInterceptors([jwtInterceptor, refreshInterceptor])),
    provideAnimationsAsync(),
    provideStore(),
    provideEffects(),
  ],
};
