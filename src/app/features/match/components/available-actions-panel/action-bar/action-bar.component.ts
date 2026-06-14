import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TapActionDirective } from '../../../../../shared/directives/tap-action.directive';
import type { AvailableActionType } from '../../../../../core/models/enums';
import type { TrucoCall } from '../../../../../core/models/enums';
import {
  hasAnyEnvidoCallOption,
  type EnvidoCallOptions,
} from '../../../utils/derive-envido-call-options';

export interface ActionBarItem {
  label: string;
  actionType: AvailableActionType | 'BACK';
  enabled: boolean;
}

function trucoLabel(call: TrucoCall | null): string {
  switch (call) {
    case 'TRUCO':
      return 'Retruco';
    case 'RETRUCO':
      return 'Vale 4';
    case 'VALE_CUATRO':
      return 'Vale 4';
    default:
      return 'Truco';
  }
}

function actionEnabled(
  actions: ReadonlyArray<{ type: AvailableActionType }>,
  type: AvailableActionType,
): boolean {
  return actions.some((a) => a.type === type);
}

@Component({
  selector: 'app-action-bar',
  standalone: true,
  imports: [CommonModule, TapActionDirective],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionBarComponent {
  readonly availableActions = input.required<ReadonlyArray<{ type: AvailableActionType }>>();
  readonly currentTrucoCall = input<TrucoCall | null>(null);
  readonly envidoCallOptions = input<EnvidoCallOptions | null>(null);
  readonly isProcessingDelay = input<boolean>(false);

  readonly actionClicked = output<AvailableActionType>();
  readonly envidoClicked = output<void>();

  readonly items = computed<ActionBarItem[]>(() => {
    const actions = this.availableActions();
    const envidoOpts = this.envidoCallOptions();
    const isDelay = this.isProcessingDelay();

    if (isDelay) {
      return [
        { label: trucoLabel(this.currentTrucoCall()), actionType: 'CALL_TRUCO', enabled: false },
        { label: 'Envido', actionType: 'CALL_ENVIDO', enabled: false },
        { label: 'Mazo', actionType: 'FOLD', enabled: false },
      ];
    }

    const envidoAvailable =
      actionEnabled(actions, 'CALL_ENVIDO') &&
      (envidoOpts === null || hasAnyEnvidoCallOption(envidoOpts));
    return [
      {
        label: trucoLabel(this.currentTrucoCall()),
        actionType: 'CALL_TRUCO',
        enabled: actionEnabled(actions, 'CALL_TRUCO'),
      },
      {
        label: 'Envido',
        actionType: 'CALL_ENVIDO',
        enabled: envidoAvailable,
      },
      {
        label: 'Mazo',
        actionType: 'FOLD',
        enabled: actionEnabled(actions, 'FOLD'),
      },
    ];
  });

  onClick(item: ActionBarItem): void {
    if (!item.enabled) {
      return;
    }
    if (item.actionType === 'CALL_ENVIDO') {
      this.envidoClicked.emit();
      return;
    }
    this.actionClicked.emit(item.actionType as AvailableActionType);
  }
}
