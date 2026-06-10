import { Injectable, inject } from '@angular/core';
import { AudioPlaybackService } from './audio-playback.service';

/**
 * Cue neutro para avisos puntuales que requieren atencion pero no tienen bando
 * propio de victoria/derrota.
 */
export const NOTIFICATION_CUE_AUDIO_PATH = 'audio/mixkit-select-click-1109.mp3';

@Injectable({ providedIn: 'root' })
export class NotificationCueAudioService {
  private readonly playback = inject(AudioPlaybackService);

  constructor() {
    this.playback.preload([NOTIFICATION_CUE_AUDIO_PATH]);
  }

  play(): void {
    this.playback.play(NOTIFICATION_CUE_AUDIO_PATH);
  }
}
