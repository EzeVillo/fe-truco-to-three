import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { MatchView } from '../../utils/derive-match-view';
import { OpponentAreaComponent } from '../opponent-area/opponent-area.component';
import { PlayedCardsAreaComponent } from '../played-cards-area/played-cards-area.component';
import { PlayerAreaComponent } from '../player-area/player-area.component';
import { MatchStatusPanelComponent } from '../match-status-panel/match-status-panel.component';
import { AvailableActionsPanelComponent } from '../available-actions-panel/available-actions-panel.component';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [
    CommonModule,
    OpponentAreaComponent,
    PlayedCardsAreaComponent,
    PlayerAreaComponent,
    MatchStatusPanelComponent,
    AvailableActionsPanelComponent,
  ],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameBoardComponent {
  readonly view = input.required<MatchView>();
  readonly matchId = input.required<string>();
  readonly selfCallText = input<string | null>(null);
  readonly opponentCallText = input<string | null>(null);
  readonly isProcessingDelay = input<boolean>(false);
  // Temporizador de turno (feature 013-turn-timer)
  readonly timerRemainingFraction = input<number>(1);
  readonly timerIsUrgent = input<boolean>(false);
  readonly viewerActionTimedOut = input<boolean>(false);

  readonly playCardsEnabled = computed(() =>
    this.view().availableActions.some((a) => a.type === 'PLAY_CARD'),
  );
}
