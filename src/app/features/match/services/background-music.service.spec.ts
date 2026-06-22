import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKGROUND_MUSIC_PATH, BackgroundMusicService } from './background-music.service';

interface AudioMock {
  src: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

/** El servicio ahora inyecta `AudioEngineService`, así que se resuelve vía TestBed. */
function makeService(): BackgroundMusicService {
  return TestBed.inject(BackgroundMusicService);
}

describe('BackgroundMusicService', () => {
  let createdAudios: AudioMock[];

  beforeEach(() => {
    createdAudios = [];
    localStorage.clear();
    TestBed.configureTestingModule({});

    vi.stubGlobal('Audio', function AudioMock(this: AudioMock, src: string) {
      this.src = src;
      this.loop = false;
      this.volume = 1;
      this.currentTime = 0;
      this.play = vi.fn().mockResolvedValue(undefined);
      this.pause = vi.fn();
      createdAudios.push(this);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('arranca encendida a volumen bajo por defecto', () => {
    const service = makeService();

    expect(service.enabled()).toBe(true);
    expect(service.volume()).toBeCloseTo(0.15);
  });

  it('start() reproduce la pista en loop al volumen actual', () => {
    const service = makeService();

    service.start();

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].src).toBe(BACKGROUND_MUSIC_PATH);
    expect(createdAudios[0].loop).toBe(true);
    expect(createdAudios[0].volume).toBeCloseTo(0.15);
    expect(createdAudios[0].play).toHaveBeenCalledOnce();
  });

  it('al reentrar a un match rebobina la pista al inicio', () => {
    const service = makeService();
    service.start();

    // Simula que la pista avanzó durante la primera partida.
    createdAudios[0].currentTime = 42;
    service.stop();

    service.start();

    // Reutiliza el mismo elemento (singleton) pero suena desde el principio.
    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].currentTime).toBe(0);
  });

  it('start() repetido durante la partida no rebobina (es idempotente)', () => {
    const service = makeService();
    service.start();

    // El componente re-dispara start() en cada acción mientras IN_PROGRESS.
    createdAudios[0].currentTime = 42;
    service.start();

    expect(createdAudios[0].currentTime).toBe(42);
  });

  it('stop() pausa la pista', () => {
    const service = makeService();
    service.start();

    service.stop();

    expect(createdAudios[0].pause).toHaveBeenCalledOnce();
  });

  it('toggleEnabled apaga, pausa y persiste la preferencia', () => {
    const service = makeService();
    service.start();

    service.toggleEnabled();

    expect(service.enabled()).toBe(false);
    expect(createdAudios[0].pause).toHaveBeenCalled();
    expect(localStorage.getItem('t3.bgMusic.enabled')).toBe('false');
  });

  it('start() con música apagada no crea ni reproduce audio', () => {
    localStorage.setItem('t3.bgMusic.enabled', 'false');
    const service = makeService();

    service.start();

    expect(createdAudios).toHaveLength(0);
  });

  it('setVolume clampea a [0,1], lo aplica al audio y lo persiste', () => {
    const service = makeService();
    service.start();

    service.setVolume(2);
    expect(service.volume()).toBe(1);
    expect(createdAudios[0].volume).toBe(1);

    service.setVolume(-1);
    expect(service.volume()).toBe(0);

    expect(localStorage.getItem('t3.bgMusic.volume')).toBe('0');
  });

  it('restaura preferencias persistidas de una sesión previa', () => {
    localStorage.setItem('t3.bgMusic.enabled', 'true');
    localStorage.setItem('t3.bgMusic.volume', '0.5');

    const service = makeService();

    expect(service.enabled()).toBe(true);
    expect(service.volume()).toBeCloseTo(0.5);
  });

  describe('con Web Audio (iOS: volume del elemento es read-only)', () => {
    let gain: { gain: { value: number } };
    let mediaElementVolume: HTMLAudioElement | null;

    beforeEach(() => {
      gain = { gain: { value: 1 } };
      mediaElementVolume = null;

      interface AudioContextMockShape {
        destination: object;
        resume: ReturnType<typeof vi.fn>;
        createMediaElementSource: (el: HTMLAudioElement) => { connect: ReturnType<typeof vi.fn> };
        createGain: () => { gain: { value: number }; connect: ReturnType<typeof vi.fn> };
      }

      vi.stubGlobal('AudioContext', function AudioContextMock(this: AudioContextMockShape) {
        this.destination = {};
        this.resume = vi.fn().mockResolvedValue(undefined);
        this.createMediaElementSource = (el: HTMLAudioElement) => {
          mediaElementVolume = el;
          return { connect: vi.fn() };
        };
        this.createGain = () => ({ ...gain, connect: vi.fn() });
      });
      // El engine resuelve el contexto desde `window` (como SFX y clicks).
      vi.stubGlobal('window', { AudioContext: globalThis.AudioContext });
    });

    it('el volumen se gobierna por el GainNode, no por audio.volume', () => {
      const service = makeService();
      service.start();

      service.setVolume(0.8);

      // El elemento queda a nivel pleno (su .volume no controla nada en iOS)…
      expect(mediaElementVolume?.volume).toBe(1);
      // …y el nivel real lo lleva el gain, que sí es escribible en iOS.
      expect(gain.gain.value).toBeCloseTo(0.8);
    });
  });
});
