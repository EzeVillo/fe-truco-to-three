import { Injectable, effect, inject } from '@angular/core';
import { AudioEngineService } from '../../../core/services/audio-engine.service';
import { EffectsVolumeService } from '../../../core/services/effects-volume.service';

/** Tic-tac de reloj en loop. Servido desde `public/`. */
export const TURN_TIMER_SOUND_PATH = 'audio/turn-timer-tick.wav';

/**
 * Tic-tac de urgencia del temporizador de turno (feature 013-turn-timer). Suena en
 * loop mientras el plazo propio está en zona roja (≤ 5 s) y se corta al actuar o al
 * agotarse. Mantiene un único `HTMLAudioElement` en loop, ruteado por un `GainNode`
 * del contexto compartido para controlar el volumen en iOS (donde
 * `HTMLMediaElement.volume` es de solo lectura).
 *
 * Comparte el **bus de efectos** ({@link EffectsVolumeService}): respeta el mute y el
 * volumen de SFX, no tiene preferencia propia. El `AudioContext`, el desbloqueo en el
 * primer gesto y la recuperación al volver del background los gobierna el
 * {@link AudioEngineService} compartido (igual que la música de fondo).
 *
 * Sin Web Audio (entorno de test) cae a `audio.volume`. Todo es no-bloqueante: un
 * fallo nunca rompe el flujo de la partida.
 */
@Injectable({ providedIn: 'root' })
export class TurnTimerSoundService {
  private readonly engine = inject(AudioEngineService);
  private readonly effectsVolume = inject(EffectsVolumeService);

  private audio: HTMLAudioElement | null = null;
  private gainNode: GainNode | null = null;
  private graphReady = false;
  private active = false;
  private hooksRegistered = false;

  constructor() {
    // Refleja en vivo el volumen/mute del bus de efectos en el gain del loop.
    effect(() => {
      const gain = this.effectsVolume.gain();
      this.applyGain(gain);
    });
  }

  /**
   * Arranca el tic-tac. Idempotente: el componente lo llama desde un effect que se
   * re-dispara en cada tick del temporizador (200 ms) mientras el plazo está en rojo,
   * así que sólo actúa en la transición inactivo→activo.
   */
  start(): void {
    this.registerEngineHooks();
    if (this.active) {
      return;
    }
    this.active = true;
    this.ensureAudio();
    this.tryPlay();
  }

  /** Detiene el tic-tac (al actuar, agotarse el plazo o salir de la partida). */
  stop(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.silence();
  }

  /**
   * Reintenta el play al primer gesto y al volver del background: `audio.play()` y el
   * resume del contexto requieren un gesto en iOS. Al pasar a background frena. El
   * engine corre estos hooks; sólo actúan si el tic-tac está activo. Idempotente.
   */
  private registerEngineHooks(): void {
    if (this.hooksRegistered) {
      return;
    }
    this.hooksRegistered = true;
    this.engine.onUnlock(() => this.resumeIfActive());
    this.engine.onResume(() => this.resumeIfActive());
    this.engine.onHidden(() => this.silence());
  }

  private resumeIfActive(): void {
    if (this.active) {
      this.tryPlay();
    }
  }

  /** Silencia pausando el `<audio>`. No toca el gain (lo gobierna el bus de efectos). */
  private silence(): void {
    this.audio?.pause();
  }

  private ensureAudio(): void {
    if (this.audio) {
      return;
    }
    try {
      const audio = new Audio(TURN_TIMER_SOUND_PATH);
      audio.loop = true;
      audio.volume = this.effectsVolume.gain();
      this.audio = audio;
    } catch {
      this.audio = null;
    }
  }

  /**
   * Enruta el `<audio>` por un GainNode (del contexto compartido) para controlar el
   * volumen en iOS. Sin Web Audio (entorno de test) no hace nada y se usa
   * `audio.volume`.
   */
  private ensureGraph(): void {
    if (this.graphReady || !this.audio) {
      return;
    }
    const context = this.engine.getContext();
    if (!context) {
      return;
    }
    try {
      const source = context.createMediaElementSource(this.audio);
      const gain = context.createGain();
      gain.gain.value = this.effectsVolume.gain();
      source.connect(gain);
      gain.connect(context.destination);
      this.gainNode = gain;
      this.graphReady = true;
      // El elemento va a nivel pleno; el gain pasa a gobernar el volumen real.
      this.audio.volume = 1;
    } catch {
      this.gainNode = null;
      this.graphReady = false;
    }
  }

  private applyGain(value: number): void {
    if (this.gainNode) {
      const gain = this.gainNode.gain;
      const context = this.engine.getContext();
      if (context && typeof gain.setValueAtTime === 'function') {
        try {
          gain.setValueAtTime(value, context.currentTime);
          return;
        } catch {
          // Cae al asignado directo.
        }
      }
      gain.value = value;
    } else if (this.audio) {
      this.audio.volume = value;
    }
  }

  private tryPlay(): void {
    if (!this.audio) {
      return;
    }
    // Nunca reproducir con la app oculta; al volver a foreground el hook `onResume`
    // del engine la retoma.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    this.ensureGraph();
    this.applyGain(this.effectsVolume.gain());
    // Reanuda el contexto compartido si iOS lo suspendió; si exige un gesto nuevo, el
    // hook de `onUnlock`/`onResume` reintenta al próximo toque/foreground.
    this.engine.resume();
    try {
      // Arranca el tic-tac desde el inicio para que el primer golpe se oiga entero.
      this.audio.currentTime = 0;
      const result = this.audio.play();
      if (result) {
        result.catch(() => undefined);
      }
    } catch {
      // El audio es un realce: un fallo no debe romper el flujo de la partida.
    }
  }
}
