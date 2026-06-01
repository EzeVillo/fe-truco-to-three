import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MATCH_CALL_AUDIO_ASSETS,
  MatchCallAudioService,
  resolveMatchCallAudioPath,
} from './match-call-audio.service';
import type { MatchWsEvent } from '../models/match-ws-events';

function makeEvent(eventType: MatchWsEvent['eventType'], payload: unknown): MatchWsEvent {
  return {
    matchId: 'test-match',
    eventType,
    timestamp: Date.now(),
    payload,
    stateVersion: 1,
  };
}

describe('resolveMatchCallAudioPath', () => {
  it.each([
    ['TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'TRUCO' }, '/audio/calls/truco.mp3'],
    ['TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'RETRUCO' }, '/audio/calls/retruco.mp3'],
    ['TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'VALE_CUATRO' }, '/audio/calls/vale-cuatro.mp3'],
    ['ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' }, '/audio/calls/envido.mp3'],
    ['ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'REAL_ENVIDO' }, '/audio/calls/real-envido.mp3'],
    ['ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'FALTA_ENVIDO' }, '/audio/calls/falta-envido.mp3'],
    ['TRUCO_RESPONDED', { responderSeat: 'PLAYER_TWO', response: 'QUIERO', call: 'TRUCO' }, '/audio/calls/quiero.mp3'],
    ['TRUCO_RESPONDED', { responderSeat: 'PLAYER_TWO', response: 'NO_QUIERO', call: 'TRUCO' }, '/audio/calls/no-quiero.mp3'],
    [
      'TRUCO_RESPONDED',
      { responderSeat: 'PLAYER_TWO', response: 'QUIERO_Y_ME_VOY_AL_MAZO', call: 'TRUCO' },
      '/audio/calls/quiero-y-me-voy-al-mazo.mp3',
    ],
    ['ENVIDO_RESOLVED', { response: 'QUIERO', winnerSeat: 'PLAYER_ONE' }, '/audio/calls/quiero.mp3'],
    ['ENVIDO_RESOLVED', { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' }, '/audio/calls/no-quiero.mp3'],
    ['FOLDED', { seat: 'PLAYER_ONE' }, '/audio/calls/me-voy-al-mazo.mp3'],
  ] as const)('mapea %s a %s', (eventType, payload, expectedPath) => {
    expect(resolveMatchCallAudioPath(makeEvent(eventType, payload))).toBe(expectedPath);
  });

  it('devuelve null para valores desconocidos', () => {
    expect(resolveMatchCallAudioPath(makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'UNKNOWN' }))).toBeNull();
    expect(resolveMatchCallAudioPath(makeEvent('ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'UNKNOWN' }))).toBeNull();
    expect(resolveMatchCallAudioPath(makeEvent('TRUCO_RESPONDED', { responderSeat: 'PLAYER_ONE', response: 'UNKNOWN' }))).toBeNull();
    expect(resolveMatchCallAudioPath(makeEvent('ENVIDO_RESOLVED', { response: 'UNKNOWN', winnerSeat: 'PLAYER_ONE' }))).toBeNull();
  });

  it('devuelve null para eventos no audibles', () => {
    expect(resolveMatchCallAudioPath(makeEvent('CARD_PLAYED', { seat: 'PLAYER_ONE' }))).toBeNull();
  });
});

describe('MatchCallAudioService', () => {
  let createdAudios: Array<{ src: string; currentTime: number; play: ReturnType<typeof vi.fn> }>;

  beforeEach(() => {
    createdAudios = [];

    vi.stubGlobal('Audio', function AudioMock(this: { src: string; currentTime: number; play: ReturnType<typeof vi.fn> }, src: string) {
      this.src = src;
      this.currentTime = 12;
      this.play = vi.fn().mockResolvedValue(undefined);
      createdAudios.push(this);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expone la lista canonica de los 10 audios soportados', () => {
    expect(MATCH_CALL_AUDIO_ASSETS.map((asset) => asset.fileName).sort()).toEqual([
      'envido.mp3',
      'falta-envido.mp3',
      'me-voy-al-mazo.mp3',
      'no-quiero.mp3',
      'quiero-y-me-voy-al-mazo.mp3',
      'quiero.mp3',
      'real-envido.mp3',
      'retruco.mp3',
      'truco.mp3',
      'vale-cuatro.mp3',
    ].sort());
  });

  it('reproduce el audio desde el inicio', () => {
    const service = new MatchCallAudioService();

    service.playForEvent(makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'TRUCO' }));

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].src).toBe('/audio/calls/truco.mp3');
    expect(createdAudios[0].currentTime).toBe(0);
    expect(createdAudios[0].play).toHaveBeenCalledOnce();
  });

  it('reinicia el mismo audio si el canto se repite', () => {
    const service = new MatchCallAudioService();
    const event = makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'TRUCO' });

    service.playForEvent(event);
    createdAudios[0].currentTime = 4;
    service.playForEvent(event);

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].currentTime).toBe(0);
    expect(createdAudios[0].play).toHaveBeenCalledTimes(2);
  });

  it('ignora eventos desconocidos sin crear audio', () => {
    const service = new MatchCallAudioService();

    expect(() => service.playForEvent(makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'UNKNOWN' }))).not.toThrow();

    expect(createdAudios).toHaveLength(0);
  });

  it('no propaga rechazos de play()', async () => {
    vi.stubGlobal('Audio', function AudioMock(this: { src: string; currentTime: number; play: ReturnType<typeof vi.fn> }, src: string) {
      this.src = src;
      this.currentTime = 0;
      this.play = vi.fn().mockRejectedValue(new Error('blocked'));
      createdAudios.push(this);
    });

    const service = new MatchCallAudioService();

    expect(() => service.playForEvent(makeEvent('ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' }))).not.toThrow();
    await Promise.resolve();

    expect(createdAudios[0].play).toHaveBeenCalledOnce();
  });
});
