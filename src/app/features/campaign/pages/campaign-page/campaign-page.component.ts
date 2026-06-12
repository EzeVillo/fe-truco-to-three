import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import { CampaignApiService } from '../../services/campaign-api.service';
import { NavigationLockService } from '../../../../core/services/navigation-lock.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { GuestRegisterPromptService } from '../../../../core/auth/guest-register-prompt.service';
import type {
  CampaignRankingEntry,
  CampaignRecord,
  CampaignResponse,
} from '../../../../core/models/campaign.models';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import { markCampaignMatch } from '../../utils/campaign-match-store';

@Component({
  selector: 'app-campaign-page',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatIconModule, BackButtonComponent],
  templateUrl: './campaign-page.component.html',
  styleUrl: './campaign-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignPageComponent implements OnInit {
  private readonly api = inject(CampaignApiService);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly navigationLock = inject(NavigationLockService);
  private readonly authStore = inject(AuthStore);
  private readonly guestRegisterPrompt = inject(GuestRegisterPromptService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Nombre del jugador para el ranking; los invitados no tienen username, caen a "Vos". */
  readonly playerName = computed(() => this.authStore.username() ?? 'Vos');

  /** El modo campaña se mira pero no se juega como invitado: los desafíos exigen cuenta. */
  readonly isGuest = this.authStore.isGuest;

  constructor() {
    // Bloquea el logo del header mientras se crea el desafío (POST en vuelo).
    effect(() => this.navigationLock.set(this.challengingId() !== null));
    inject(DestroyRef).onDestroy(() => this.navigationLock.set(false));
  }

  readonly campaign = signal<CampaignResponse | null>(null);
  readonly loading = signal<boolean>(true);
  readonly loadError = signal<string | null>(null);
  /** participantId del rival cuyo desafío está en vuelo, o null. */
  readonly challengingId = signal<string | null>(null);
  readonly challengeError = signal<string | null>(null);

  readonly hasActiveChallenge = computed(
    () => this.campaign()?.activeChallengeMatchId !== null && this.campaign() !== null,
  );

  /** Los CTAs "Desafiar" se inhiben con un POST en vuelo o un desafío ya activo (§7.7.2, 422). */
  readonly challengeBlocked = computed(
    () => this.challengingId() !== null || this.hasActiveChallenge(),
  );

  ngOnInit(): void {
    this.titleService.setTitle('Modo campaña — Truco a 3');
    this.loadCampaign();
  }

  loadCampaign(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.getCampaign().subscribe({
      next: (campaign) => {
        this.campaign.set(campaign);
        this.loading.set(false);
        this.scheduleScrollToPlayer();
      },
      error: (err: unknown) => {
        console.error('[CampaignPage] error cargando campaña', err);
        this.loadError.set(getErrorCopy('CAMPAIGN_LOAD', err));
        this.campaign.set(null);
        this.loading.set(false);
      },
    });
  }

  retry(): void {
    this.loadCampaign();
  }

  /**
   * Clasifica el head-to-head contra un rival para colorear el historial. El BE
   * manda `record: null` cuando nunca se enfrentaron: lo tratamos como 0-0
   * ("even", gris) para mostrar la fila igual y que el jugador vea contra quién
   * todavía no jugó. `ahead` (verde) si le ganó más, `behind` (rojo) si perdió más.
   */
  recordTone(entry: CampaignRankingEntry): 'ahead' | 'behind' | 'even' {
    const record: CampaignRecord | null = entry.record;
    const wins = record?.wins ?? 0;
    const losses = record?.losses ?? 0;
    if (wins > losses) {
      return 'ahead';
    }
    if (wins < losses) {
      return 'behind';
    }
    return 'even';
  }

  goBack(): void {
    void this.router.navigateByUrl('/lobby');
  }

  continueChallenge(): void {
    const matchId = this.campaign()?.activeChallengeMatchId;
    if (matchId) {
      markCampaignMatch(matchId);
      void this.router.navigate(['/match', matchId]);
    }
  }

  onChallenge(entry: CampaignRankingEntry): void {
    const campaign = this.campaign();
    if (!campaign || !entry.challengeable || this.challengeBlocked()) {
      return;
    }

    // Invitado: no se manda nada al BE; se le ofrece registrarse en un modal.
    if (this.isGuest()) {
      this.promptRegister();
      return;
    }

    this.challengingId.set(entry.participantId);
    this.challengeError.set(null);

    // §7.7.2: antes de llegar al #1 el body va vacío (rival inmediato);
    // tras el #1 el BE exige el botId del rival elegido.
    const botId = campaign.topOneReached ? entry.participantId : undefined;

    this.api.createChallenge(botId).subscribe({
      next: ({ matchId }) => {
        // Marca el match como de campaña para que, al terminar, el match-screen
        // espere el push CAMPAIGN_MATCH_POINTS y muestre el modal de puntos.
        markCampaignMatch(matchId);
        // No apagamos challengingId acá: el componente se destruye al navegar.
        // Si la navegación se cancela (p. ej. un guard), re-habilitamos los CTAs.
        void this.router.navigate(['/match', matchId]).then((ok) => {
          if (!ok) {
            this.challengingId.set(null);
          }
        });
      },
      error: (err: unknown) => {
        console.error('[CampaignPage] error creando desafío', err);
        this.challengeError.set(getErrorCopy('CAMPAIGN_CHALLENGE', err));
        this.challengingId.set(null);

        // El estado del ranking cambió del lado del BE (rival inválido o
        // desafío ya activo): recargamos para reflejarlo.
        if (
          err instanceof HttpErrorResponse &&
          (err.status === 404 || err.status === 422 || err.status === 400)
        ) {
          this.loadCampaign();
        }
      },
    });
  }

  /**
   * Modal para invitados: el modo campaña se mira pero no se juega sin cuenta.
   * Si confirma, se cierra la sesión de invitado y se lo manda al registro con
   * returnUrl para volver a la campaña ya registrado.
   */
  private promptRegister(): void {
    this.guestRegisterPrompt.prompt({
      returnUrl: '/lobby/campaign',
      message:
        'El modo campaña se mira como invitado, pero para desafiar a un rival necesitás una cuenta. ¿Querés crear una?',
    });
  }

  /** Centra la fila del jugador en el scroll tras renderizar el ranking. */
  private scheduleScrollToPlayer(): void {
    setTimeout(() => {
      const row = (this.host.nativeElement as HTMLElement).querySelector('.campaign__row--player');
      // jsdom no implementa scrollIntoView; en runtime real siempre existe.
      if (row && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ block: 'center' });
      }
    });
  }
}
