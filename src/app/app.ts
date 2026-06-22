import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthService } from './core/auth/auth.service';
import { AudioEngineService } from './core/services/audio-engine.service';
import { AudioPlaybackService } from './core/services/audio-playback.service';
import { PresenceCoordinatorService } from './core/services/presence-coordinator.service';
import { ServerWakeService } from './core/services/server-wake.service';
import { SwUpdateService } from './core/services/sw-update.service';
import { UiClickSoundService } from './core/services/ui-click-sound.service';
import { ProfileNotificationService } from './features/profile/services/profile-notification.service';
import { CampaignPointsService } from './features/campaign/services/campaign-points.service';
import { SocialStore } from './features/social/services/social.store';
import { GlobalHeaderComponent } from './shared/components/global-header/global-header.component';
import { ToastCenterComponent } from './shared/components/toast-center/toast-center.component';
import type { ToastVM } from './shared/components/toast-center/toast.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GlobalHeaderComponent, ToastCenterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authService = inject(AuthService);
  readonly presenceCoordinator = inject(PresenceCoordinatorService);
  readonly profileNotifications = inject(ProfileNotificationService);
  readonly campaignPoints = inject(CampaignPointsService);
  readonly social = inject(SocialStore);
  private readonly router = inject(Router);
  private readonly audioEngine = inject(AudioEngineService);
  private readonly uiClickSound = inject(UiClickSoundService);
  private readonly audioPlayback = inject(AudioPlaybackService);
  readonly serverWake = inject(ServerWakeService);
  private readonly swUpdate = inject(SwUpdateService);

  private backendBooted = false;

  /** URL actual, reactiva. Permite distinguir rutas "seguras" de la partida. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * El usuario está en una pantalla donde recargar lo interrumpiría: una partida
   * en curso o una transmisión como espectador. Fuera de eso (menú, lobby, auth)
   * recargar es un parpadeo inocuo.
   */
  private readonly isInMatch = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/match/') || url.startsWith('/spectate/');
  });

  /**
   * Cola unificada de toasts. Las cuatro fuentes (invitaciones, solicitudes de
   * amistad, logros y bots desbloqueados) se ordenan por prioridad y se muestra
   * solo la cabeza; al resolver/descartar el actual, su fuente se limpia y la
   * próxima pasa a ser cabeza automáticamente. Las invitaciones van primero
   * porque expiran.
   */
  private readonly toastQueue = computed<ToastVM[]>(() => {
    const queue: ToastVM[] = [];

    const invitation = this.social.incomingInvitationToast();
    if (invitation) {
      queue.push({
        key: `invitation:${invitation.invitationId}`,
        title: invitation.senderUsername,
        body: 'Te invitó a jugar una partida',
        actions: [
          {
            label: 'Aceptar',
            variant: 'primary',
            run: () =>
              this.social.acceptInvitation(invitation.invitationId, (targetId) => {
                void this.router.navigate(['/match', targetId]);
              }),
          },
          {
            label: 'Rechazar',
            variant: 'danger',
            run: () => this.social.declineInvitation(invitation.invitationId),
          },
        ],
      });
    }

    const requester = this.social.incomingToast();
    if (requester) {
      queue.push({
        key: `friend:${requester}`,
        title: requester,
        body: 'Te envió una solicitud de amistad',
        actions: [
          {
            label: 'Aceptar',
            variant: 'primary',
            run: () => this.social.acceptRequest(requester),
          },
          {
            label: 'Rechazar',
            variant: 'danger',
            run: () => this.social.declineRequest(requester),
          },
        ],
        onClose: () => this.social.dismissToast(),
      });
    }

    const achievement = this.profileNotifications.current();
    if (achievement) {
      queue.push({
        key: `achievement:${achievement.achievement.achievementCode}`,
        title: achievement.name,
        body: achievement.description,
        actions: [
          { label: 'Cerrar', variant: 'neutral', run: () => this.profileNotifications.dismiss() },
        ],
      });
    }

    const botUnlock = this.campaignPoints.botUnlocked();
    if (botUnlock) {
      queue.push({
        key: `bot-unlock:${botUnlock.botId}`,
        title: '¡Rival desbloqueado!',
        body: 'Sumaste un bot de campaña al modo casual. Lo encontrás en "Partida vs bots".',
        actions: [
          {
            label: 'Cerrar',
            variant: 'neutral',
            run: () => this.campaignPoints.dismissBotUnlock(),
          },
        ],
      });
    }

    return queue;
  });

  /** Toast visible (cabeza de la cola). */
  readonly currentToast = computed<ToastVM | null>(() => this.toastQueue()[0] ?? null);

  /** Cuántos toasts quedan esperando detrás del actual. */
  readonly pendingToastCount = computed(() => Math.max(0, this.toastQueue().length - 1));

  constructor() {
    // Despierta Render + Neon antes que nada y muestra la overlay si tarda.
    this.serverWake.start();

    // Los servicios que pegan al backend arrancan recién cuando readiness da 200.
    // Si no, en cada cold-start se dispararían como una tormenta de requests que
    // fallan (presencia, social, WebSocket) antes de que el server esté arriba.
    effect(() => {
      if (this.serverWake.isReady()) {
        untracked(() => this.bootBackendServices());
      }
    });

    // Audio: no toca el backend y debe anclar el desbloqueo de iOS al primer
    // gesto desde el bootstrap, así que arranca de inmediato. El engine ancla el
    // contexto único + el gesto/recovery; los servicios registran su parte.
    this.audioEngine.start();
    this.uiClickSound.start();
    this.audioPlayback.start();

    // Service Worker: empieza a vigilar actualizaciones del FE.
    this.swUpdate.start();

    // Cuando hay versión nueva lista y el usuario NO está en partida, activamos y
    // recargamos solos: es un parpadeo y garantiza que el FE quede alineado con el
    // contrato del BE. Mientras esté en partida no hacemos nada (no le cortamos el
    // juego); al salir a una ruta segura, este effect se reevalúa y dispara la
    // recarga automáticamente.
    effect(() => {
      if (this.swUpdate.updateReady() && !this.isInMatch()) {
        untracked(() => void this.swUpdate.applyUpdate());
      }
    });
  }

  private bootBackendServices(): void {
    if (this.backendBooted) {
      return;
    }

    this.backendBooted = true;
    this.authService.rehydrateIdentityIfNeeded().subscribe();
    this.presenceCoordinator.start();
    this.profileNotifications.start();
    this.campaignPoints.start();
    this.social.start();
  }
}
