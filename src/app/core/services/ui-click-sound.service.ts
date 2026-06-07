import { Injectable } from '@angular/core';

/** SFX de click de UI, compartido por todos los botones. Servido desde `public/`. */
export const UI_CLICK_AUDIO_PATH = '/audio/mixkit-camera-shutter-click-1133.wav';

/** Qué elementos cuentan como "botón" para disparar el click. */
const BUTTON_SELECTOR = 'button, [role="button"]';

/**
 * Reproduce un SFX de click en cualquier botón de la app mediante un único
 * listener global en fase de captura: así suena aunque un handler haga
 * `stopPropagation`, y no hay que cablear el sonido componente por componente.
 *
 * El click es un gesto del usuario, así que `play()` no choca con el bloqueo de
 * autoplay de iOS/WebKit (a diferencia de los SFX diferidos de la partida, que
 * se precalientan en `MatchCallAudioService`). Es no-bloqueante: nunca debe
 * romper la interacción si el audio falla.
 */
@Injectable({ providedIn: 'root' })
export class UiClickSoundService {
  private audio: HTMLAudioElement | null = null;
  private clickHandler: ((event: Event) => void) | null = null;

  /** Engancha el SFX a todos los botones de la app. Idempotente. */
  start(): void {
    if (this.clickHandler || typeof document === 'undefined') {
      return;
    }
    const handler = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(BUTTON_SELECTOR)) {
        this.play();
      }
    };
    this.clickHandler = handler;
    document.addEventListener('click', handler, true);
  }

  /** Desengancha el listener global. */
  stop(): void {
    if (!this.clickHandler || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('click', this.clickHandler, true);
    this.clickHandler = null;
  }

  private play(): void {
    const audio = this.getAudio();
    if (!audio) {
      return;
    }
    try {
      audio.currentTime = 0;
      const result = audio.play();
      if (result) {
        result.catch(() => undefined);
      }
    } catch {
      // El SFX de click es un realce no-bloqueante de la UI.
    }
  }

  private getAudio(): HTMLAudioElement | null {
    if (this.audio) {
      return this.audio;
    }
    try {
      this.audio = new Audio(UI_CLICK_AUDIO_PATH);
      return this.audio;
    } catch {
      return null;
    }
  }
}
