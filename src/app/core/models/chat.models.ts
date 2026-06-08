// DTOs del chat — feature 027-chat-online-match.
// Fuente: docs/CONTRATOS_API.md §7 y specs/027-chat-online-match/data-model.md §2.

export type ChatParentType = 'MATCH' | 'LEAGUE' | 'CUP' | 'FRIENDSHIP';

export interface SendState {
  canSendNow: boolean;
  /** epoch millis del próximo envío permitido; null cuando puede enviar. */
  nextMessageAllowedAt: number | null;
}

export interface ChatMessage {
  /** UUID — presente en el GET; vacío ('') en mensajes recibidos por WS. */
  messageId: string;
  sender: string;
  content: string;
  sentAt: number;
}

export interface ChatView {
  chatId: string;
  parentType: ChatParentType;
  parentId: string;
  sendState: SendState;
  messages: ChatMessage[];
}

export interface SendMessageRequest {
  content: string;
}

export interface SendMessageResponse {
  chatId: string;
  sendState: SendState;
}
