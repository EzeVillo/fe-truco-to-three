import { Injectable, inject } from '@angular/core';
import { AudioEngineService } from './audio-engine.service';
import { EffectsVolumeService } from './effects-volume.service';

/**
 * Canal de reproducción de SFX puntuales (cantos, carta tirada, jingles de
 * resultado, logro). Decodifica cada pista una vez a un `AudioBuffer` y dispara un
 * `AudioBufferSourceNode` por evento: latencia casi nula (clave para el SFX de
 * carta) y solapamiento de disparos.
 *
 * El contexto, el desbloqueo en iOS y la recuperación al volver del background los
 * gobierna el {@link AudioEngineService} compartido: acá sólo se reproduce. Si no
 * hay Web Audio (entorno de test/desktop viejo) se cae a `HTMLAudioElement`,
 * precalentado muteado en el primer gesto (vía `onUnlock` del engine).
 *
 * Todo es no-bloqueante: cualquier fallo se traga y nunca rompe el flujo visual.
 */
@Injectable({ providedIn: 'root' })
export class AudioPlaybackService {
  private readonly engine = inject(AudioEngineService);
  private readonly effectsVolume = inject(EffectsVolumeService);

  /** Buffers ya decodificados, por path. */
  private readonly buffers = new Map<string, AudioBuffer>();
  /** Decodificaciones en curso (evita relanzar fetch/decode), por path. */
  private readonly bufferLoads = new Map<string, Promise<void>>();
  /** Pistas registradas vía `preload` — se precalientan en el fallback `<audio>`. */
  private readonly registered = new Set<string>();
  /** Elementos `<audio>` del fallback, por path. */
  private readonly fallbackAudios = new Map<string, HTMLAudioElement>();

  private started = false;

  /** ¿Ya hubo un gesto que desbloqueó la reproducción? (delegado al engine). */
  readonly unlocked = this.engine.unlocked;

  /**
   * Registra en el engine el precalentado del fallback `<audio>` para el primer
   * gesto. Idempotente. El gesto y la recuperación por foreground los ancla el
   * propio engine (`AudioEngineService.start()`).
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.engine.onUnlock(() => this.unlockFallback());
  }

  /**
   * Precarga (decodifica) pistas para que el primer `play` suene sin esperar la
   * descarga. No requiere gesto: sólo hace fetch + decode. Idempotente por path.
   */
  preload(paths: Iterable<string>): void {
    for (const path of paths) {
      this.registered.add(path);
      this.loadBuffer(path);
    }
  }

  /**
   * Tras pedir un `resume()` por un SFX, sólo se reproduce si el contexto quedó
   * corriendo dentro de esta ventana. Si tardó más (p. ej. el resume quedó colgado
   * en background y recién resolvió al volver a la app), el SFX ya es viejo y se
   * descarta.
   */
  private static readonly RESUME_GRACE_MS = 250;

  /** Reproduce una pista. Si todavía se está decodificando, suena al terminar. */
  play(path: string): void {
    this.registered.add(path);
    const context = this.engine.getContext();

    if (this.engine.usingFallback || !context) {
      this.playFallback(path);
      return;
    }

    // `!== 'running'` y no `=== 'suspended'`: al volver del background iOS deja el
    // contexto en `interrupted` (estado WebKit) y también hay que reanudarlo.
    if (context.state !== 'running') {
      // Nunca agendar un source sobre un contexto parado: WebKit lo encola y lo
      // dispara cuando el contexto se reanuda, aunque sea minutos después (p. ej.
      // el jingle del final de la partida sonando más tarde en el lobby). Se intenta
      // reanudar y, sólo si quedó corriendo enseguida, se reproduce; si no, este SFX
      // se pierde (es un realce, no puede sonar a destiempo).
      const requestedAt = Date.now();
      this.loadBuffer(path); // que decodifique igual, para los próximos disparos
      context
        .resume()
        .then(() => {
          const fresh = Date.now() - requestedAt <= AudioPlaybackService.RESUME_GRACE_MS;
          if (fresh && context.state === 'running') {
            this.play(path);
          }
        })
        .catch(() => undefined);
      return;
    }

    const buffer = this.buffers.get(path);
    if (buffer) {
      this.playBuffer(buffer);
      return;
    }
    // Aún no decodificado: lo cargamos y disparamos al estar listo (best-effort).
    this.loadBuffer(path, true);
  }

  private loadBuffer(path: string, playWhenReady = false): void {
    const existing = this.buffers.get(path);
    if (existing) {
      if (playWhenReady) {
        this.playBuffer(existing);
      }
      return;
    }
    const context = this.engine.getContext();
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
    const context = this.engine.getContext();
    if (!context) {
      return;
    }
    // Cinturón para los caminos diferidos (decode al vuelo): si el contexto se paró
    // mientras tanto, descartar — un source agendado acá quedaría encolado y sonaría
    // a destiempo al próximo resume.
    if (context.state !== 'running') {
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

  /** Reproduce y pausa en silencio cada pista registrada para desbloquearla en iOS. */
  private unlockFallback(): void {
    if (!this.engine.usingFallback) {
      return;
    }
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
