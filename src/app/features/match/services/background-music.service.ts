import { Injectable, signal } from '@angular/core';

/** Pista de fondo (guitarra criolla). Servida desde `public/`. */
export const BACKGROUND_MUSIC_PATH = '/audio/bp6zflyzky4-spanish-guitar-acoustic-538756.mp3';

const ENABLED_STORAGE_KEY = 't3.bgMusic.enabled';
const VOLUME_STORAGE_KEY = 't3.bgMusic.volume';

/** Volumen inicial bajo: la música arranca encendida pero discreta. */
const DEFAULT_VOLUME = 0.15;

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

  /** Arranca la música al entrar a una partida. Idempotente. */
  start(): void {
    this.active = true;
    if (!this._enabled()) {
      return;
    }
    this.ensureAudio();
    this.tryPlay();
  }

  /** Detiene la música al salir de la partida. */
  stop(): void {
    this.active = false;
    this.detachUnlock();
    // En iOS el audio ruteado por el grafo (MediaElementSource → GainNode →
    // destination) no corta al instante con `pause()`: queda un tail bufferizado
    // sonando un par de segundos. Bajamos el gain a 0 para silenciar de
    // inmediato y suspendemos el contexto para frenar el grafo; el próximo
    // `start()` reanuda y `applyVolume()` restaura el volumen.
    if (this.gainNode) {
      this.gainNode.gain.value = 0;
    }
    if (this.audio) {
      this.audio.pause();
    }
    void this.audioContext?.suspend().catch(() => undefined);
  }

  /** Enciende/apaga la música; persiste la preferencia. */
  toggleEnabled(): void {
    const next = !this._enabled();
    this._enabled.set(next);
    this.persistEnabled(next);

    if (!next) {
      this.detachUnlock();
      this.audio?.pause();
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
      this.gainNode.gain.value = value;
    } else if (this.audio) {
      this.audio.volume = value;
    }
  }

  private tryPlay(): void {
    if (!this.audio) {
      return;
    }
    this.ensureGraph();
    this.applyVolume();
    // El AudioContext arranca suspended hasta un gesto del usuario (iOS/Chrome).
    void this.audioContext?.resume().catch(() => undefined);
    try {
      const result = this.audio.play();
      if (result) {
        result.catch(() => this.attachUnlock());
      }
    } catch {
      this.attachUnlock();
    }
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
