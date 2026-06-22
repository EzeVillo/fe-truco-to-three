import { Injectable, signal } from '@angular/core';

/** Pista de fondo (guitarra criolla). Servida desde `public/`. */
export const BACKGROUND_MUSIC_PATH = 'audio/bp6zflyzky4-spanish-guitar-acoustic-538756.mp3';

const ENABLED_STORAGE_KEY = 't3.bgMusic.enabled';
const VOLUME_STORAGE_KEY = 't3.bgMusic.volume';

/** Volumen inicial bajo: la música arranca encendida pero discreta. */
const DEFAULT_VOLUME = 0.15;

/**
 * Fade-in al (re)arrancar. Además de suavizar la entrada, enmascara el
 * fragmento bufferizado de la posición anterior que iOS/WebKit desagota al
 * reanudar el AudioContext suspendido: suena a gain 0 y sólo se escucha desde
 * el rebobinado. Sin esto, al reentrar a una partida se oía "seguir donde
 * quedó" y luego el arranque desde el principio.
 */
const FADE_IN_SECONDS = 0.6;

type AudioContextCtor = typeof AudioContext;

/**
 * Música de fondo de la partida (modo jugador y espectador). Mantiene un único
 * `HTMLAudioElement` en loop. El estado (encendida + volumen) se persiste en
 * localStorage para respetar la preferencia del usuario entre partidas.
 *
 * Volumen en iOS: `HTMLMediaElement.volume` es de **solo lectura** en WebKit
 * (iPhone/iPad, tanto Safari como Chrome) — asignarlo no hace nada y el slider
 * quedaría inerte. Para poder controlarlo se enruta el audio por la Web Audio
 * API y se ajusta un `GainNode`, cuyo `gain` sí es escribible en iOS. Si la Web
 * Audio API no está disponible (p. ej. entorno de test) se cae a `audio.volume`,
 * que alcanza en desktop.
 *
 * Autoplay: los navegadores bloquean `play()` (y dejan el AudioContext
 * `suspended`) hasta la primera interacción del usuario. Si el `play()` inicial
 * es rechazado, se reintenta una sola vez al primer gesto (pointerdown/keydown).
 */
@Injectable({ providedIn: 'root' })
export class BackgroundMusicService {
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private graphReady = false;
  private active = false;
  private unlockHandler: (() => void) | null = null;

  private readonly _enabled = signal<boolean>(this.readEnabled());
  /** ¿El usuario quiere escuchar música? (toggle de mute). */
  readonly enabled = this._enabled.asReadonly();

  private readonly _volume = signal<number>(this.readVolume());
  /** Volumen actual en [0, 1]. */
  readonly volume = this._volume.asReadonly();

  /**
   * Arranca la música al entrar a una partida. Idempotente: el componente la
   * llama en un effect que se re-dispara en cada acción mientras la partida está
   * IN_PROGRESS, así que sólo rebobina en la transición inactivo→activo (primera
   * entrada o reentrada). El servicio es singleton y reutiliza el mismo
   * `HTMLAudioElement` entre partidas, por eso hay que rebobinar a mano.
   */
  start(): void {
    const wasActive = this.active;
    this.active = true;
    this.attachVisibilityResume();
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
    this.detachUnlock();
    this.silence();
  }

  /**
   * Silencia de inmediato y frena el grafo. En iOS el audio ruteado por el grafo
   * (MediaElementSource → GainNode → destination) no corta al instante con
   * `pause()`: queda un tail bufferizado sonando un par de segundos. Bajamos el
   * gain a 0 para silenciar ya y suspendemos el contexto para frenar el grafo;
   * el próximo `tryPlay()` reanuda y `fadeInVolume()` restaura el volumen.
   */
  private silence(): void {
    if (this.gainNode) {
      const gain = this.gainNode.gain;
      try {
        gain.cancelScheduledValues?.(this.audioContext?.currentTime ?? 0);
      } catch {
        // Sin API de scheduling (entorno de test): basta con fijar el valor.
      }
      gain.value = 0;
    }
    this.audio?.pause();
    void this.audioContext?.suspend?.().catch(() => undefined);
  }

  /** Enciende/apaga la música; persiste la preferencia. */
  toggleEnabled(): void {
    const next = !this._enabled();
    this._enabled.set(next);
    this.persistEnabled(next);

    if (!next) {
      this.detachUnlock();
      // `silence()` (no sólo `audio.pause()`): en iOS el tail del grafo seguía
      // sonando ~3 s tras mutear. Bajar el gain y suspender corta al instante.
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
   * Rebobina la pista al inicio. En iOS/WebKit asignar `currentTime` puede
   * lanzar si el audio todavía no cargó metadata; va envuelto para no romper el
   * arranque (el audio es enhancement).
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
   * Enruta el `<audio>` por un GainNode para poder controlar el volumen en iOS.
   * Sin Web Audio (entorno de test) no hace nada y se usa `audio.volume`.
   */
  private ensureGraph(): void {
    if (this.graphReady || !this.audio) {
      return;
    }
    const Ctor = this.resolveAudioContextCtor();
    if (!Ctor) {
      return;
    }
    try {
      const context = new Ctor();
      const source = context.createMediaElementSource(this.audio);
      const gain = context.createGain();
      gain.gain.value = this._volume();
      source.connect(gain);
      gain.connect(context.destination);
      this.audioContext = context;
      this.gainNode = gain;
      this.graphReady = true;
      // El elemento va a nivel pleno; el gain pasa a gobernar el volumen real.
      this.audio.volume = 1;
    } catch {
      this.audioContext = null;
      this.gainNode = null;
      this.graphReady = false;
    }
  }

  private applyVolume(): void {
    const value = this._volume();
    if (this.gainNode) {
      const gain = this.gainNode.gain;
      const context = this.audioContext;
      // Cancelar cualquier rampa de fade en curso para que el cambio de volumen
      // del slider mande; si no hay API de scheduling (test), fijar el valor.
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
   * Sube el volumen desde 0 con un fade corto. La rampa se programa contra el
   * reloj del contexto (aunque esté suspendido): cuando se reanuda, el fragmento
   * bufferizado de la posición anterior se desagota a gain 0 y sólo se oye desde
   * el rebobinado. Sin API de scheduling (test) fija el valor directamente.
   */
  private fadeInVolume(): void {
    const target = this._volume();
    const gain = this.gainNode?.gain;
    if (!gain) {
      this.applyVolume();
      return;
    }
    const context = this.audioContext;
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
    this.ensureGraph();
    this.fadeInVolume();
    // El AudioContext arranca suspended hasta un gesto del usuario (iOS/Chrome).
    // Si el resume es rechazado (WebKit exigiendo gesto), el `<audio>` sonaría
    // mudo a través del grafo suspendido sin que `play()` rechace: re-armamos
    // el unlock para reintentar todo al próximo toque.
    void this.audioContext?.resume().catch(() => this.attachUnlock());
    try {
      const result = this.audio.play();
      if (result) {
        result.catch(() => this.attachUnlock());
      }
    } catch {
      this.attachUnlock();
    }
  }

  private visibilityHandler: (() => void) | null = null;

  /**
   * Retoma la música al volver del background en iOS/WebKit: al salir de la app
   * el sistema pausa el `<audio>` y deja el AudioContext `interrupted` (estado
   * WebKit, distinto de `suspended`), y nada de eso se revierte solo al volver.
   * Al pasar a visible (o restaurar desde el bfcache vía `pageshow`), si la
   * partida sigue activa y la música encendida, se reintenta el play completo
   * (resume del contexto incluido). Si WebKit exige un gesto nuevo, `tryPlay`
   * ya re-arma el unlock. El handler queda anclado de por vida (servicio root)
   * y se autoexcluye con `active`/`enabled`.
   */
  private attachVisibilityResume(): void {
    if (this.visibilityHandler || typeof document === 'undefined') {
      return;
    }
    const handler = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (this.active && this._enabled()) {
        this.tryPlay();
      }
    };
    this.visibilityHandler = handler;
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('pageshow', handler);
  }

  /** Reintenta el play al primer gesto del usuario (autoplay bloqueado). */
  private attachUnlock(): void {
    if (this.unlockHandler || typeof document === 'undefined') {
      return;
    }
    const handler = () => {
      this.detachUnlock();
      if (this.active && this._enabled()) {
        this.tryPlay();
      }
    };
    this.unlockHandler = handler;
    document.addEventListener('pointerdown', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
  }

  private detachUnlock(): void {
    if (!this.unlockHandler || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', this.unlockHandler);
    document.removeEventListener('keydown', this.unlockHandler);
    this.unlockHandler = null;
  }

  private resolveAudioContextCtor(): AudioContextCtor | null {
    if (typeof AudioContext !== 'undefined') {
      return AudioContext;
    }
    const webkit = (globalThis as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    return webkit ?? null;
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
