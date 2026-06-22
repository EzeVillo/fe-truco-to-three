import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngineService } from './audio-engine.service';
import { AudioPlaybackService } from './audio-playback.service';
import { EffectsVolumeService } from './effects-volume.service';

interface GainMock {
  gain: { value: number };
  connect: ReturnType<typeof vi.fn>;
}

interface BufferSourceMock {
  buffer: unknown;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
}

interface ContextMock {
  state: AudioContextState;
  destination: unknown;
  resume: ReturnType<typeof vi.fn>;
  decodeAudioData: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  sources: BufferSourceMock[];
  gains: GainMock[];
}

function makeService(): AudioPlaybackService {
  return TestBed.inject(AudioPlaybackService);
}

describe('AudioPlaybackService', () => {
  let contexts: ContextMock[];
  let listeners: Map<string, () => void>;
  const decodedBuffer = { decoded: true };

  /** Espera a que se resuelvan las promesas encoladas (fetch/decode). */
  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    contexts = [];
    listeners = new Map();
    try {
      localStorage.clear();
    } catch {
      // Sin localStorage en el entorno de test: nada que limpiar.
    }
    TestBed.configureTestingModule({});

    vi.stubGlobal('AudioContext', function AudioContextMockCtor(this: ContextMock) {
      this.state = 'running';
      this.destination = { id: 'destination' };
      this.sources = [];
      this.gains = [];
      this.resume = vi.fn().mockResolvedValue(undefined);
      this.decodeAudioData = vi.fn().mockResolvedValue(decodedBuffer);
      this.createBufferSource = vi.fn(() => {
        const source: BufferSourceMock = { buffer: null, connect: vi.fn(), start: vi.fn() };
        this.sources.push(source);
        return source;
      });
      this.createGain = vi.fn(() => {
        const gain: GainMock = { gain: { value: 1 }, connect: vi.fn() };
        this.gains.push(gain);
        return gain;
      });
      contexts.push(this);
    });
    vi.stubGlobal('window', {
      AudioContext: globalThis.AudioContext,
      addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preload decodifica cada pista una sola vez', async () => {
    const service = makeService();
    service.preload(['/a.mp3', '/b.mp3']);
    service.preload(['/a.mp3']); // repetida: no re-decodifica
    await flush();

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(contexts[0].decodeAudioData).toHaveBeenCalledTimes(2);
  });

  it('play dispara un buffer source con la pista decodificada', async () => {
    const service = makeService();
    service.preload(['/a.mp3']);
    await flush();

    service.play('/a.mp3');

    const ctx = contexts[0];
    expect(ctx.createBufferSource).toHaveBeenCalledOnce();
    expect(ctx.sources[0].buffer).toBe(decodedBuffer);
    // El source pasa por el GainNode del bus de efectos, y éste a destination.
    expect(ctx.sources[0].connect).toHaveBeenCalledWith(ctx.gains[0]);
    expect(ctx.gains[0].connect).toHaveBeenCalledWith(ctx.destination);
    expect(ctx.gains[0].gain.value).toBe(1);
    expect(ctx.sources[0].start).toHaveBeenCalledWith(0);
  });

  it('no dispara nada cuando los efectos están muteados', async () => {
    const service = makeService();
    service.preload(['/a.mp3']);
    await flush();
    TestBed.inject(EffectsVolumeService).toggleEnabled(); // mute

    service.play('/a.mp3');

    expect(contexts[0].createBufferSource).not.toHaveBeenCalled();
  });

  it('play decodifica y reproduce al vuelo si la pista no estaba precargada', async () => {
    const service = makeService();

    service.play('/late.mp3');
    await flush();

    expect(globalThis.fetch).toHaveBeenCalledWith('/late.mp3');
    expect(contexts[0].sources[0].start).toHaveBeenCalledWith(0);
  });

  it('crea un buffer source nuevo por disparo (permite solapado)', async () => {
    const service = makeService();
    service.preload(['/a.mp3']);
    await flush();

    service.play('/a.mp3');
    service.play('/a.mp3');

    expect(contexts[0].createBufferSource).toHaveBeenCalledTimes(2);
  });

  it('reanuda el contexto suspendido (autoplay iOS) al reproducir', async () => {
    const service = makeService();
    service.preload(['/a.mp3']);
    await flush();
    contexts[0].state = 'suspended';

    service.play('/a.mp3');

    expect(contexts[0].resume).toHaveBeenCalled();
  });

  it('no encola sources sobre un contexto que no quedó corriendo', async () => {
    const service = makeService();
    service.preload(['/a.mp3']);
    await flush();
    // El resume resuelve pero el contexto sigue parado (iOS exigiendo gesto):
    // el SFX debe descartarse, no quedar agendado para un resume futuro.
    contexts[0].state = 'suspended';

    service.play('/a.mp3');
    await flush();

    expect(contexts[0].createBufferSource).not.toHaveBeenCalled();
  });

  it('reproduce el SFX si el resume deja el contexto corriendo enseguida', async () => {
    const service = makeService();
    service.preload(['/a.mp3']);
    await flush();
    contexts[0].state = 'suspended';
    contexts[0].resume = vi.fn(() => {
      contexts[0].state = 'running';
      return Promise.resolve(undefined);
    });

    service.play('/a.mp3');
    await flush();

    expect(contexts[0].createBufferSource).toHaveBeenCalledOnce();
    expect(contexts[0].sources[0].start).toHaveBeenCalledWith(0);
  });

  it('no propaga errores de un buffer source roto', async () => {
    const service = makeService();
    service.preload(['/a.mp3']);
    await flush();
    contexts[0].createBufferSource = vi.fn(() => {
      throw new Error('boom');
    });

    expect(() => service.play('/a.mp3')).not.toThrow();
  });

  describe('fallback sin Web Audio', () => {
    let createdAudios: Array<{
      src: string;
      currentTime: number;
      muted: boolean;
      play: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
    }>;

    beforeEach(() => {
      createdAudios = [];
      // Sin AudioContext → fallback. El gesto lo ancla el engine.
      vi.stubGlobal('window', {
        addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
        removeEventListener: (type: string) => listeners.delete(type),
      });
      vi.stubGlobal(
        'Audio',
        function AudioMock(
          this: {
            src: string;
            currentTime: number;
            muted: boolean;
            play: ReturnType<typeof vi.fn>;
            pause: ReturnType<typeof vi.fn>;
          },
          src: string,
        ) {
          this.src = src;
          this.currentTime = 7;
          this.muted = false;
          this.play = vi.fn().mockResolvedValue(undefined);
          this.pause = vi.fn();
          createdAudios.push(this as never);
        },
      );
    });

    it('play cae a HTMLAudioElement desde el inicio', () => {
      const service = makeService();

      service.play('/a.mp3');

      expect(createdAudios).toHaveLength(1);
      expect(createdAudios[0].src).toBe('/a.mp3');
      expect(createdAudios[0].currentTime).toBe(0);
      expect(createdAudios[0].play).toHaveBeenCalledOnce();
    });

    it('en el primer gesto precalienta muteadas las pistas registradas', () => {
      const engine = TestBed.inject(AudioEngineService);
      const service = makeService();
      service.preload(['/a.mp3', '/b.mp3']);
      service.start(); // registra el precalentado del fallback como hook de unlock
      engine.start(); // ancla el gesto

      listeners.get('pointerdown')?.();

      expect(createdAudios).toHaveLength(2);
      expect(createdAudios.every((a) => a.play.mock.calls.length >= 1)).toBe(true);
      expect(service.unlocked()).toBe(true);
    });
  });
});
