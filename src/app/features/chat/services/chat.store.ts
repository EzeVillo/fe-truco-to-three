// Store de chat — feature 027-chat-online-match.
//
// Gestiona el ciclo de vida del chat de una partida online: bootstrap REST,
// suscripción WS (/user/queue/chat), reconciliación en reconexión y cooldown
// de envío derivado del epoch del servidor.
//
// Patrón espejo de features/social/services/social.store.ts.

import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { HttpErrorResponse } from '@angular/common/http';
import type { Subscription } from 'rxjs';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { AudioPlaybackService } from '../../../core/services/audio-playback.service';
import { getErrorCopy } from '../../../shared/error-copy/error-copy';
import { ChatApiService } from './chat-api.service';
import type { ChatMessage, ChatView, SendState } from '../../../core/models/chat.models';
import type { ChatWsEvent } from '../../../core/models/ws.models';

interface ChatState {
  matchId: string | null;
  chatId: string | null;
  messages: ChatMessage[];
  sendState: SendState;
  panelOpen: boolean;
  /** Hay mensajes recibidos que el usuario aún no vio (panel cerrado). */
  unread: boolean;
  loading: boolean;
  error: string | null;
  sendError: string | null;
}

const INITIAL: ChatState = {
  matchId: null,
  chatId: null,
  messages: [],
  sendState: { canSendNow: true, nextMessageAllowedAt: null },
  panelOpen: false,
  unread: false,
  loading: false,
  error: null,
  sendError: null,
};

const MAX_MESSAGES = 50;

/** SFX de notificación al recibir un mensaje ajeno. Servido desde `public/`. */
const MESSAGE_SOUND_PATH = '/audio/537061__imafoley__message-pop-sound.mp3';

function maxSentAt(messages: ChatMessage[]): number {
  return messages.reduce((m, msg) => Math.max(m, msg.sentAt), 0);
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const threshold = maxSentAt(existing);
  const newer = incoming.filter((m) => m.sentAt > threshold);
  const merged = [...existing, ...newer].sort((a, b) => a.sentAt - b.sentAt);
  return merged.length > MAX_MESSAGES ? merged.slice(merged.length - MAX_MESSAGES) : merged;
}

export const ChatStore = signalStore(
  { providedIn: 'root' },

  withState<ChatState>(INITIAL),

  withComputed((store) => ({
    available: computed(() => store.chatId() !== null),
    canSend: computed(() => store.sendState().canSendNow),
  })),

  withMethods((store) => {
    const api = inject(ChatApiService);
    const ws = inject(WebSocketService);
    const auth = inject(AuthStore);
    const audio = inject(AudioPlaybackService);

    let wsSub: Subscription | null = null;
    let connectedSub: Subscription | null = null;
    let cooldownTimerId: number | null = null;

    function clearCooldownTimer(): void {
      if (cooldownTimerId !== null) {
        clearTimeout(cooldownTimerId);
        cooldownTimerId = null;
      }
    }

    function applySendState(sendState: SendState): void {
      patchState(store, { sendState });
      clearCooldownTimer();
      if (!sendState.canSendNow && sendState.nextMessageAllowedAt !== null) {
        const delay = Math.max(0, sendState.nextMessageAllowedAt - Date.now());
        cooldownTimerId = window.setTimeout(() => {
          cooldownTimerId = null;
          patchState(store, { sendState: { canSendNow: true, nextMessageAllowedAt: null } });
        }, delay);
      }
    }

    function doBootstrap(matchId: string): void {
      patchState(store, { loading: true, error: null });
      api.getByParentMatch(matchId).subscribe({
        next: (view: ChatView) => {
          const sorted = [...view.messages].sort((a, b) => a.sentAt - b.sentAt);
          const base = sorted.slice(-MAX_MESSAGES);
          // Reconciliar: conservar mensajes WS que llegaron después del último del GET
          const reconciled = mergeMessages(base, store.messages());
          applySendState(view.sendState);
          patchState(store, {
            chatId: view.chatId,
            messages: reconciled,
            loading: false,
          });
        },
        error: (err: unknown) => {
          patchState(store, { loading: false });
          if (err instanceof HttpErrorResponse && err.status === 404) {
            // Sin chat (bot o aún no creado): silencioso — no setear error visible.
            console.warn('[ChatStore] bootstrap 404 — sin chat para este match');
          } else {
            patchState(store, { error: getErrorCopy('CHAT', err) });
          }
        },
      });
    }

    function applyEvent(event: ChatWsEvent): void {
      const matchId = store.matchId();
      const chatId = store.chatId();

      if (event.eventType === 'CHAT_CREATED') {
        if (event.payload.parentId === matchId && chatId === null) {
          patchState(store, { chatId: event.chatId });
        }
      } else if (event.eventType === 'MESSAGE_SENT') {
        if (event.chatId === chatId) {
          const { sender, content, sentAt } = event.payload;
          const existing = store.messages();
          if (sentAt > maxSentAt(existing)) {
            const newMsg: ChatMessage = { messageId: '', sender, content, sentAt };
            const next = [...existing, newMsg].sort((a, b) => a.sentAt - b.sentAt);
            const isForeign = sender !== auth.username();
            // Notificar sólo mensajes ajenos cuando el panel está cerrado.
            const markUnread = !store.panelOpen() && isForeign;
            patchState(store, {
              messages: next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next,
              ...(markUnread ? { unread: true } : {}),
            });
            // SFX de "pop" al recibir un mensaje ajeno (respeta el volumen de efectos).
            if (isForeign) {
              audio.play(MESSAGE_SOUND_PATH);
            }
          }
        }
      }
    }

    function subscribeWs(): void {
      if (wsSub) {
        return;
      }
      ws.connect();
      wsSub = ws.subscribe<ChatWsEvent>('/user/queue/chat').subscribe((event) => applyEvent(event));
      connectedSub = ws.connected.subscribe((isConnected) => {
        const matchId = store.matchId();
        if (isConnected && matchId !== null) {
          doBootstrap(matchId);
        }
      });
    }

    function unsubscribeWs(): void {
      wsSub?.unsubscribe();
      connectedSub?.unsubscribe();
      wsSub = null;
      connectedSub = null;
    }

    return {
      /** Entra a una partida: setea matchId, suscribe WS, dispara bootstrap. Idempotente. */
      enterMatch(matchId: string): void {
        if (store.matchId() === matchId) {
          return;
        }
        clearCooldownTimer();
        patchState(store, { ...INITIAL, matchId });
        // Precargar el SFX para que el primer mensaje suene sin esperar la descarga.
        audio.preload([MESSAGE_SOUND_PATH]);
        subscribeWs();
        doBootstrap(matchId);
      },

      /** Sale de la partida: resetea el store y desuscribe WS. */
      leave(): void {
        unsubscribeWs();
        clearCooldownTimer();
        patchState(store, INITIAL);
      },

      togglePanel(): void {
        const willOpen = !store.panelOpen();
        // Al abrir, el usuario "ve" el chat: se limpia la notificación.
        patchState(store, { panelOpen: willOpen, ...(willOpen ? { unread: false } : {}) });
      },

      closePanel(): void {
        patchState(store, { panelOpen: false });
      },

      /** Envía un mensaje. Valida trim/longitud antes de llamar a la API. */
      send(content: string): void {
        const trimmed = content.trim();
        if (!trimmed || trimmed.length > 500) {
          return;
        }

        const matchId = store.matchId();
        if (!matchId) {
          return;
        }

        patchState(store, { sendError: null });

        api.sendToParentMatch(matchId, trimmed).subscribe({
          next: (response) => {
            applySendState(response.sendState);
          },
          error: (err: unknown) => {
            if (err instanceof HttpErrorResponse && err.status === 422) {
              const body = err.error as { errorCode?: string } | null;
              if (body?.errorCode === 'ChatRateLimitExceededException') {
                // Reconciliar cooldown vía GET (§1.1)
                doBootstrap(matchId);
                return;
              }
            }
            patchState(store, { sendError: getErrorCopy('CHAT', err) });
          },
        });
      },

      clearSendError(): void {
        patchState(store, { sendError: null });
      },
    };
  }),
);
