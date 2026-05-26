import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import type { AvailableAction } from '../../../../core/models/match.models';
import type { TrucoCall, AvailableActionType, EnvidoCall } from '../../../../core/models/enums';
import { ActionBarComponent } from './action-bar/action-bar.component';
import { EnvidoSubmenuComponent } from './envido-submenu/envido-submenu.component';
import { EnvidoResponsePanelComponent } from './envido-response-panel/envido-response-panel.component';
import { TrucoResponsePanelComponent } from './truco-response-panel/truco-response-panel.component';
import { deriveEnvidoResponseOptions } from '../../utils/derive-envido-response-options';
import { MatchActionsService } from '../../services/match-actions.service';

@Component({
  selector: 'app-available-actions-panel',
  standalone: true,
  imports: [CommonModule, ActionBarComponent, EnvidoSubmenuComponent, EnvidoResponsePanelComponent, TrucoResponsePanelComponent],
  templateUrl: './available-actions-panel.component.html',
  styleUrl: './available-actions-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailableActionsPanelComponent {
  readonly availableActions = input.required<AvailableAction[]>();
  readonly currentTrucoCall = input<TrucoCall | null>(null);
  readonly matchId = input.required<string>();

  private readonly matchActionsService = inject(MatchActionsService);

  readonly envidoSubmenuOpen = signal<boolean>(false);
  readonly isCallingTruco = signal<boolean>(false);
  readonly isCallingEnvido = signal<boolean>(false);
  readonly isRespondingTruco = signal<boolean>(false);
  readonly isRespondingEnvido = signal<boolean>(false);
  readonly isFolding = signal<boolean>(false);

  readonly isTrucoResponseMode = computed(() =>
    this.availableActions().some((a) => a.type === 'RESPOND_TRUCO')
  );

  readonly isEnvidoResponseMode = computed(() =>
    this.availableActions().some((a) => a.type === 'RESPOND_ENVIDO')
  );

  readonly envidoResponseOptions = computed(() =>
    deriveEnvidoResponseOptions(this.availableActions())
  );

  readonly showWaiting = computed(() =>
    !this.envidoSubmenuOpen() && !this.isTrucoResponseMode() && !this.isEnvidoResponseMode() && this.availableActions().length === 0
  );

  onEnvidoClick(): void {
    this.envidoSubmenuOpen.set(true);
  }

  onBackClick(): void {
    this.envidoSubmenuOpen.set(false);
  }

  onAction(action: AvailableActionType | EnvidoCall | 'ENVIDO_QUIERO' | 'ENVIDO_NO_QUIERO' | 'TRUCO_QUIERO' | 'TRUCO_NO_QUIERO' | 'TRUCO_QUIERO_Y_ME_VOY_AL_MAZO'): void {
    const matchId = this.matchId();
    if (!matchId) {return;}

    switch (action) {
      case 'CALL_TRUCO':
        if (this.isCallingTruco()) {return;}
        this.isCallingTruco.set(true);
        this.matchActionsService.callTruco(matchId).pipe(
          finalize(() => this.isCallingTruco.set(false))
        ).subscribe();
        break;

      case 'ENVIDO':
      case 'REAL_ENVIDO':
      case 'FALTA_ENVIDO':
        if (this.isCallingEnvido()) {return;}
        this.isCallingEnvido.set(true);
        this.envidoSubmenuOpen.set(false);
        this.matchActionsService.callEnvido(matchId, action).pipe(
          finalize(() => this.isCallingEnvido.set(false))
        ).subscribe();
        break;

      case 'TRUCO_QUIERO':
        if (this.isRespondingTruco()) {return;}
        this.isRespondingTruco.set(true);
        this.matchActionsService.respondTruco(matchId, 'QUIERO').pipe(
          finalize(() => this.isRespondingTruco.set(false))
        ).subscribe();
        break;

      case 'TRUCO_NO_QUIERO':
        if (this.isRespondingTruco()) {return;}
        this.isRespondingTruco.set(true);
        this.matchActionsService.respondTruco(matchId, 'NO_QUIERO').pipe(
          finalize(() => this.isRespondingTruco.set(false))
        ).subscribe();
        break;

      case 'TRUCO_QUIERO_Y_ME_VOY_AL_MAZO':
        if (this.isRespondingTruco()) {return;}
        this.isRespondingTruco.set(true);
        this.matchActionsService.respondTruco(matchId, 'QUIERO_Y_ME_VOY_AL_MAZO').pipe(
          finalize(() => this.isRespondingTruco.set(false))
        ).subscribe();
        break;

      case 'ENVIDO_QUIERO':
        if (this.isRespondingEnvido()) {return;}
        this.isRespondingEnvido.set(true);
        this.matchActionsService.respondEnvido(matchId, 'QUIERO').pipe(
          finalize(() => this.isRespondingEnvido.set(false))
        ).subscribe();
        break;

      case 'ENVIDO_NO_QUIERO':
        if (this.isRespondingEnvido()) {return;}
        this.isRespondingEnvido.set(true);
        this.matchActionsService.respondEnvido(matchId, 'NO_QUIERO').pipe(
          finalize(() => this.isRespondingEnvido.set(false))
        ).subscribe();
        break;

      case 'FOLD':
        if (this.isFolding()) {return;}
        this.isFolding.set(true);
        this.matchActionsService.fold(matchId).pipe(
          finalize(() => this.isFolding.set(false))
        ).subscribe();
        break;
    }
  }
}
