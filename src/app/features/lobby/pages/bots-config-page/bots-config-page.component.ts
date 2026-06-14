import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BotCardComponent } from '../../components/bot-card/bot-card.component';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import { SeriesFormatSelectorComponent } from '../../components/series-format-selector/series-format-selector.component';
import { BotsApiService } from '../../services/bots-api.service';
import { CampaignApiService } from '../../../campaign/services/campaign-api.service';
import { NavigationLockService } from '../../../../core/services/navigation-lock.service';
import type { Bot } from '../../../../core/models/bot.models';
import {
  DEFAULT_SERIES_FORMAT,
  seriesFormatToGamesToPlay,
} from '../../../../core/models/match.models';
import type { SeriesFormat } from '../../../../core/models/match.models';
import { getErrorCopy } from '../../../../shared/error-copy/error-copy';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-bots-config-page',
  standalone: true,
  imports: [
    BotCardComponent,
    SeriesFormatSelectorComponent,
    MatProgressSpinnerModule,
    BackButtonComponent,
  ],
  templateUrl: './bots-config-page.component.html',
  styleUrl: './bots-config-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotsConfigPageComponent implements OnInit {
  private readonly api = inject(BotsApiService);
  private readonly campaignApi = inject(CampaignApiService);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly navigationLock = inject(NavigationLockService);

  constructor() {
    // Bloquea el logo del header mientras se crea la partida (POST en vuelo).
    effect(() => this.navigationLock.set(this.creatingMatch()));
    inject(DestroyRef).onDestroy(() => this.navigationLock.set(false));
  }

  readonly casualBots = signal<Bot[]>([]);
  readonly campaignBots = signal<Bot[]>([]);
  /**
   * Bots de campaña que el jugador todavía no desbloqueó. Se muestran en la
   * sección de campaña pero deshabilitados (no se pueden elegir). Salen de cruzar
   * el ranking de `GET /api/campaign` con los desbloqueados de `GET /api/bots`.
   */
  readonly lockedCampaignBots = signal<Bot[]>([]);
  readonly loadingCatalog = signal<boolean>(true);
  readonly catalogError = signal<string | null>(null);
  readonly selectedBotId = signal<string | null>(null);
  readonly seriesFormat = signal<SeriesFormat>(DEFAULT_SERIES_FORMAT);
  readonly creatingMatch = signal<boolean>(false);
  readonly createMatchError = signal<string | null>(null);

  /** Total de bots elegibles (casuales + campaña desbloqueados). */
  readonly totalBots = computed(() => this.casualBots().length + this.campaignBots().length);

  readonly canCreate = computed(
    () =>
      !this.creatingMatch() &&
      !this.loadingCatalog() &&
      this.totalBots() > 0 &&
      this.selectedBotId() !== null,
  );

  ngOnInit(): void {
    this.titleService.setTitle('Partida vs bots — Truco a 3');
    this.loadCatalog();
  }

  loadCatalog(): void {
    this.loadingCatalog.set(true);
    this.catalogError.set(null);
    this.lockedCampaignBots.set([]);

    this.api.getBots().subscribe({
      next: (catalog) => {
        const casual = catalog.casual ?? [];
        const unlocked = catalog.campaignUnlocked ?? [];
        this.casualBots.set(casual);
        this.campaignBots.set(unlocked);
        this.loadingCatalog.set(false);
        this.loadLockedCampaignBots([...casual, ...unlocked]);
      },
      error: (err: unknown) => {
        console.error('[BotsConfigPage] error cargando catálogo', err);
        this.catalogError.set(getErrorCopy('BOT_CATALOG', err));
        this.casualBots.set([]);
        this.campaignBots.set([]);
        this.lockedCampaignBots.set([]);
        this.loadingCatalog.set(false);
      },
    });
  }

  /**
   * Trae el ranking de campaña para listar los bots aún bloqueados. Los bloqueados
   * son las filas que no son del jugador y cuyo bot no está entre los disponibles.
   * Si la campaña falla no es crítico: el modo casual funciona igual, solo no se
   * muestran los bots bloqueados.
   */
  private loadLockedCampaignBots(available: Bot[]): void {
    const availableIds = new Set(available.map((bot) => bot.botId));

    this.campaignApi.getCampaign().subscribe({
      next: (campaign) => {
        const locked = (campaign.ranking ?? [])
          .filter((entry) => !entry.player && !availableIds.has(entry.participantId))
          .map<Bot>((entry) => ({
            botId: entry.participantId,
            name: entry.displayName ?? 'Bot anónimo',
          }));
        this.lockedCampaignBots.set(locked);
      },
      error: (err: unknown) => {
        console.warn('[BotsConfigPage] no se pudo cargar la campaña para bots bloqueados', err);
        this.lockedCampaignBots.set([]);
      },
    });
  }

  retry(): void {
    this.loadCatalog();
  }

  onSelectBot(botId: string): void {
    this.selectedBotId.set(botId);
  }

  onChangeFormat(format: SeriesFormat): void {
    this.seriesFormat.set(format);
  }

  goBack(): void {
    void this.router.navigateByUrl('/lobby');
  }

  onCreate(): void {
    if (!this.canCreate()) {
      return;
    }
    const botId = this.selectedBotId();
    if (botId === null) {
      return;
    }

    this.creatingMatch.set(true);
    this.createMatchError.set(null);

    this.api
      .createBotMatch({
        botId,
        gamesToPlay: seriesFormatToGamesToPlay(this.seriesFormat()),
      })
      .subscribe({
        next: ({ matchId }) => {
          // No apagamos creatingMatch acá: el componente se destruye al navegar.
          // Si la navegación se cancela (p. ej. un guard), re-habilitamos el botón.
          void this.router.navigate(['/match', matchId]).then((ok) => {
            if (!ok) {
              this.creatingMatch.set(false);
            }
          });
        },
        error: (err: unknown) => {
          console.error('[BotsConfigPage] error creando partida', err);
          this.createMatchError.set(getErrorCopy('CREATE_BOT_MATCH', err));
          this.creatingMatch.set(false);

          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.selectedBotId.set(null);
            this.loadCatalog();
          }
        },
      });
  }
}
