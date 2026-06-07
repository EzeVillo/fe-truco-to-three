import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  MATCH_CALL_AUDIO_ASSETS,
  MATCH_CARD_THROW_AUDIO_PATH,
  MatchCallAudioService,
  resolveMatchCallAudioPath,
  SPECTATOR_OUTCOME_CUE_AUDIO_PATH,
} from './match-call-audio.service';
import { AudioPlaybackService } from '../../../core/services/audio-playback.service';
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
    [
      'TRUCO_CALLED',
      { callerSeat: 'PLAYER_ONE', call: 'VALE_CUATRO' },
      '/audio/calls/vale-cuatro.mp3',
    ],
    ['ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'ENVIDO' }, '/audio/calls/envido.mp3'],
    [
      'ENVIDO_CALLED',
      { callerSeat: 'PLAYER_ONE', call: 'REAL_ENVIDO' },
      '/audio/calls/real-envido.mp3',
    ],
    [
      'ENVIDO_CALLED',
      { callerSeat: 'PLAYER_ONE', call: 'FALTA_ENVIDO' },
      '/audio/calls/falta-envido.mp3',
    ],
    [
      'TRUCO_RESPONDED',
      { responderSeat: 'PLAYER_TWO', response: 'QUIERO', call: 'TRUCO' },
      '/audio/calls/quiero.mp3',
    ],
    [
      'TRUCO_RESPONDED',
      { responderSeat: 'PLAYER_TWO', response: 'NO_QUIERO', call: 'TRUCO' },
      '/audio/calls/no-quiero.mp3',
    ],
    [
      'TRUCO_RESPONDED',
      { responderSeat: 'PLAYER_TWO', response: 'QUIERO_Y_ME_VOY_AL_MAZO', call: 'TRUCO' },
      '/audio/calls/quiero-y-me-voy-al-mazo.mp3',
    ],
    [
      'ENVIDO_RESOLVED',
      { response: 'QUIERO', winnerSeat: 'PLAYER_ONE' },
      '/audio/calls/quiero.mp3',
    ],
    [
      'ENVIDO_RESOLVED',
      { response: 'NO_QUIERO', winnerSeat: 'PLAYER_ONE' },
      '/audio/calls/no-quiero.mp3',
    ],
    ['FOLDED', { seat: 'PLAYER_ONE' }, '/audio/calls/me-voy-al-mazo.mp3'],
  ] as const)('mapea %s a %s', (eventType, payload, expectedPath) => {
    expect(resolveMatchCallAudioPath(makeEvent(eventType, payload))).toBe(expectedPath);
  });

  it('devuelve null para valores desconocidos', () => {
    expect(
      resolveMatchCallAudioPath(
        makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'UNKNOWN' }),
      ),
    ).toBeNull();
    expect(
      resolveMatchCallAudioPath(
        makeEvent('ENVIDO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'UNKNOWN' }),
      ),
    ).toBeNull();
    expect(
      resolveMatchCallAudioPath(
        makeEvent('TRUCO_RESPONDED', { responderSeat: 'PLAYER_ONE', response: 'UNKNOWN' }),
      ),
    ).toBeNull();
    expect(
      resolveMatchCallAudioPath(
        makeEvent('ENVIDO_RESOLVED', { response: 'UNKNOWN', winnerSeat: 'PLAYER_ONE' }),
      ),
    ).toBeNull();
  });

  it('devuelve null para eventos no audibles', () => {
    expect(resolveMatchCallAudioPath(makeEvent('CARD_PLAYED', { seat: 'PLAYER_ONE' }))).toBeNull();
  });
});

describe('MatchCallAudioService', () => {
  let playback: { preload: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> };

  function createService(): MatchCallAudioService {
    playback = { preload: vi.fn(), play: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        MatchCallAudioService,
        { provide: AudioPlaybackService, useValue: playback },
      ],
    });
    return TestBed.inject(MatchCallAudioService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('expone la lista canonica de los 10 audios soportados', () => {
    expect(MATCH_CALL_AUDIO_ASSETS.map((asset) => asset.fileName).sort()).toEqual(
      [
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
      ].sort(),
    );
  });

  it('precarga las 18 pistas conocidas al construirse', () => {
    createService();

    expect(playback.preload).toHaveBeenCalledOnce();
    // 10 cantos + SFX de carta + cue de espectador + 3 jingles win/lose = 18 pistas.
    expect(playback.preload.mock.calls[0][0]).toHaveLength(18);
  });

  it('reproduce la pista del canto vía el canal central', () => {
    const service = createService();

    service.playForEvent(makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'TRUCO' }));

    expect(playback.play).toHaveBeenCalledWith('/audio/calls/truco.mp3');
  });

  it('playCardThrow reproduce el SFX de carta vía el canal central', () => {
    const service = createService();

    service.playCardThrow();

    expect(playback.play).toHaveBeenCalledWith(MATCH_CARD_THROW_AUDIO_PATH);
  });

  it('playOutcome elige la pista de victoria/derrota según el resultado', () => {
    const service = createService();

    service.playOutcome('MATCH', true);
    expect(playback.play).toHaveBeenLastCalledWith('/audio/mixkit-video-game-win-2016.wav');

    service.playOutcome('ENVIDO', false);
    expect(playback.play).toHaveBeenLastCalledWith('/audio/mixkit-losing-piano-2024.wav');
  });

  it('playSpectatorOutcomeCue reproduce el cue neutro de espectador', () => {
    const service = createService();

    service.playSpectatorOutcomeCue();

    expect(playback.play).toHaveBeenCalledWith(SPECTATOR_OUTCOME_CUE_AUDIO_PATH);
  });

  it('ignora eventos desconocidos sin reproducir nada', () => {
    const service = createService();

    expect(() =>
      service.playForEvent(
        makeEvent('TRUCO_CALLED', { callerSeat: 'PLAYER_ONE', call: 'UNKNOWN' }),
      ),
    ).not.toThrow();

    expect(playback.play).not.toHaveBeenCalled();
  });
});
