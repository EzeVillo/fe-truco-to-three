import { Injectable } from '@angular/core';
import type { MatchWsEvent } from '../models/match-ws-events';

export interface MatchCallAudioAsset {
  key: string;
  fileName: string;
  path: string;
}

export const MATCH_CALL_AUDIO_ASSETS: readonly MatchCallAudioAsset[] = [
  { key: 'ENVIDO', fileName: 'envido.mp3', path: '/audio/calls/envido.mp3' },
  { key: 'FALTA_ENVIDO', fileName: 'falta-envido.mp3', path: '/audio/calls/falta-envido.mp3' },
  { key: 'FOLD', fileName: 'me-voy-al-mazo.mp3', path: '/audio/calls/me-voy-al-mazo.mp3' },
  { key: 'NO_QUIERO', fileName: 'no-quiero.mp3', path: '/audio/calls/no-quiero.mp3' },
  { key: 'QUIERO', fileName: 'quiero.mp3', path: '/audio/calls/quiero.mp3' },
  { key: 'QUIERO_Y_ME_VOY_AL_MAZO', fileName: 'quiero-y-me-voy-al-mazo.mp3', path: '/audio/calls/quiero-y-me-voy-al-mazo.mp3' },
  { key: 'REAL_ENVIDO', fileName: 'real-envido.mp3', path: '/audio/calls/real-envido.mp3' },
  { key: 'RETRUCO', fileName: 'retruco.mp3', path: '/audio/calls/retruco.mp3' },
  { key: 'TRUCO', fileName: 'truco.mp3', path: '/audio/calls/truco.mp3' },
  { key: 'VALE_CUATRO', fileName: 'vale-cuatro.mp3', path: '/audio/calls/vale-cuatro.mp3' },
];

const audioPathByKey = new Map(MATCH_CALL_AUDIO_ASSETS.map((asset) => [asset.key, asset.path]));

export function resolveMatchCallAudioPath(event: MatchWsEvent): string | null {
  switch (event.eventType) {
    case 'TRUCO_CALLED': {
      const payload = event.payload as { call?: string };
      return audioPathByKey.get(payload.call ?? '') ?? null;
    }

    case 'ENVIDO_CALLED': {
      const payload = event.payload as { call?: string };
      return audioPathByKey.get(payload.call ?? '') ?? null;
    }

    case 'TRUCO_RESPONDED': {
      const payload = event.payload as { response?: string };
      return audioPathByKey.get(payload.response ?? '') ?? null;
    }

    case 'ENVIDO_RESOLVED': {
      const payload = event.payload as { response?: string };
      return audioPathByKey.get(payload.response ?? '') ?? null;
    }

    case 'FOLDED':
      return audioPathByKey.get('FOLD') ?? null;

    default:
      return null;
  }
}

@Injectable({ providedIn: 'root' })
export class MatchCallAudioService {
  private readonly audioByPath = new Map<string, HTMLAudioElement>();

  playForEvent(event: MatchWsEvent): void {
    const path = resolveMatchCallAudioPath(event);
    if (!path) {
      return;
    }
    this.playPath(path);
  }

  private playPath(path: string): void {
    const audio = this.getAudio(path);
    if (!audio) {
      return;
    }

    try {
      audio.currentTime = 0;
      const result = audio.play();
      if (result) {
        result.catch(() => undefined);
      }
    } catch {
      // Audio is a non-blocking enhancement for the match experience.
    }
  }

  private getAudio(path: string): HTMLAudioElement | null {
    const cached = this.audioByPath.get(path);
    if (cached) {
      return cached;
    }

    try {
      const audio = new Audio(path);
      this.audioByPath.set(path, audio);
      return audio;
    } catch {
      return null;
    }
  }
}
