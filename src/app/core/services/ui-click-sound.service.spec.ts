import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EffectsVolumeService } from './effects-volume.service';
import { UI_CLICK_AUDIO_PATH, UiClickSoundService } from './ui-click-sound.service';

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

function makeService(): UiClickSoundService {
  return TestBed.inject(UiClickSoundService);
}

describe('UiClickSoundService', () => {
  let contexts: ContextMock[];
  let listeners: Map<string, (event: Event) => void>;
  const decodedBuffer = { decoded: true };

  function clickOn(target: { closest: (selector: string) => unknown }): void {
    listeners.get('click')?.({ target } as unknown as Event);
  }

  /**
   * Element-like stub: `closest` matchea un botón ancestro según `isButton`, y un
   * ancestro `[appTapAction]` según `hasTapAction` (default false).
   */
  function elementClosest(isButton: boolean, hasTapAction = false) {
    return {
      closest: vi.fn((selector: string) => {
        if (selector === '[appTapAction]') {
          return hasTapAction ? {} : null;
        }
        return isButton ? {} : null;
      }),
    };
  }

  /** Espera a que se resuelva el fetch/decode encolado por `start()`. */
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
        const source: BufferSourceMock = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
        };
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

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );

    vi.stubGlobal('window', { AudioContext: globalThis.AudioContext });

    vi.stubGlobal('document', {
      addEventListener: (type: string, handler: (event: Event) => void) =>
        listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('decodifica el WAV una sola vez al arrancar', async () => {
    const service = makeService();
    service.start();
    await flush();

    expect(globalThis.fetch).toHaveBeenCalledWith(UI_CLICK_AUDIO_PATH);
    expect(contexts).toHaveLength(1);
    expect(contexts[0].decodeAudioData).toHaveBeenCalledOnce();
  });

  it('dispara un buffer source al hacer click en un botón', async () => {
    const service = makeService();
    service.start();
    await flush();

    clickOn(elementClosest(true));

    const context = contexts[0];
    expect(context.createBufferSource).toHaveBeenCalledOnce();
    expect(context.sources[0].buffer).toBe(decodedBuffer);
    // El source pasa por el GainNode del bus de efectos, y éste a destination.
    expect(context.sources[0].connect).toHaveBeenCalledWith(context.gains[0]);
    expect(context.gains[0].connect).toHaveBeenCalledWith(context.destination);
    expect(context.gains[0].gain.value).toBe(1);
    expect(context.sources[0].start).toHaveBeenCalledWith(0);
  });

  it('no reproduce el click cuando los efectos están muteados', async () => {
    const service = makeService();
    service.start();
    await flush();
    TestBed.inject(EffectsVolumeService).toggleEnabled(); // mute

    clickOn(elementClosest(true));

    expect(contexts[0].createBufferSource).not.toHaveBeenCalled();
  });

  it('no reproduce nada al hacer click fuera de un botón', async () => {
    const service = makeService();
    service.start();
    await flush();

    clickOn(elementClosest(false));

    expect(contexts[0].createBufferSource).not.toHaveBeenCalled();
  });

  it('ignora el click nativo de botones appTapAction (los maneja la directiva)', async () => {
    const service = makeService();
    service.start();
    await flush();

    clickOn(elementClosest(true, true));

    expect(contexts[0].createBufferSource).not.toHaveBeenCalled();
  });

  it('play() reproduce el SFX directamente (lo usa appTapAction en el tap)', async () => {
    const service = makeService();
    service.start();
    await flush();

    service.play();

    expect(contexts[0].createBufferSource).toHaveBeenCalledOnce();
  });

  it('crea un buffer source nuevo por cada click (permite solapado)', async () => {
    const service = makeService();
    service.start();
    await flush();

    clickOn(elementClosest(true));
    clickOn(elementClosest(true));

    expect(contexts[0].createBufferSource).toHaveBeenCalledTimes(2);
    expect(contexts[0].sources).toHaveLength(2);
  });

  it('reanuda el contexto suspendido (autoplay de iOS) en el click', async () => {
    const service = makeService();
    service.start();
    await flush();
    contexts[0].state = 'suspended';

    clickOn(elementClosest(true));

    expect(contexts[0].resume).toHaveBeenCalledOnce();
  });

  it('start es idempotente: no registra el listener dos veces', () => {
    const addSpy = vi.spyOn(
      globalThis.document as unknown as { addEventListener: () => void },
      'addEventListener',
    );
    const service = makeService();

    service.start();
    service.start();

    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('stop desengancha el listener', async () => {
    const service = makeService();
    service.start();
    await flush();
    service.stop();

    clickOn(elementClosest(true));

    expect(contexts[0].createBufferSource).not.toHaveBeenCalled();
  });

  it('cae a HTMLAudioElement cuando Web Audio no está disponible', () => {
    const createdAudios: { src: string; currentTime: number; play: ReturnType<typeof vi.fn> }[] =
      [];
    vi.stubGlobal('window', {});
    vi.stubGlobal(
      'Audio',
      function AudioMockCtor(
        this: { src: string; currentTime: number; play: () => void },
        src: string,
      ) {
        this.src = src;
        this.currentTime = 9;
        this.play = vi.fn().mockResolvedValue(undefined);
        createdAudios.push(this as never);
      },
    );

    const service = makeService();
    service.start();

    clickOn(elementClosest(true));

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].src).toBe(UI_CLICK_AUDIO_PATH);
    expect(createdAudios[0].currentTime).toBe(0);
    expect(createdAudios[0].play).toHaveBeenCalledOnce();
  });

  it('no propaga errores de start() de un buffer source', async () => {
    const service = makeService();
    service.start();
    await flush();
    contexts[0].createBufferSource = vi.fn(() => {
      throw new Error('boom');
    });

    expect(() => clickOn(elementClosest(true))).not.toThrow();
  });
});
