import { Injectable, Injector, effect, inject, signal } from '@angular/core';
import { Subject, of, race, timer } from 'rxjs';
import type { Observable, Subscription } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { AuthStore } from '../../../core/auth/auth.store';
import type {
  CampaignBotUnlockedPayload,
  CampaignMatchPointsPayload,
  CampaignWsEvent,
} from '../../../core/models/ws.models';
import { AudioPlaybackService } from '../../../core/services/audio-playback.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ACHIEVEMENT_UNLOCK_AUDIO_PATH } from '../../profile/services/profile-notification.service';

/**
 * Escucha el canal `/user/queue/campaign` y entrega los puntos conseguidos al
 * terminar un match de campaña (`CAMPAIGN_MATCH_POINTS`, §9.6).
 *
 * El push se emite post-commit junto con el fin del match, así que para cuando el
 * jugador cierra el modal de "ganaste/perdiste" ya suele estar en el buffer. Aun
 * así, `awaitForMatch` cubre la carrera esperando el evento hasta un timeout.
 *
 * El modo campaña es solo para usuarios registrados, por eso la suscripción se
 * gatea igual que las demás colas `/user/queue/*` (autenticado y no invitado).
 *
 * El mismo canal entrega `CAMPAIGN_BOT_UNLOCKED` cuando el jugador desbloquea un
 * bot de campaña para el modo casual (§9.6). Lo exponemos como toast estilo logro.
 */
@Injectable({ providedIn: 'root' })
export class CampaignPointsService {
  private readonly authStore = inject(AuthStore);
  private readonly wsService = inject(WebSocketService);
  private readonly injector = inject(Injector);
  private readonly playback = inject(AudioPlaybackService);

  /** Espera por defecto del push tras cerrar el modal de fin de match. */
  private static readonly DEFAULT_AWAIT_MS = 4000;

  private readonly events$ = new Subject<CampaignMatchPointsPayload>();
  private readonly buffer = new Map<string, CampaignMatchPointsPayload>();
  private subscription: Subscription | null = null;
  private started = false;

  /** Último bot de campaña desbloqueado, para el toast. `null` cuando no hay aviso. */
  readonly botUnlocked = signal<CampaignBotUnlockedPayload | null>(null);

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.playback.preload([ACHIEVEMENT_UNLOCK_AUDIO_PATH]);
    this.syncSubscription();

    effect(
      () => {
        this.authStore.isAuthenticated();
        this.authStore.isGuest();
        this.syncSubscription();
      },
      { injector: this.injector },
    );
  }

  /**
   * Resuelve los puntos del match indicado: si el push ya llegó, emite de
   * inmediato; si no, espera hasta `timeoutMs` y emite `null` si no llega.
   */
  awaitForMatch(
    matchId: string,
    timeoutMs: number = CampaignPointsService.DEFAULT_AWAIT_MS,
  ): Observable<CampaignMatchPointsPayload | null> {
    const buffered = this.buffer.get(matchId);
    if (buffered) {
      return of(buffered);
    }

    return race(
      this.events$.pipe(
        filter((payload) => payload.matchId === matchId),
        take(1),
      ),
      timer(timeoutMs).pipe(map(() => null)),
    );
  }

  private syncSubscription(): void {
    const shouldSubscribe = this.authStore.isAuthenticated() && !this.authStore.isGuest();
    if (shouldSubscribe) {
      this.subscribe();
    } else {
      this.unsubscribe();
    }
  }

  private subscribe(): void {
    if (this.subscription) {
      return;
    }

    this.wsService.connect();
    this.subscription = this.wsService
      .subscribe<CampaignWsEvent>('/user/queue/campaign')
      .subscribe((event) => {
        if (event.eventType === 'CAMPAIGN_MATCH_POINTS') {
          this.buffer.set(event.payload.matchId, event.payload);
          this.events$.next(event.payload);
        } else if (event.eventType === 'CAMPAIGN_BOT_UNLOCKED') {
          this.botUnlocked.set(event.payload);
          // El push llega fuera de un gesto, pero el canal de audio ya quedó
          // desbloqueado desde el primer toque de la sesión (igual que los logros).
          this.playback.play(ACHIEVEMENT_UNLOCK_AUDIO_PATH);
        }
      });
  }

  /** Cierra el toast de bot desbloqueado. */
  dismissBotUnlock(): void {
    this.botUnlocked.set(null);
  }

  private unsubscribe(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.buffer.clear();
    this.botUnlocked.set(null);
  }
}
