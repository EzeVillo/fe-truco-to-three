import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { Bot } from '../../../../core/models/bot.models';

const AVATAR_COLORS = [
  '#1e88e5',
  '#43a047',
  '#fb8c00',
  '#8e24aa',
  '#e53935',
  '#00897b',
  '#3949ab',
  '#c0ca33',
  '#6d4c41',
  '#f4511e',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '?';
  }
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

@Component({
  selector: 'app-bot-card',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './bot-card.component.html',
  styleUrl: './bot-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotCardComponent {
  readonly bot = input.required<Bot>();
  readonly selected = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  /** Bot de campaña aún no desbloqueado: se muestra pero no se puede elegir. */
  readonly locked = input<boolean>(false);
  readonly select = output<string>();

  /** No seleccionable si está deshabilitado por la página o bloqueado por campaña. */
  readonly isDisabled = computed(() => this.disabled() || this.locked());

  readonly displayName = computed(() => {
    const name = this.bot().name?.trim();
    return name ? name : 'Bot anónimo';
  });

  readonly initials = computed(() => initials(this.displayName()));

  readonly avatarColor = computed(() => {
    const id = this.bot().botId ?? '';
    return AVATAR_COLORS[hashString(id) % AVATAR_COLORS.length];
  });

  onClick(): void {
    if (this.isDisabled()) {
      return;
    }
    this.select.emit(this.bot().botId);
  }
}
