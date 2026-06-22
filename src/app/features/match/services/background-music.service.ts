import { Injectable, inject, signal } from '@angular/core';
import { AudioEngineService } from '../../../core/services/audio-engine.service';

/** Pista de fondo (guitarra criolla). Servida desde `public/`. */
export const BACKGROUND_MUSIC_PATH = 'audio/bp6zflyzky4-spanish-guitar-acoustic-538756.mp3';

const ENABLED_STORAGE_KEY = 't3.bgMusic.enabled';
const VOLUME_STORAGE_KEY = 't3.bgMusic.volume';

/** Volumen inicial bajo: la música arranca encendida pero discreta. */
const DEFAULT_VOLUME = 0.15;

/**
 * Fade-in al (re)arrancar. Suaviza la entrada y enmascara el fragmento bufferizado
 * de la posición anterior que iOS/WebKit desagota al reanudar: suena a gain 0 y sólo
 * se escucha desde el rebobinado.
 */
const FADE_IN_SECONDS = 0.6;

/**
 * Música de fondo de la partida (modo jugador y espectador). Mantiene un único
 * `HTMLAudioElement` en loop, ruteado por un `GainNode` para poder controlar el
 * volumen en iOS (donde `HTMLMediaElement.volume` es de solo lectura). El estado
 * (encendida + volumen) se persiste en localStorage entre partidas.
 *
 * El `AudioContext`, el desbloqueo en el primer gesto y la recuperación al volver
 * del background los gobierna el {@link AudioEngineService} compartido. Esta clase
 * **no** suspende el contexto al silenciar (lo comparte con los SFX y los clicks):
 * baja su propio `GainNode` a 0 y pausa el `<audio>`, lo que ya corta el sonido.
 * Para reanudar tras un gesto/foreground se registra en `onUnlock`/`onResume`.
 *
 * Si la Web Audio API no está disponible (entorno de test) se cae a `audio.volume`.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundMusicService {
  private readonly engine = inject(AudioEngineService);

  private audio: HTMLAudioElement | null = null;
  private gainNode: GainNode | null = null;
  private graphReady = false;
  private active = false;
  private hooksRegistered = false;

  private readonly _enabled = signal<boolean>(this.readEnabled());
  /** ¿El usuario quiere escuchar música? (toggle de mute). */
  readonly enabled = this._enabled.asReadonly();

  private readonly _volume = signal<number>(this.readVolume());
  /** Volumen actual en [0, 1]. */
  readonly volume = this._volume.asReadonly();

  /**
   * Arranca la música al entrar a una partida. Idempotente: el componente la llama
   * en un effect que se re-dispara en cada acción mientras la partida está
   * IN_PROGRESS, así que sólo rebobina en la transición inactivo→activo (primera
   * entrada o reentrada). El servicio es singleton y reutiliza el mismo
   * `HTMLAudioElement` entre partidas, por eso hay que rebobinar a mano.
   */
  start(): void {
    const wasActive = this.active;
    this.active = true;
    this.registerEngineHooks();
    if (!this._enabled()) {
      return;
    }
    this.ensureAudio();
    if (!wasActive) {
      this.rewind();
    }
    this.tryPlay();
  }

  /** Detiene la música al salir de la partida. */
  stop(): void {
    this.active = false;
    this.silence();
  }

  /**
   * Reintenta el play al primer gesto y al volver del background: el `<audio>.play()`
   * y el resume del contexto requieren un gesto en iOS. El engine corre estos hooks;
   * sólo actúan si la música está activa y encendida. Idempotente.
   */
  private registerEngineHooks(): void {
    if (this.hooksRegistered) {
      return;
    }
    this.hooksRegistered = true;
    this.engine.onUnlock(() => this.resumeIfActive());
    this.engine.onResume(() => this.resumeIfActive());
    // Al pasar a background frenamos: sin esto la música puede arrancar sola con el
    // celu guardado (un evento de la partida re-dispara `start()` y, con el contexto
    // compartido ya autorizado, iOS deja sonar `audio.play()` aunque no haya foco).
    this.engine.onHidden(() => this.silence());
  }

  private resumeIfActive(): void {
    if (this.active && this._enabled()) {
      this.tryPlay();
    }
  }

  /**
   * Silencia de inmediato bajando el gain a 0 y pausando el `<audio>`. No suspende el
   * contexto: es compartido con los SFX y los clicks, suspenderlo los apagaría.
   */
  private silence(): void {
    if (this.gainNode) {
      const gain = this.gainNode.gain;
      try {
        gain.cancelScheduledValues?.(this.engine.getContext()?.currentTime ?? 0);
      } catch {
        // Sin API de scheduling (entorno de test): basta con fijar el valor.
      }
      gain.value = 0;
    }
    this.audio?.pause();
  }

  /** Enciende/apaga la música; persiste la preferencia. */
  toggleEnabled(): void {
    const next = !this._enabled();
    this._enabled.set(next);
    this.persistEnabled(next);

    if (!next) {
      this.silence();
      return;
    }
    if (this.active) {
      this.ensureAudio();
      this.tryPlay();
    }
  }

  /** Ajusta el volumen en [0, 1]; persiste la preferencia. */
  setVolume(value: number): void {
    const clamped = Math.min(1, Math.max(0, value));
    this._volume.set(clamped);
    this.persistVolume(clamped);
    this.applyVolume();
  }

  /**
   * Rebobina la pista al inicio. En iOS/WebKit asignar `currentTime` puede lanzar si
   * el audio todavía no cargó metadata; va envuelto para no romper el arranque.
   */
  private rewind(): void {
    if (!this.audio) {
      return;
    }
    try {
      this.audio.currentTime = 0;
    } catch {
      // Sin metadata aún: arrancará desde la posición actual, no es crítico.
    }
  }

  private ensureAudio(): void {
    if (this.audio) {
      return;
    }
    try {
      const audio = new Audio(BACKGROUND_MUSIC_PATH);
      audio.loop = true;
      audio.volume = this._volume();
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
      gain.gain.value = this._volume();
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

  private applyVolume(): void {
    const value = this._volume();
    if (this.gainNode) {
      const gain = this.gainNode.gain;
      const context = this.engine.getContext();
      // Cancelar cualquier rampa de fade en curso para que el cambio del slider
      // mande; si no hay API de scheduling (test), fijar el valor.
      if (context && typeof gain.cancelScheduledValues === 'function') {
        try {
          const now = context.currentTime;
          gain.cancelScheduledValues(now);
          gain.setValueAtTime(value, now);
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

  /**
   * Sube el volumen desde 0 con un fade corto. La rampa se programa contra el reloj
   * del contexto; sin API de scheduling (test) fija el valor directamente.
   */
  private fadeInVolume(): void {
    const target = this._volume();
    const gain = this.gainNode?.gain;
    if (!gain) {
      this.applyVolume();
      return;
    }
    const context = this.engine.getContext();
    if (!context || typeof gain.setValueAtTime !== 'function') {
      gain.value = target;
      return;
    }
    try {
      const now = context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(0, now);
      gain.linearRampToValueAtTime(target, now + FADE_IN_SECONDS);
    } catch {
      gain.value = target;
    }
  }

  private tryPlay(): void {
    if (!this.audio) {
      return;
    }
    // Nunca reproducir con la app oculta: `start()` se re-dispara en cada evento de
    // la partida, así que sin este gate la música podía sonar sola en background.
    // Al volver a foreground, el hook `onResume` del engine la retoma.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    this.ensureGraph();
    this.fadeInVolume();
    // Reanuda el contexto compartido si iOS lo suspendió; si exige un gesto nuevo,
    // el hook de `onUnlock`/`onResume` reintenta al próximo toque/foreground.
    this.engine.resume();
    try {
      const result = this.audio.play();
      if (result) {
        result.catch(() => undefined);
      }
    } catch {
      // El audio es un realce: un fallo no debe romper el flujo de la partida.
    }
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
