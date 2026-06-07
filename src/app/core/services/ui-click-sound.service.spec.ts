import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UI_CLICK_AUDIO_PATH, UiClickSoundService } from './ui-click-sound.service';

interface AudioMock {
  src: string;
  currentTime: number;
  play: ReturnType<typeof vi.fn>;
}

describe('UiClickSoundService', () => {
  let createdAudios: AudioMock[];
  let listeners: Map<string, (event: Event) => void>;

  function clickOn(target: { closest: (selector: string) => unknown }): void {
    listeners.get('click')?.({ target } as unknown as Event);
  }

  /** Element-like stub: `closest` matches cuando hay un botón ancestro. */
  function elementClosest(matches: boolean) {
    return { closest: vi.fn().mockReturnValue(matches ? {} : null) };
  }

  beforeEach(() => {
    createdAudios = [];
    listeners = new Map();

    vi.stubGlobal(
      'Audio',
      function AudioMockCtor(this: AudioMock, src: string) {
        this.src = src;
        this.currentTime = 9;
        this.play = vi.fn().mockResolvedValue(undefined);
        createdAudios.push(this);
      },
    );

    vi.stubGlobal('document', {
      addEventListener: (type: string, handler: (event: Event) => void) =>
        listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reproduce el SFX al hacer click en un botón', () => {
    const service = new UiClickSoundService();
    service.start();

    clickOn(elementClosest(true));

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].src).toBe(UI_CLICK_AUDIO_PATH);
    expect(createdAudios[0].currentTime).toBe(0);
    expect(createdAudios[0].play).toHaveBeenCalledOnce();
  });

  it('no reproduce nada al hacer click fuera de un botón', () => {
    const service = new UiClickSoundService();
    service.start();

    clickOn(elementClosest(false));

    expect(createdAudios).toHaveLength(0);
  });

  it('reutiliza el mismo audio reiniciándolo en cada click', () => {
    const service = new UiClickSoundService();
    service.start();

    clickOn(elementClosest(true));
    createdAudios[0].currentTime = 3;
    clickOn(elementClosest(true));

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].currentTime).toBe(0);
    expect(createdAudios[0].play).toHaveBeenCalledTimes(2);
  });

  it('start es idempotente: no registra el listener dos veces', () => {
    const addSpy = vi.spyOn(
      globalThis.document as unknown as { addEventListener: () => void },
      'addEventListener',
    );
    const service = new UiClickSoundService();

    service.start();
    service.start();

    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('stop desengancha el listener', () => {
    const service = new UiClickSoundService();
    service.start();
    service.stop();

    clickOn(elementClosest(true));

    expect(createdAudios).toHaveLength(0);
  });

  it('no propaga rechazos de play()', async () => {
    vi.stubGlobal(
      'Audio',
      function AudioMockCtor(this: AudioMock, src: string) {
        this.src = src;
        this.currentTime = 0;
        this.play = vi.fn().mockRejectedValue(new Error('blocked'));
        createdAudios.push(this);
      },
    );

    const service = new UiClickSoundService();
    service.start();

    expect(() => clickOn(elementClosest(true))).not.toThrow();
    await Promise.resolve();

    expect(createdAudios[0].play).toHaveBeenCalledOnce();
  });
});
