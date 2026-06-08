import { Component, computed, inject, signal, HostListener, viewChild, afterRenderEffect } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { AuthStore } from '../../../../core/auth/auth.store';
import { ChatStore } from '../../services/chat.store';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
})
export class ChatPanelComponent {
  readonly chatStore = inject(ChatStore);
  private readonly authStore = inject(AuthStore);

  readonly selfUsername = computed(() => this.authStore.username());

  readonly composerValue = signal('');
  readonly composerLength = computed(() => this.composerValue().length);
  readonly nearLimit = computed(() => this.composerLength() >= 450);
  readonly overLimit = computed(() => this.composerLength() > 500);

  readonly canSubmit = computed(
    () =>
      this.chatStore.canSend() &&
      this.composerValue().trim().length > 0 &&
      !this.overLimit(),
  );

  readonly cooldownMs = computed(() => {
    const next = this.chatStore.sendState().nextMessageAllowedAt;
    if (next === null) { return 0; }
    return Math.max(0, next - Date.now());
  });

  readonly listRef = viewChild<ElementRef<HTMLElement>>('messageList');

  constructor() {
    // Auto-scroll al fondo: corre tras renderizar al abrir el panel y se
    // re-dispara cuando llega/envía un mensaje nuevo, dejando siempre el
    // último mensaje a la vista sin scroll manual.
    afterRenderEffect(() => {
      this.chatStore.messages();
      const list = this.listRef()?.nativeElement;
      if (list) {
        list.scrollTop = list.scrollHeight;
      }
    });
  }

  onComposerInput(event: Event): void {
    this.composerValue.set((event.target as HTMLTextAreaElement).value);
  }

  onSend(): void {
    if (!this.canSubmit()) { return; }
    this.chatStore.send(this.composerValue());
    this.composerValue.set('');
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.chatStore.closePanel();
  }

  formatTime(sentAt: number): string {
    return new Date(sentAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
