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

/** Cantidad de bots que hay que elegir para armar el duelo bot-vs-bot. */
const REQUIRED_BOT_COUNT = 2;

/**
 * Configuración de una partida bot-vs-bot (§9.2b): se eligen DOS bots distintos
 * y un formato de serie. Al crear, el usuario queda dueño/ocupado y se lo lleva a
 * espectar la partida. Espejo de BotsConfigPageComponent pero con doble selección.
 */
@Component({
  selector: 'app-bot-vs-bot-config-page',
  standalone: true,
  imports: [
    BotCardComponent,
    SeriesFormatSelectorComponent,
    MatProgressSpinnerModule,
    BackButtonComponent,
  ],
  templateUrl: './bot-vs-bot-config-page.component.html',
  styleUrl: '../bots-config-page/bots-config-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotVsBotConfigPageComponent implements OnInit {
  private readonly api = inject(BotsApiService);
  private readonly campaignApi = inject(CampaignApiService);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly navigationLock = inject(NavigationLockService);

  constructor() {
    effect(() => this.navigationLock.set(this.creatingMatch()));
    inject(DestroyRef).onDestroy(() => this.navigationLock.set(false));
  }

  readonly casualBots = signal<Bot[]>([]);
  readonly campaignBots = signal<Bot[]>([]);
  readonly lockedCampaignBots = signal<Bot[]>([]);
  readonly loadingCatalog = signal<boolean>(true);
  readonly catalogError = signal<string | null>(null);
  /** Ids de los bots elegidos (máximo dos, siempre distintos). */
  readonly selectedBotIds = signal<readonly string[]>([]);
  readonly seriesFormat = signal<SeriesFormat>(DEFAULT_SERIES_FORMAT);
  readonly creatingMatch = signal<boolean>(false);
  readonly createMatchError = signal<string | null>(null);

  readonly totalBots = computed(() => this.casualBots().length + this.campaignBots().length);

  readonly canCreate = computed(
    () =>
      !this.creatingMatch() &&
      !this.loadingCatalog() &&
      this.selectedBotIds().length === REQUIRED_BOT_COUNT,
  );

  ngOnInit(): void {
    this.titleService.setTitle('Mirar dos bots — Truco a 3');
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
        console.error('[BotVsBotConfigPage] error cargando catálogo', err);
        this.catalogError.set(getErrorCopy('BOT_CATALOG', err));
        this.casualBots.set([]);
        this.campaignBots.set([]);
        this.lockedCampaignBots.set([]);
        this.loadingCatalog.set(false);
      },
    });
  }

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
        console.warn('[BotVsBotConfigPage] no se pudo cargar la campaña para bots bloqueados', err);
        this.lockedCampaignBots.set([]);
      },
    });
  }

  retry(): void {
    this.loadCatalog();
  }

  isSelected(botId: string): boolean {
    return this.selectedBotIds().includes(botId);
  }

  /**
   * Alterna un bot en la selección: lo saca si ya estaba; si no, lo agrega
   * mientras no se llegue a dos. Con dos ya elegidos hay que deseleccionar uno
   * primero (no se reemplaza en silencio).
   */
  onSelectBot(botId: string): void {
    const current = this.selectedBotIds();
    if (current.includes(botId)) {
      this.selectedBotIds.set(current.filter((id) => id !== botId));
      return;
    }
    if (current.length >= REQUIRED_BOT_COUNT) {
      return;
    }
    this.selectedBotIds.set([...current, botId]);
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
    const [botOneId, botTwoId] = this.selectedBotIds();
    if (!botOneId || !botTwoId) {
      return;
    }

    this.creatingMatch.set(true);
    this.createMatchError.set(null);

    this.api
      .createBotVsBotMatch({
        botOneId,
        botTwoId,
        gamesToPlay: seriesFormatToGamesToPlay(this.seriesFormat()),
      })
      .subscribe({
        next: ({ matchId }) => {
          // Dueño de la partida: se lo lleva a espectarla. No apagamos creatingMatch
          // (el componente se destruye al navegar); si un guard cancela, se rehabilita.
          void this.router.navigate(['/spectate', matchId]).then((ok) => {
            if (!ok) {
              this.creatingMatch.set(false);
            }
          });
        },
        error: (err: unknown) => {
          console.error('[BotVsBotConfigPage] error creando partida', err);
          this.createMatchError.set(getErrorCopy('CREATE_BOT_VS_BOT_MATCH', err));
          this.creatingMatch.set(false);

          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.selectedBotIds.set([]);
            this.loadCatalog();
          }
        },
      });
  }
}
