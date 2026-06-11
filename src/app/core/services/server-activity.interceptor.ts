import { inject } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import type { HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs';
import { ServerWakeService } from './server-wake.service';

/**
 * Marca actividad del backend en `ServerWakeService` cada vez que una request
 * HTTP recibe respuesta. Con eso el servicio sabe si el backend "habló" hace
 * poco y puede saltarse el re-chequeo de wake al volver de inactividad.
 *
 * Cuenta sólo respuestas (no el envío): una request disparada contra un server
 * dormido no prueba que esté despierto. Los errores HTTP (4xx/5xx) no pasan por
 * acá como `Response`, pero no hace falta contarlos: si el server respondió un
 * error igual está despierto, y el costo de un re-chequeo de más es un GET que
 * responde al instante sin mostrar overlay.
 *
 * El `HttpClient` de la app sólo habla con el backend (los assets de audio y el
 * propio wake usan `fetch`), así que no hace falta filtrar por URL.
 */
export const serverActivityInterceptor: HttpInterceptorFn = (req, next) => {
  const serverWake = inject(ServerWakeService);
  return next(req).pipe(
    tap((event) => {
      if (event.type === HttpEventType.Response) {
        serverWake.notifyActivity();
      }
    }),
  );
};
