import { Injectable, inject } from '@angular/core';
import { EffectsVolumeService } from './effects-volume.service';

/** SFX de click de UI, compartido por todos los botones. Servido desde `public/`. */
export const UI_CLICK_AUDIO_PATH = '/audio/mixkit-camera-shutter-click-1133.wav';

/**
 * Qué elementos cuentan como "botón" para disparar el click. Sumamos algunos `<a>`
 * de navegación que se ven y se usan como botones pero, al ser anchors, no matchean
 * `button`: los items del menú hamburguesa ("Mi perfil", "Amigos") y los tabs de
 * auth ("Iniciar sesión" / "Crear cuenta", donde el tab inactivo es un enlace).
 */
const BUTTON_SELECTOR =
  'button, [role="button"], a.global-header__menu-item, a.auth-tabs__tab';

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
 * Reproduce un SFX de click en cualquier botón de la app mediante un único
 * listener global en fase de captura: así suena aunque un handler haga
 * `stopPropagation`, y no hay que cablear el sonido componente por componente.
 *
 * Usa Web Audio API (no `HTMLAudioElement`): decodifica el WAV una sola vez a un
 * `AudioBuffer` y dispara un `AudioBufferSourceNode` por click. En iOS/WebKit un
 * `<audio>.play()` arranca una pipeline pesada (buffering + seek) que se siente
 * con delay perceptible; un buffer source ya decodificado suena con latencia
 * casi nula y permite solapar clicks. Cae a `HTMLAudioElement` si Web Audio no
 * está disponible. Es no-bloqueante: nunca debe romper la interacción.
 *
 * El click es un gesto del usuario, así que reanudar el contexto y reproducir no
 * choca con el bloqueo de autoplay de iOS/WebKit.
 */
@Injectable({ providedIn: 'root' })
export class UiClickSoundService {
  private readonly effectsVolume = inject(EffectsVolumeService);

  private clickHandler: ((event: Event) => void) | null = null;

  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  /** Evita relanzar el fetch/decode si ya está en curso o falló. */
  private bufferLoad: Promise<void> | null = null;

  /** Fallback cuando Web Audio no está disponible. */
  private fallbackAudio: HTMLAudioElement | null = null;
  private useFallback = false;

  /** Engancha el SFX a todos los botones de la app. Idempotente. */
  start(): void {
    if (this.clickHandler || typeof document === 'undefined') {
      return;
    }
    // Arrancamos el fetch/decode del buffer ya, para que el primer click suene
    // sin esperar la descarga.
    this.prepare();

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

  /** Crea el contexto y empieza a decodificar el buffer (best-effort). */
  private prepare(): void {
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) {
      this.useFallback = true;
      return;
    }
    if (!this.context) {
      try {
        this.context = new Ctor();
      } catch {
        this.useFallback = true;
        return;
      }
    }
    this.loadBuffer();
  }

  private loadBuffer(): void {
    if (this.buffer || this.bufferLoad || !this.context) {
      return;
    }
    const context = this.context;
    this.bufferLoad = (async () => {
      try {
        const response = await fetch(UI_CLICK_AUDIO_PATH);
        const data = await response.arrayBuffer();
        this.buffer = await context.decodeAudioData(data);
      } catch {
        // Si el decode falla, caemos al elemento <audio> en el próximo click.
        this.useFallback = true;
      }
    })();
  }

  private play(): void {
    const gainValue = this.effectsVolume.gain();
    if (gainValue <= 0) {
      // Efectos muteados: ni reanudamos el contexto ni disparamos el click.
      return;
    }

    if (this.useFallback || !this.context) {
      this.playFallback(gainValue);
      return;
    }

    // El click es un gesto válido: reanudamos el contexto si iOS lo suspendió.
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => undefined);
    }

    if (!this.buffer) {
      // Todavía decodificando: este click usa el fallback para no perderse.
      this.playFallback(gainValue);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      // GainNode por click: gobierna el volumen del bus de efectos en iOS.
      const gain = this.context.createGain();
      gain.gain.value = gainValue;
      source.connect(gain);
      gain.connect(this.context.destination);
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
