// Catálogo de copy de errores — feature 003-lobby-bots
// Fuente: FR-014, FR-014a, FR-014b y data-model.md §Mapeo de errores
//
// Regla [[error-messaging]]: NUNCA mostrar `ApiError.message` del backend.
// Esta función mapea HttpErrorResponse → copy del front por scope + status.
// El caso 401 se maneja a nivel interceptor; devolvemos '' para que la UI no muestre nada.

import { HttpErrorResponse } from '@angular/common/http';

export type ErrorCopyScope = 'BOT_CATALOG' | 'CREATE_BOT_MATCH' | 'MATCH_LOAD';

const FALLBACK = 'Ocurrió un error inesperado. Reintentá.';

export function getErrorCopy(scope: ErrorCopyScope, error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : -1;

  if (scope === 'BOT_CATALOG') {
    switch (status) {
      case 401:
        return '';
      case 403:
        return 'No tenés permiso para ver los bots.';
      case 0:
        return 'No pudimos cargar los bots. Reintentá.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos cargar los bots. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'CREATE_BOT_MATCH') {
    switch (status) {
      case 401:
        return '';
      case 403:
        return 'No tenés permiso para crear esta partida.';
      case 404:
        return 'El bot ya no está disponible, actualizá la lista.';
      case 409:
      case 422:
        return 'La configuración elegida no es válida.';
      case 0:
        return 'No pudimos crear la partida. Reintentá en unos segundos.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos crear la partida. Reintentá en unos segundos.';
        }
        return FALLBACK;
    }
  }

  // scope === 'MATCH_LOAD'
  switch (status) {
    case 401:
      return '';
    case 404:
      return 'La partida no existe o ya no está disponible.';
    case 422:
      return 'No pertenecés a esta partida.';
    case 0:
    case -1:
      return 'No pudimos cargar la partida. Reintentá.';
    default:
      if (status >= 500 && status < 600) {
        return 'No pudimos cargar la partida. Reintentá.';
      }
      return FALLBACK;
  }
}
