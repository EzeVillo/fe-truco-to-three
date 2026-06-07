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
  {
    key: 'QUIERO_Y_ME_VOY_AL_MAZO',
    fileName: 'quiero-y-me-voy-al-mazo.mp3',
    path: '/audio/calls/quiero-y-me-voy-al-mazo.mp3',
  },
  { key: 'REAL_ENVIDO', fileName: 'real-envido.mp3', path: '/audio/calls/real-envido.mp3' },
  { key: 'RETRUCO', fileName: 'retruco.mp3', path: '/audio/calls/retruco.mp3' },
  { key: 'TRUCO', fileName: 'truco.mp3', path: '/audio/calls/truco.mp3' },
  { key: 'VALE_CUATRO', fileName: 'vale-cuatro.mp3', path: '/audio/calls/vale-cuatro.mp3' },
];

/**
 * SFX genérico de "tirar carta". No es un canto (no entra en
 * resolveMatchCallAudioPath, que mapea sólo voces): se dispara aparte vía
 * playCardThrow() cuando se aplica un CARD_PLAYED, ya sincronizado con el
 * delay por rol que resuelve MatchEventQueueService.
 */
export const MATCH_CARD_THROW_AUDIO_PATH = '/audio/freesound_community-card-sounds-35956.mp3';

/** Niveles de resolución con jingle de victoria/derrota, en intensidad creciente. */
export type MatchOutcomeLevel = 'ENVIDO' | 'GAME' | 'MATCH';

/**
 * Jingles de resultado por nivel (envido < game < match), graduados en
 * contundencia. Se disparan al abrir el modal de resultado correspondiente,
 * eligiendo win/lose según si el viewer ganó. Ver memoria audio-architecture.
 */
export const MATCH_OUTCOME_AUDIO_PATHS: Record<MatchOutcomeLevel, { win: string; lose: string }> = {
  ENVIDO: {
    win: '/audio/mixkit-winning-notification-2018.wav',
    lose: '/audio/mixkit-losing-piano-2024.wav',
  },
  GAME: {
    win: '/audio/mixkit-winning-chimes-2015.wav',
    lose: '/audio/mixkit-losing-drums-2023.wav',
  },
  MATCH: {
    win: '/audio/mixkit-video-game-win-2016.wav',
    lose: '/audio/mixkit-player-losing-or-failing-2042.wav',
  },
};

const audioPathByKey = new Map(MATCH_CALL_AUDIO_ASSETS.map((asset) => [asset.key, asset.path]));

/**
 * Todas las pistas que el servicio puede llegar a reproducir: cantos, SFX de
 * carta y jingles de resultado. Se usan para precargarlas/desbloquearlas en el
 * primer gesto del usuario (ver `MatchCallAudioService`).
 */
const ALL_MATCH_AUDIO_PATHS: readonly string[] = [
  ...MATCH_CALL_AUDIO_ASSETS.map((asset) => asset.path),
  MATCH_CARD_THROW_AUDIO_PATH,
  ...Object.values(MATCH_OUTCOME_AUDIO_PATHS).flatMap((outcome) => [outcome.win, outcome.lose]),
];

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
  private unlocked = false;
  private unlockHandler: (() => void) | null = null;

  constructor() {
    this.attachUnlock();
  }

  playForEvent(event: MatchWsEvent): void {
    const path = resolveMatchCallAudioPath(event);
    if (!path) {
      return;
    }
    this.playPath(path);
  }

  /** Sonido de carta arrojada. Se invoca al aplicar CARD_PLAYED (post-delay). */
  playCardThrow(): void {
    this.playPath(MATCH_CARD_THROW_AUDIO_PATH);
  }

  /** Jingle de victoria/derrota al resolverse un envido, game o match. */
  playOutcome(level: MatchOutcomeLevel, won: boolean): void {
    const paths = MATCH_OUTCOME_AUDIO_PATHS[level];
    this.playPath(won ? paths.win : paths.lose);
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

  /**
   * Registra un listener de un solo uso para desbloquear el audio en iOS/WebKit:
   * un `play()` disparado fuera de un gesto del usuario (p. ej. el jingle de
   * resultado del envido, que sale de un `setTimeout`) es rechazado salvo que el
   * elemento ya haya sido reproducido al menos una vez dentro de un gesto. En el
   * primer toque/tecla precalentamos todas las pistas para dejarlas habilitadas.
   */
  private attachUnlock(): void {
    if (typeof document === 'undefined' || this.unlockHandler) {
      return;
    }
    const handler = () => {
      this.unlockAll();
    };
    this.unlockHandler = handler;
    document.addEventListener('pointerdown', handler, { once: true });
    document.addEventListener('touchend', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
  }

  private detachUnlock(): void {
    if (!this.unlockHandler || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', this.unlockHandler);
    document.removeEventListener('touchend', this.unlockHandler);
    document.removeEventListener('keydown', this.unlockHandler);
    this.unlockHandler = null;
  }

  /** Reproduce y pausa en silencio cada pista para desbloquearla en iOS. */
  private unlockAll(): void {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    this.detachUnlock();

    for (const path of ALL_MATCH_AUDIO_PATHS) {
      const audio = this.getAudio(path);
      if (!audio) {
        continue;
      }
      try {
        audio.muted = true;
        const result = audio.play();
        const reset = () => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {
            // El reset es best-effort: el elemento ya quedó desbloqueado.
          }
          audio.muted = false;
        };
        if (result) {
          result.then(reset).catch(() => {
            audio.muted = false;
          });
        } else {
          reset();
        }
      } catch {
        audio.muted = false;
      }
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
