/**
 * Contract test — Chat (§7, §9.5d, §9.6).
 *
 * Verifica que los DTOs REST y la unión `ChatWsEvent` estén en paridad con
 * `docs/CONTRATOS_API.md §7/§9.6` y `specs/027-chat-online-match/contracts/chat-api.md §4`.
 */
import { describe, it, expect } from 'vitest';
import type {
  ChatView,
  ChatMessage,
  SendState,
  SendMessageResponse,
} from '../../app/core/models/chat.models';
import type { ChatWsEvent } from '../../app/core/models/ws.models';

// ─── Paridad de DTOs REST ─────────────────────────────────────────────────────

const _sendState = {
  canSendNow: true,
  nextMessageAllowedAt: null,
} satisfies Record<keyof SendState, SendState[keyof SendState]>;

const _chatMessage = {
  messageId: '',
  sender: '',
  content: '',
  sentAt: 0,
} satisfies Record<keyof ChatMessage, ChatMessage[keyof ChatMessage]>;

const _chatView = {
  chatId: '',
  parentType: 'MATCH',
  parentId: '',
  sendState: { canSendNow: true, nextMessageAllowedAt: null },
  messages: [],
} satisfies Record<keyof ChatView, ChatView[keyof ChatView]>;

const _sendMessageResponse = {
  chatId: '',
  sendState: { canSendNow: true, nextMessageAllowedAt: null },
} satisfies Record<keyof SendMessageResponse, SendMessageResponse[keyof SendMessageResponse]>;

void _sendState;
void _chatMessage;
void _chatView;
void _sendMessageResponse;

// ─── Tests de paridad de forma ────────────────────────────────────────────────

describe('Contract: Chat (§7/§9.5d/§9.6)', () => {
  it('SendState expone exactamente { canSendNow, nextMessageAllowedAt }', () => {
    const dto: SendState = { canSendNow: true, nextMessageAllowedAt: null };
    expect(Object.keys(dto).sort()).toEqual(['canSendNow', 'nextMessageAllowedAt']);
  });

  it('ChatMessage expone exactamente { messageId, sender, content, sentAt }', () => {
    const dto: ChatMessage = { messageId: 'uuid', sender: 'juancho', content: 'Hola', sentAt: 0 };
    expect(Object.keys(dto).sort()).toEqual(['content', 'messageId', 'sender', 'sentAt']);
  });

  it('ChatView expone exactamente { chatId, parentType, parentId, sendState, messages }', () => {
    const dto: ChatView = {
      chatId: 'c1',
      parentType: 'MATCH',
      parentId: 'm1',
      sendState: { canSendNow: true, nextMessageAllowedAt: null },
      messages: [],
    };
    expect(Object.keys(dto).sort()).toEqual([
      'chatId',
      'messages',
      'parentId',
      'parentType',
      'sendState',
    ]);
  });

  it('SendMessageResponse expone exactamente { chatId, sendState }', () => {
    const dto: SendMessageResponse = {
      chatId: 'c1',
      sendState: { canSendNow: false, nextMessageAllowedAt: 1_700_000_000 },
    };
    expect(Object.keys(dto).sort()).toEqual(['chatId', 'sendState']);
  });

  it('ChatWsEvent cubre CHAT_CREATED y MESSAGE_SENT (§9.5d)', () => {
    const types: ChatWsEvent['eventType'][] = ['CHAT_CREATED', 'MESSAGE_SENT'];
    expect(types).toHaveLength(2);
  });

  it('CHAT_CREATED payload es { parentType, parentId } — sin messageId (§9.6)', () => {
    const event: ChatWsEvent = {
      chatId: 'c1',
      eventType: 'CHAT_CREATED',
      timestamp: 0,
      payload: { parentType: 'MATCH', parentId: 'm1' },
    };
    expect(Object.keys(event.payload).sort()).toEqual(['parentId', 'parentType']);
  });

  it('MESSAGE_SENT payload es { sender, content, sentAt } — sin messageId (§9.6)', () => {
    const event: ChatWsEvent = {
      chatId: 'c1',
      eventType: 'MESSAGE_SENT',
      timestamp: 0,
      payload: { sender: 'juancho', content: 'Buena mano!', sentAt: 123 },
    };
    expect(Object.keys(event.payload).sort()).toEqual(['content', 'sender', 'sentAt']);
  });
});
