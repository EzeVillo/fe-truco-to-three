import { Injectable } from '@angular/core';

/**
 * Única puerta de acceso a localStorage.
 * Encapsula todas las operaciones de lectura/escritura y maneja errores silenciosamente.
 * Constraint del plan: cero accesos directos a localStorage fuera de este servicio.
 */
@Injectable({ providedIn: 'root' })
export class SessionStorageService {
  /**
   * Lee y parsea un valor de localStorage.
   * Devuelve null y borra la clave si:
   *  - la clave no existe
   *  - el JSON es inválido / corrupto
   *  - el type guard `isValid` falla
   */
  read<T>(key: string, isValid: (v: unknown) => v is T): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isValid(parsed)) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch {
      // JSON inválido o SecurityError (modo privado)
      try {
        localStorage.removeItem(key);
      } catch {
        // ignorar: no podemos limpiar tampoco
      }
      return null;
    }
  }

  /**
   * Serializa y escribe un valor en localStorage.
   * Ignora silenciosamente QuotaExceededError y SecurityError.
   */
  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // QuotaExceededError o SecurityError — la app sigue funcionando
    }
  }

  /** Elimina una clave de localStorage. Ignora errores silenciosamente. */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignorar
    }
  }
}
