import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { AvailableAction } from '../../../../core/models/match.models';
import type { TrucoCall, AvailableActionType, EnvidoCall } from '../../../../core/models/enums';
import { ActionBarComponent } from './action-bar/action-bar.component';
import { EnvidoSubmenuComponent } from './envido-submenu/envido-submenu.component';
import { EnvidoResponsePanelComponent } from './envido-response-panel/envido-response-panel.component';
import { TrucoResponsePanelComponent } from './truco-response-panel/truco-response-panel.component';
import { deriveEnvidoResponseOptions } from '../../utils/derive-envido-response-options';

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

  readonly envidoSubmenuOpen = signal<boolean>(false);

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
    // Intencionalmente vacío en esta etapa visual (sin lógica real)
    // eslint-disable-next-line no-console
    console.log('Action clicked:', action);
  }
}
