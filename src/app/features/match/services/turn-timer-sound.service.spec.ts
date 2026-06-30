import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectsVolumeService } from '../../../core/services/effects-volume.service';
import { TURN_TIMER_SOUND_PATH, TurnTimerSoundService } from './turn-timer-sound.service';

interface AudioMock {
  src: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

function makeService(): TurnTimerSoundService {
  return TestBed.inject(TurnTimerSoundService);
}

describe('TurnTimerSoundService', () => {
  let createdAudios: AudioMock[];

  beforeEach(() => {
    createdAudios = [];
    localStorage.clear();
    TestBed.configureTestingModule({});

    vi.stubGlobal('Audio', function AudioMock(this: AudioMock, src: string) {
      this.src = src;
      this.loop = false;
      this.volume = 0;
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

  it('start() reproduce el tic-tac en loop al volumen del bus de efectos', () => {
    const service = makeService();

    service.start();

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].src).toBe(TURN_TIMER_SOUND_PATH);
    expect(createdAudios[0].loop).toBe(true);
    // Efectos arrancan a nivel pleno por defecto.
    expect(createdAudios[0].volume).toBeCloseTo(1);
    expect(createdAudios[0].play).toHaveBeenCalledOnce();
  });

  it('start() arranca siempre desde el inicio del tic-tac', () => {
    const service = makeService();
    service.start();
    createdAudios[0].currentTime = 0.42;
    service.stop();

    service.start();

    // Reutiliza el mismo elemento (singleton) pero el golpe suena entero.
    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].currentTime).toBe(0);
  });

  it('start() repetido mientras suena es idempotente (no reproduce de nuevo)', () => {
    const service = makeService();
    service.start();

    // El componente re-dispara start() en cada tick (200 ms) del temporizador.
    service.start();

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].play).toHaveBeenCalledOnce();
  });

  it('stop() pausa el tic-tac', () => {
    const service = makeService();
    service.start();

    service.stop();

    expect(createdAudios[0].pause).toHaveBeenCalledOnce();
  });

  it('stop() sin haber arrancado no falla ni pausa nada', () => {
    const service = makeService();

    service.stop();

    expect(createdAudios).toHaveLength(0);
  });

  it('no reproduce con la app en background (visibilityState hidden)', () => {
    const service = makeService();
    vi.stubGlobal('document', { visibilityState: 'hidden' });

    service.start();

    expect(createdAudios[0]?.play).not.toHaveBeenCalled();
  });

  it('refleja en vivo el volumen del bus de efectos en el elemento (sin Web Audio)', () => {
    const effectsVolume = TestBed.inject(EffectsVolumeService);
    const service = makeService();
    service.start();

    effectsVolume.setVolume(0.4);
    TestBed.flushEffects(); // corre el effect que aplica el gain

    expect(createdAudios[0].volume).toBeCloseTo(0.4);
  });

  it('con efectos muteados el tic-tac queda a volumen 0', () => {
    const effectsVolume = TestBed.inject(EffectsVolumeService);
    const service = makeService();
    service.start();

    effectsVolume.toggleEnabled(); // mute
    TestBed.flushEffects();

    expect(createdAudios[0].volume).toBe(0);
  });

  describe('con Web Audio (iOS: volume del elemento es read-only)', () => {
    let gain: { gain: { value: number; setValueAtTime?: ReturnType<typeof vi.fn> } };
    let mediaElementVolume: HTMLAudioElement | null;

    beforeEach(() => {
      gain = { gain: { value: 0 } };
      mediaElementVolume = null;

      interface AudioContextMockShape {
        currentTime: number;
        destination: object;
        state: string;
        resume: ReturnType<typeof vi.fn>;
        createMediaElementSource: (el: HTMLAudioElement) => { connect: ReturnType<typeof vi.fn> };
        createGain: () => { gain: { value: number }; connect: ReturnType<typeof vi.fn> };
      }

      vi.stubGlobal('AudioContext', function AudioContextMock(this: AudioContextMockShape) {
        this.currentTime = 0;
        this.destination = {};
        this.state = 'running';
        this.resume = vi.fn().mockResolvedValue(undefined);
        this.createMediaElementSource = (el: HTMLAudioElement) => {
          mediaElementVolume = el;
          return { connect: vi.fn() };
        };
        this.createGain = () => ({ ...gain, connect: vi.fn() });
      });
      vi.stubGlobal('window', { AudioContext: globalThis.AudioContext });
    });

    it('el volumen se gobierna por el GainNode, no por audio.volume', () => {
      const effectsVolume = TestBed.inject(EffectsVolumeService);
      const service = makeService();
      service.start();

      effectsVolume.setVolume(0.7);
      TestBed.flushEffects();

      // El elemento queda a nivel pleno (su .volume no controla nada en iOS)…
      expect(mediaElementVolume?.volume).toBe(1);
      // …y el nivel real lo lleva el gain.
      expect(gain.gain.value).toBeCloseTo(0.7);
    });
  });
});
