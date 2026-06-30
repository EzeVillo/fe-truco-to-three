import { Injectable, inject } from '@angular/core';
import { AudioPlaybackService } from '../../../core/services/audio-playback.service';
import { NOTIFICATION_CUE_AUDIO_PATH } from '../../../core/services/notification-cue-audio.service';
import type { MatchWsEvent, TrucoRespondedPayload } from '../models/match-ws-events';

export interface MatchCallAudioAsset {
  key: string;
  fileName: string;
  path: string;
}

export const MATCH_CALL_AUDIO_ASSETS: readonly MatchCallAudioAsset[] = [
  { key: 'ENVIDO', fileName: 'envido.mp3', path: 'audio/calls/envido.mp3' },
  { key: 'FALTA_ENVIDO', fileName: 'falta-envido.mp3', path: 'audio/calls/falta-envido.mp3' },
  { key: 'FOLD', fileName: 'me-voy-al-mazo.mp3', path: 'audio/calls/me-voy-al-mazo.mp3' },
  { key: 'NO_QUIERO', fileName: 'no-quiero.mp3', path: 'audio/calls/no-quiero.mp3' },
  { key: 'QUIERO', fileName: 'quiero.mp3', path: 'audio/calls/quiero.mp3' },
  {
    key: 'QUIERO_Y_ME_VOY_AL_MAZO',
    fileName: 'quiero-y-me-voy-al-mazo.mp3',
    path: 'audio/calls/quiero-y-me-voy-al-mazo.mp3',
  },
  { key: 'REAL_ENVIDO', fileName: 'real-envido.mp3', path: 'audio/calls/real-envido.mp3' },
  { key: 'RETRUCO', fileName: 'retruco.mp3', path: 'audio/calls/retruco.mp3' },
  { key: 'TRUCO', fileName: 'truco.mp3', path: 'audio/calls/truco.mp3' },
  { key: 'VALE_CUATRO', fileName: 'vale-cuatro.mp3', path: 'audio/calls/vale-cuatro.mp3' },
];

/**
 * SFX genérico de "tirar carta". No es un canto (no entra en
 * resolveMatchCallAudioPath, que mapea sólo voces): se dispara aparte vía
 * playCardThrow() cuando se aplica un CARD_PLAYED, ya sincronizado con el
 * delay por rol que resuelve MatchEventQueueService.
 */
export const MATCH_CARD_THROW_AUDIO_PATH = 'audio/freesound_community-card-sounds-35956.mp3';

/**
 * Cue neutro para el espectador al abrir un modal de resultado (envido/game/match).
 * El espectador no tiene bando, así que no le corresponde un jingle de win/lose:
 * suena este "tick" como aviso de "apareció un resultado, mirá". Sólo en spectate.
 */
export const SPECTATOR_OUTCOME_CUE_AUDIO_PATH = NOTIFICATION_CUE_AUDIO_PATH;

/** Niveles de resolución con jingle de victoria/derrota, en intensidad creciente. */
export type MatchOutcomeLevel = 'ENVIDO' | 'GAME' | 'MATCH';

/**
 * Jingles de resultado por nivel (envido < game < match), graduados en
 * contundencia. Se disparan al abrir el modal de resultado correspondiente,
 * eligiendo win/lose según si el viewer ganó. Ver memoria audio-architecture.
 */
export const MATCH_OUTCOME_AUDIO_PATHS: Record<MatchOutcomeLevel, { win: string; lose: string }> = {
  ENVIDO: {
    win: 'audio/mixkit-winning-notification-2018.mp3',
    lose: 'audio/mixkit-losing-piano-2024.mp3',
  },
  GAME: {
    win: 'audio/mixkit-winning-chimes-2015.mp3',
    lose: 'audio/mixkit-losing-drums-2023.mp3',
  },
  MATCH: {
    win: 'audio/mixkit-video-game-win-2016.mp3',
    lose: 'audio/mixkit-player-losing-or-failing-2042.mp3',
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
  SPECTATOR_OUTCOME_CUE_AUDIO_PATH,
  ...Object.values(MATCH_OUTCOME_AUDIO_PATHS).flatMap((outcome) => [outcome.win, outcome.lose]),
];

/**
 * Indica si el canto del evento debe frenar la cola hasta terminar de sonar
 * (gate por audio). Sólo los cierres de mano por decisión del jugador: el canto
 * marca el fin de la jugada y no queremos que el siguiente evento lo pise.
 * TRUCO_RESPONDED gatea únicamente cuando la respuesta es el combo
 * QUIERO_Y_ME_VOY_AL_MAZO; QUIERO/NO_QUIERO simples no frenan la cola.
 */
export function eventGatesOnAudio(event: MatchWsEvent): boolean {
  switch (event.eventType) {
    case 'ENVIDO_RESOLVED':
    case 'FOLDED':
      return true;
    case 'TRUCO_RESPONDED':
      return (event.payload as TrucoRespondedPayload).response === 'QUIERO_Y_ME_VOY_AL_MAZO';
    default:
      return false;
  }
}

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

/**
 * SFX de partida (cantos, carta tirada, jingles de resultado). Es un wrapper
 * delgado sobre {@link AudioPlaybackService}: resuelve qué pista corresponde a
 * cada evento y delega la reproducción y el desbloqueo de iOS al canal central.
 * Precarga (decodifica) las pistas conocidas al construirse para que el primer
 * SFX suene sin latencia; el unlock ya está anclado globalmente desde `App`.
 */
@Injectable({ providedIn: 'root' })
export class MatchCallAudioService {
  private readonly playback = inject(AudioPlaybackService);

  constructor() {
    this.playback.preload(ALL_MATCH_AUDIO_PATHS);
  }

  playForEvent(event: MatchWsEvent): void {
    const path = resolveMatchCallAudioPath(event);
    if (!path) {
      return;
    }
    this.playback.play(path);
  }

  /**
   * Duración (ms) que la cola debe esperar a que termine de sonar el canto del
   * evento antes de avanzar al próximo (gate por audio), o 0 si el evento no
   * gatea. Sólo gatean los cierres de mano cuyo canto no debe quedar pisado por
   * lo que sigue: ENVIDO_RESOLVED, FOLDED ("me voy al mazo") y TRUCO_RESPONDED
   * sólo cuando es QUIERO_Y_ME_VOY_AL_MAZO. El resto de los cantos (TRUCO/ENVIDO
   * cantado, QUIERO/NO_QUIERO al truco) suenan pero no frenan la cola.
   */
  getCallDurationMs(event: MatchWsEvent): number {
    if (!eventGatesOnAudio(event)) {
      return 0;
    }
    const path = resolveMatchCallAudioPath(event);
    if (!path) {
      return 0;
    }
    return this.playback.getDurationMs(path);
  }

  /** Sonido de carta arrojada. Se invoca al aplicar CARD_PLAYED (post-delay). */
  playCardThrow(): void {
    this.playback.play(MATCH_CARD_THROW_AUDIO_PATH);
  }

  /** Jingle de victoria/derrota al resolverse un envido, game o match. */
  playOutcome(level: MatchOutcomeLevel, won: boolean): void {
    const paths = MATCH_OUTCOME_AUDIO_PATHS[level];
    this.playback.play(won ? paths.win : paths.lose);
  }

  /**
   * Cue neutro de resultado para el espectador (sin bando, sin win/lose). Se
   * dispara al abrir cualquier modal de resultado en modo espectador.
   */
  playSpectatorOutcomeCue(): void {
    this.playback.play(SPECTATOR_OUTCOME_CUE_AUDIO_PATH);
  }
}
