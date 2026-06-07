import { Injectable, computed, signal } from '@angular/core';

const ENABLED_STORAGE_KEY = 't3.sfx.enabled';
const VOLUME_STORAGE_KEY = 't3.sfx.volume';

/** Volumen inicial de efectos: arranca encendido a nivel pleno. */
const DEFAULT_VOLUME = 1;

/**
 * Estado del **bus de efectos** (SFX de partida + clicks de UI), independiente de
 * la música de fondo. Es sólo estado + persistencia: no toca el audio. Los
 * servicios de reproducción (`AudioPlaybackService`, `UiClickSoundService`) leen
 * `gain()` en cada disparo y lo aplican a un `GainNode` propio, de modo que un
 * único nivel gobierna todos los efectos aunque cada servicio use su propio
 * `AudioContext`.
 *
 * La preferencia (encendido + volumen) se persiste en localStorage para
 * respetarla entre sesiones.
 */
@Injectable({ providedIn: 'root' })
export class EffectsVolumeService {
  private readonly _enabled = signal<boolean>(this.readEnabled());
  /** ¿El usuario quiere escuchar los efectos? (toggle de mute). */
  readonly enabled = this._enabled.asReadonly();

  private readonly _volume = signal<number>(this.readVolume());
  /** Volumen actual en [0, 1]. */
  readonly volume = this._volume.asReadonly();

  /** Ganancia efectiva a aplicar: 0 si está muteado. */
  readonly gain = computed(() => (this._enabled() ? this._volume() : 0));

  /** Enciende/apaga los efectos; persiste la preferencia. */
  toggleEnabled(): void {
    const next = !this._enabled();
    this._enabled.set(next);
    this.persistEnabled(next);
  }

  /** Ajusta el volumen en [0, 1]; persiste la preferencia. */
  setVolume(value: number): void {
    const clamped = Math.min(1, Math.max(0, value));
    this._volume.set(clamped);
    this.persistVolume(clamped);
  }

  private readEnabled(): boolean {
    try {
      const raw = localStorage.getItem(ENABLED_STORAGE_KEY);
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  }

  private persistEnabled(value: boolean): void {
    try {
      localStorage.setItem(ENABLED_STORAGE_KEY, String(value));
    } catch {
      // Sin persistencia: la preferencia vale sólo para esta sesión.
    }
  }

  private readVolume(): number {
    try {
      const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (raw === null) {
        return DEFAULT_VOLUME;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_VOLUME;
    } catch {
      return DEFAULT_VOLUME;
    }
  }

  private persistVolume(value: number): void {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(value));
    } catch {
      // Sin persistencia: el volumen vale sólo para esta sesión.
    }
  }
}
