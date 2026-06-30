// Catálogo de copy de errores — feature 003-lobby-bots
// Fuente: FR-014, FR-014a, FR-014b y data-model.md §Mapeo de errores
//
// Regla [[error-messaging]]: NUNCA mostrar `ApiError.message` del backend.
// Esta función mapea HttpErrorResponse → copy del front por scope + status.
// El caso 401 se maneja a nivel interceptor; devolvemos '' para que la UI no muestre nada.

import { HttpErrorResponse } from '@angular/common/http';
import type { FriendBusyReason } from '../../core/models/social.models';

export type ErrorCopyScope =
  | 'BOT_CATALOG'
  | 'CREATE_BOT_MATCH'
  | 'CREATE_BOT_VS_BOT_MATCH'
  | 'ADVANCE_BOT_VS_BOT_MATCH'
  | 'MATCH_LOAD'
  | 'REMATCH'
  | 'PROFILE'
  | 'MATCH_HISTORY'
  | 'CREATE_MATCH'
  | 'JOIN_MATCH'
  | 'QUICK_MATCH'
  | 'PUBLIC_LOBBY'
  | 'SOCIAL'
  | 'SPECTATE'
  | 'CHAT'
  | 'CAMPAIGN_LOAD'
  | 'CAMPAIGN_CHALLENGE';

const FALLBACK = 'Ocurrió un error inesperado. Reintentá.';

/** Extrae el `errorCode` del body de un `ApiError` sin exponer nunca su `message` crudo. */
function errorCodeOf(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return '';
  }
  const body = error.error as { errorCode?: string } | null | undefined;
  return body?.errorCode ?? '';
}

/**
 * Copy genérico para errores del canal de spectate (SPECTATE_ERROR WS o REST).
 * Ignora el string crudo del backend — nunca se expone al usuario.
 */
export function spectateErrorCopy(_rawError?: string): string {
  return 'No pudiste entrar a mirar esta partida. Puede que ya haya terminado.';
}

/**
 * Copy del front para el motivo de ocupación de un amigo (feature 025, FR-002e).
 * Nunca se muestra el código crudo del enum. `UNKNOWN` o no catalogado → genérico.
 */
export function busyReasonCopy(reason: FriendBusyReason | null): string {
  switch (reason) {
    case 'IN_MATCH':
      return 'En partida';
    case 'IN_LEAGUE':
      return 'En una liga';
    case 'IN_CUP':
      return 'En una copa';
    case 'OPEN_REMATCH':
      return 'Con revancha pendiente';
    case 'IN_QUICK_QUEUE':
      return 'Buscando rival';
    case 'PENDING_INVITATION':
      return 'Con una invitación pendiente';
    case 'PENDING_FRIEND_REQUEST':
      return 'Con una solicitud pendiente';
    case 'SPECTATING':
      return 'Mirando una partida';
    default:
      return 'No disponible';
  }
}

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

  if (scope === 'CREATE_BOT_VS_BOT_MATCH') {
    switch (status) {
      case 401:
        return '';
      case 403:
        return 'No tenés permiso para crear esta partida.';
      case 404:
        return 'Alguno de los bots ya no está disponible, actualizá la lista.';
      case 409:
      case 422:
        // Incluye "ya estás ocupado" (otra bot-match en curso, partida, cola, etc.).
        return 'No podés crear esta partida ahora: terminá la que tenés en curso.';
      case 0:
        return 'No pudimos crear la partida. Reintentá en unos segundos.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos crear la partida. Reintentá en unos segundos.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'ADVANCE_BOT_VS_BOT_MATCH') {
    switch (status) {
      case 401:
        return '';
      case 404:
        return 'Esta partida ya no existe o terminó.';
      case 422:
        return 'No podés avanzar esta partida.';
      case 0:
        return 'No pudimos avanzar la jugada. Reintentá.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos avanzar la jugada. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'REMATCH') {
    switch (status) {
      case 401:
        return '';
      case 404:
        return 'La revancha ya no está disponible.';
      case 422:
        return 'La revancha ya no está disponible o no sos participante de esta partida.';
      case 409:
        return 'Ya tenés una sesión de revancha abierta.';
      case 0:
        return 'No pudimos conectarnos. Reintentá en unos segundos.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos procesar la revancha. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'PROFILE') {
    switch (status) {
      case 401:
        return '';
      case 404:
        return 'No encontramos ese perfil.';
      case 0:
      case -1:
        return 'No pudimos cargar el perfil. Reintentá.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos cargar el perfil. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'MATCH_HISTORY') {
    switch (status) {
      case 401:
        return '';
      case 0:
      case -1:
        return 'No pudimos cargar tu historial. Reintentá.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos cargar tu historial. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'CREATE_MATCH') {
    switch (status) {
      case 401:
        return '';
      case 403:
        return 'No tenés permiso para crear esta partida.';
      case 409:
      case 422:
        return 'Ya estás en una partida o tenés una revancha pendiente.';
      case 0:
        return 'No pudimos crear la partida. Reintentá en unos segundos.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos crear la partida. Reintentá en unos segundos.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'JOIN_MATCH') {
    switch (status) {
      case 401:
        return '';
      case 404:
        return 'Ese código no corresponde a ninguna partida.';
      case 409:
        return 'La partida se llenó justo antes de que entraras.';
      case 422:
        return 'No podés unirte: la partida ya empezó o estás ocupado en otra.';
      case 0:
        return 'No pudimos unirte a la partida. Reintentá.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos unirte a la partida. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'QUICK_MATCH') {
    switch (status) {
      case 401:
        return '';
      case 409:
      case 422:
        return 'Ya estás en una partida, una revancha pendiente o una búsqueda activa.';
      case 0:
        return 'No pudimos buscar rival. Reintentá en unos segundos.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos buscar rival. Reintentá en unos segundos.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'PUBLIC_LOBBY') {
    switch (status) {
      case 401:
        return '';
      case 0:
        return 'No pudimos cargar las partidas. Reintentá.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos cargar las partidas. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'SOCIAL') {
    // El BE distingue dos estados al enviar una solicitud (409/422):
    // ya son amigos, o ya hay una solicitud pendiente entre ambos.
    switch (errorCodeOf(error)) {
      case 'FriendshipAlreadyExistsException':
        return 'Ya son amigos.';
      case 'FriendshipRequestAlreadyPendingException':
        return 'Ya hay una solicitud de amistad pendiente con este usuario.';
      case 'FriendRequestsNotAcceptedException':
        return 'Este usuario no está aceptando solicitudes de amistad por ahora.';
      case 'FriendLimitReachedException':
        return 'Alguno de los dos ya alcanzó el máximo de amigos permitido.';
    }
    switch (status) {
      case 401:
        return '';
      case 403:
        return 'No tenés permiso para esta acción.';
      case 404:
        return 'Ese usuario no existe o la solicitud ya no está disponible.';
      case 409:
      case 422:
        return 'No se pudo completar la acción: revisá el estado de la solicitud.';
      case 0:
        return 'No pudimos conectarnos. Reintentá en unos segundos.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos conectarnos. Reintentá en unos segundos.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'SPECTATE') {
    switch (status) {
      case 401:
        return '';
      case 404:
        return 'Esta partida no existe o ya terminó.';
      case 422:
        return 'No podés entrar a mirar esta partida.';
      case 0:
        return 'No pudimos conectarnos. Reintentá en unos segundos.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos conectarnos. Reintentá en unos segundos.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'CHAT') {
    switch (status) {
      case 401:
        return '';
      case 404:
        return 'El chat ya no está disponible.';
      case 422:
        return 'Esperá un momento antes de enviar otro mensaje.';
      case 0:
        return 'No pudimos enviar el mensaje. Reintentá.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos enviar el mensaje. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'CAMPAIGN_LOAD') {
    switch (status) {
      case 401:
        return '';
      case 0:
        return 'No pudimos cargar la campaña. Reintentá.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos cargar la campaña. Reintentá.';
        }
        return FALLBACK;
    }
  }

  if (scope === 'CAMPAIGN_CHALLENGE') {
    switch (status) {
      case 401:
        return '';
      case 400:
        return 'No hay un rival para desafiar. Actualizá el ranking.';
      case 404:
        return 'Ese rival ya no está disponible. Actualizá el ranking.';
      case 422:
        return 'El desafío no está permitido: puede que ya tengas uno en curso o que ese rival no sea desafiable.';
      case 0:
        return 'No pudimos crear el desafío. Reintentá en unos segundos.';
      default:
        if (status >= 500 && status < 600) {
          return 'No pudimos crear el desafío. Reintentá en unos segundos.';
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
