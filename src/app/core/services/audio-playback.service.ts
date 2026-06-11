import { Injectable, inject, signal } from '@angular/core';
import { EffectsVolumeService } from './effects-volume.service';

type AudioContextCtor = typeof AudioContext;

/** Resuelve el constructor de AudioContext (incluye el prefijo webkit de iOS). */
function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Canal único de reproducción de SFX puntuales (cantos, carta tirada, jingles de
 * resultado, logro). Punto de verdad del **desbloqueo de audio en iOS/WebKit**.
 *
 * Por qué centralizado: en WebKit la reproducción de audio queda bloqueada hasta
 * un gesto del usuario. Antes cada servicio enganchaba su propio unlock en el
 * constructor (lazy): los listeners se registraban recién al primer inject —
 * p. ej. al entrar a espectar— es decir *después* del tap de navegación, con lo
 * que el primer SFX de la primera partida no sonaba. Aquí el unlock se ancla una
 * sola vez al bootstrap (`start()` desde `App`), de modo que los listeners de
 * gesto están activos desde el primer toque de la sesión, sin depender de cuándo
 * se cree cada servicio de audio.
 *
 * Por qué Web Audio: con un único `AudioContext`, un solo `resume()` en el primer
 * gesto desbloquea **toda** reproducción futura —cualquier buffer, en cualquier
 * momento, dentro o fuera de un gesto— sin tener que "precalentar" cada pista. Un
 * `AudioBufferSourceNode` decodificado además suena con latencia casi nula
 * (clave para el SFX de carta) y permite solapar disparos. Si la Web Audio API no
 * está disponible (entorno de test/desktop viejo) se cae a `HTMLAudioElement`,
 * conservando el viejo precalentado muteado en el gesto como desbloqueo.
 *
 * Todo es no-bloqueante: cualquier fallo se traga (try/catch) y nunca rompe el
 * flujo visual de la partida.
 */
@Injectable({ providedIn: 'root' })
export class AudioPlaybackService {
  private readonly effectsVolume = inject(EffectsVolumeService);

  private context: AudioContext | null = null;
  private useFallback = false;

  /** Buffers ya decodificados, por path. */
  private readonly buffers = new Map<string, AudioBuffer>();
  /** Decodificaciones en curso (evita relanzar fetch/decode), por path. */
  private readonly bufferLoads = new Map<string, Promise<void>>();
  /** Pistas registradas vía `preload` — se precalientan en el fallback `<audio>`. */
  private readonly registered = new Set<string>();
  /** Elementos `<audio>` del fallback, por path. */
  private readonly fallbackAudios = new Map<string, HTMLAudioElement>();

  private gestureHandler: (() => void) | null = null;

  private readonly _unlocked = signal(false);
  /** ¿Ya hubo un gesto que desbloqueó la reproducción? */
  readonly unlocked = this._unlocked.asReadonly();

  private visibilityHandler: (() => void) | null = null;

  /**
   * Ancla el desbloqueo al primer gesto del usuario y la recuperación al volver
   * del background. Idempotente. Llamar una vez al bootstrap (`App`) para que
   * los listeners existan antes de cualquier navegación.
   */
  start(): void {
    if (typeof document === 'undefined') {
      return;
    }
    this.ensureContext();
    this.attachGesture();
    this.attachVisibilityRecovery();
  }

  private attachGesture(): void {
    if (this.gestureHandler || typeof document === 'undefined') {
      return;
    }
    const handler = () => this.unlock();
    this.gestureHandler = handler;
    document.addEventListener('pointerdown', handler);
    document.addEventListener('touchend', handler);
    document.addEventListener('keydown', handler);
  }

  /**
   * Recuperación tras salir y volver a la app en iOS/WebKit: al ir a background
   * (o al ceder el audio a otra app) el contexto queda `interrupted` —estado
   * propio de WebKit, distinto de `suspended`— y no vuelve solo a `running`. Sin
   * esto, al regresar a la pestaña los SFX quedan mudos. Al volver a visible (o
   * restaurar desde el bfcache vía `pageshow`) reanudamos; si WebKit exige un
   * gesto nuevo para reanudar, re-armamos el unlock para que el próximo toque
   * lo haga.
   */
  private attachVisibilityRecovery(): void {
    if (this.visibilityHandler || typeof document === 'undefined') {
      return;
    }
    const handler = () => {
      if (document.visibilityState === 'visible') {
        this.recoverFromInterruption();
      }
    };
    this.visibilityHandler = handler;
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('pageshow', handler);
  }

  private recoverFromInterruption(): void {
    const context = this.context;
    if (!context || context.state === 'running') {
      return;
    }
    context
      .resume()
      .then(() => {
        if (context.state !== 'running') {
          this.rearmGestureUnlock();
        }
      })
      .catch(() => this.rearmGestureUnlock());
  }

  /** El resume sin gesto falló: volvemos al modo "esperando el primer toque". */
  private rearmGestureUnlock(): void {
    this._unlocked.set(false);
    this.attachGesture();
  }

  /**
   * Precarga (decodifica) pistas para que el primer `play` suene sin esperar la
   * descarga. No requiere gesto: sólo hace fetch + decode. Idempotente por path.
   */
  preload(paths: Iterable<string>): void {
    this.ensureContext();
    for (const path of paths) {
      this.registered.add(path);
      this.loadBuffer(path);
    }
  }

  /** Reproduce una pista. Si todavía se está decodificando, suena al terminar. */
  play(path: string): void {
    this.registered.add(path);
    this.ensureContext();

    if (this.useFallback || !this.context) {
      this.playFallback(path);
      return;
    }

    // Gesto o no, reanudamos por las dudas: tras el primer unlock es no-op.
    // `!== 'running'` y no `=== 'suspended'`: al volver del background iOS deja
    // el contexto en `interrupted` (estado WebKit) y también hay que reanudarlo.
    if (this.context.state !== 'running') {
      this.context.resume().catch(() => undefined);
    }

    const buffer = this.buffers.get(path);
    if (buffer) {
      this.playBuffer(buffer);
      return;
    }
    // Aún no decodificado: lo cargamos y disparamos al estar listo (best-effort).
    this.loadBuffer(path, true);
  }

  private ensureContext(): void {
    if (this.context || this.useFallback) {
      return;
    }
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) {
      this.useFallback = true;
      return;
    }
    try {
      this.context = new Ctor();
    } catch {
      this.useFallback = true;
    }
  }

  private loadBuffer(path: string, playWhenReady = false): void {
    const existing = this.buffers.get(path);
    if (existing) {
      if (playWhenReady) {
        this.playBuffer(existing);
      }
      return;
    }
    const context = this.context;
    if (!context) {
      if (playWhenReady) {
        this.playFallback(path);
      }
      return;
    }

    let load = this.bufferLoads.get(path);
    if (!load) {
      load = (async () => {
        try {
          const response = await fetch(path);
          const data = await response.arrayBuffer();
          this.buffers.set(path, await context.decodeAudioData(data));
        } catch {
          // Decode fallido: la pista caerá al fallback `<audio>` al reproducir.
        }
      })();
      this.bufferLoads.set(path, load);
    }

    if (playWhenReady) {
      void load.then(() => {
        const buffer = this.buffers.get(path);
        if (buffer) {
          this.playBuffer(buffer);
        } else {
          this.playFallback(path);
        }
      });
    }
  }

  private playBuffer(buffer: AudioBuffer): void {
    const context = this.context;
    if (!context) {
      return;
    }
    const gainValue = this.effectsVolume.gain();
    if (gainValue <= 0) {
      // Efectos muteados: no malgastamos un source silencioso.
      return;
    }
    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      // GainNode por disparo: gobierna el volumen del bus de efectos en iOS.
      const gain = context.createGain();
      gain.gain.value = gainValue;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);
    } catch {
      // El SFX es un realce no-bloqueante de la partida.
    }
  }

  /** Desbloqueo en el gesto: reanuda el contexto (Web Audio) o precalienta `<audio>`. */
  private unlock(): void {
    this.ensureContext();
    const context = this.context;
    if (!context) {
      this.unlockFallback();
      this.finishUnlock();
      return;
    }
    if (context.state !== 'running') {
      context
        .resume()
        .then(() => this.finishUnlock())
        .catch(() => undefined);
    } else {
      this.finishUnlock();
    }
  }

  private finishUnlock(): void {
    if (this._unlocked()) {
      return;
    }
    this._unlocked.set(true);
    this.detachGesture();
  }

  private detachGesture(): void {
    if (!this.gestureHandler || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', this.gestureHandler);
    document.removeEventListener('touchend', this.gestureHandler);
    document.removeEventListener('keydown', this.gestureHandler);
    this.gestureHandler = null;
  }

  /** Reproduce y pausa en silencio cada pista registrada para desbloquearla en iOS. */
  private unlockFallback(): void {
    for (const path of this.registered) {
      const audio = this.getFallbackAudio(path);
      if (!audio) {
        continue;
      }
      try {
        audio.muted = true;
        const result = audio.play();
        const reset = () => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {
            // El reset es best-effort: el elemento ya quedó desbloqueado.
          }
          audio.muted = false;
        };
        if (result) {
          result.then(reset).catch(() => {
            audio.muted = false;
          });
        } else {
          reset();
        }
      } catch {
        audio.muted = false;
      }
    }
  }

  private playFallback(path: string): void {
    const gainValue = this.effectsVolume.gain();
    if (gainValue <= 0) {
      return;
    }
    const audio = this.getFallbackAudio(path);
    if (!audio) {
      return;
    }
    try {
      audio.volume = gainValue;
      audio.currentTime = 0;
      const result = audio.play();
      if (result) {
        result.catch(() => undefined);
      }
    } catch {
      // El SFX es un realce no-bloqueante de la partida.
    }
  }

  private getFallbackAudio(path: string): HTMLAudioElement | null {
    const cached = this.fallbackAudios.get(path);
    if (cached) {
      return cached;
    }
    try {
      const audio = new Audio(path);
      this.fallbackAudios.set(path, audio);
      return audio;
    } catch {
      return null;
    }
  }
}
