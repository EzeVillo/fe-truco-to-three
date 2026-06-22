import { Injectable, inject } from '@angular/core';
import { AudioEngineService } from './audio-engine.service';
import { EffectsVolumeService } from './effects-volume.service';

/** SFX de click de UI, compartido por todos los botones. Servido desde `public/`. */
export const UI_CLICK_AUDIO_PATH = 'audio/mixkit-camera-shutter-click-1133.mp3';

/**
 * Qué elementos cuentan como "botón" para disparar el click. Además de los
 * `<button>` reales, cualquier elemento marcado con `data-ui-click`. Usamos ese
 * marcador explícito (en vez de enumerar clases acá) para los `<a>` de navegación
 * que se ven y se usan como botones pero, al ser anchors, no matchean `button`:
 * así la intención vive en cada elemento y no hay que mantener una lista de clases
 * sincronizada en este service.
 */
const BUTTON_SELECTOR = 'button, [role="button"], [data-ui-click]';

/**
 * Reproduce un SFX de click en cualquier botón de la app mediante un único listener
 * global en fase de captura: así suena aunque un handler haga `stopPropagation`, y
 * no hay que cablear el sonido componente por componente.
 *
 * Decodifica el WAV una vez a un `AudioBuffer` y dispara un `AudioBufferSourceNode`
 * por click (latencia casi nula vs. `<audio>.play()`, que en iOS arranca una
 * pipeline pesada con delay perceptible). El contexto compartido, el desbloqueo en
 * iOS y la recuperación al volver del background los gobierna el
 * {@link AudioEngineService}; el click es en sí un gesto válido, así que también
 * reanuda el contexto si quedó parado. Cae a `HTMLAudioElement` si no hay Web Audio.
 * Es no-bloqueante: nunca debe romper la interacción.
 */
@Injectable({ providedIn: 'root' })
export class UiClickSoundService {
  private readonly engine = inject(AudioEngineService);
  private readonly effectsVolume = inject(EffectsVolumeService);

  private clickHandler: ((event: Event) => void) | null = null;

  private buffer: AudioBuffer | null = null;
  /** Evita relanzar el fetch/decode si ya está en curso o falló. */
  private bufferLoad: Promise<void> | null = null;

  /** Fallback cuando Web Audio no está disponible. */
  private fallbackAudio: HTMLAudioElement | null = null;

  /** Engancha el SFX a todos los botones de la app. Idempotente. */
  start(): void {
    if (this.clickHandler || typeof document === 'undefined') {
      return;
    }
    // Arrancamos el fetch/decode del buffer ya, para que el primer click suene sin
    // esperar la descarga.
    this.loadBuffer();

    const handler = (event: Event) => {
      const target = event.target as Element | null;
      if (!target?.closest?.(BUTTON_SELECTOR)) {
        return;
      }
      // Los botones con `appTapAction` disparan el SFX desde la directiva (en el tap
      // válido). En táctil, con `setPointerCapture`, el `click` nativo deja de
      // dispararse de forma fiable, así que acá los ignoramos para que no queden
      // mudos ni suenen dos veces cuando el click sí llega.
      if (target.closest('[appTapAction]')) {
        return;
      }
      this.play();
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

  private loadBuffer(): void {
    if (this.buffer || this.bufferLoad) {
      return;
    }
    const context = this.engine.getContext();
    if (!context) {
      return; // Sin Web Audio: el click sale por el `<audio>` del fallback.
    }
    this.bufferLoad = (async () => {
      try {
        const response = await fetch(UI_CLICK_AUDIO_PATH);
        const data = await response.arrayBuffer();
        this.buffer = await context.decodeAudioData(data);
      } catch {
        // Si el decode falla, el `buffer` queda null y el click cae al `<audio>`.
      }
    })();
  }

  /**
   * Reproduce el SFX de click. Pensado para llamarse dentro de un gesto del usuario
   * (click nativo o el `tap` de `appTapAction`): así el resume del contexto no choca
   * con el bloqueo de autoplay de iOS.
   */
  play(): void {
    const gainValue = this.effectsVolume.gain();
    if (gainValue <= 0) {
      // Efectos muteados: ni reanudamos el contexto ni disparamos el click.
      return;
    }

    const context = this.engine.getContext();
    if (this.engine.usingFallback || !context) {
      this.playFallback(gainValue);
      return;
    }

    // El click es un gesto válido: reanudamos el contexto si iOS lo suspendió.
    // `!== 'running'` y no `=== 'suspended'`: al volver del background iOS deja el
    // contexto en `interrupted` (estado WebKit) y también hay que reanudarlo.
    if (context.state !== 'running') {
      context.resume().catch(() => undefined);
      // No agendar el source sobre un contexto parado: WebKit lo encolaría y sonaría
      // a destiempo al próximo resume. Este click sale por el fallback `<audio>`, que
      // sí puede sonar dentro del gesto.
      this.playFallback(gainValue);
      return;
    }

    if (!this.buffer) {
      // Todavía decodificando (o decode fallido): este click usa el fallback.
      this.loadBuffer();
      this.playFallback(gainValue);
      return;
    }

    try {
      const source = context.createBufferSource();
      source.buffer = this.buffer;
      // GainNode por click: gobierna el volumen del bus de efectos en iOS.
      const gain = context.createGain();
      gain.gain.value = gainValue;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);
    } catch {
      // El SFX de click es un realce no-bloqueante de la UI.
    }
  }

  private playFallback(gainValue: number): void {
    const audio = this.getFallbackAudio();
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
      // El SFX de click es un realce no-bloqueante de la UI.
    }
  }

  private getFallbackAudio(): HTMLAudioElement | null {
    if (this.fallbackAudio) {
      return this.fallbackAudio;
    }
    try {
      this.fallbackAudio = new Audio(UI_CLICK_AUDIO_PATH);
      return this.fallbackAudio;
    } catch {
      return null;
    }
  }
}
