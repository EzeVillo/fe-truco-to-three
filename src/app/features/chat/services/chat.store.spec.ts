import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { ChatStore } from './chat.store';
import { ChatApiService } from './chat-api.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { AudioPlaybackService } from '../../../core/services/audio-playback.service';
import { environment } from '../../../../environments/environment';
import type { ChatView, SendState } from '../../../core/models/chat.models';
import type { ChatWsEvent } from '../../../core/models/ws.models';

const MATCH_ID = 'match-abc';
const CHAT_ID = 'chat-xyz';
const BASE = environment.apiUrl;

function makeChatView(overrides: Partial<ChatView> = {}): ChatView {
  return {
    chatId: CHAT_ID,
    parentType: 'MATCH',
    parentId: MATCH_ID,
    sendState: { canSendNow: true, nextMessageAllowedAt: null },
    messages: [],
    ...overrides,
  };
}

function makeWsService() {
  const chatSubject = new Subject<ChatWsEvent>();
  const connectedSubject = new Subject<boolean>();
  return {
    connect: vi.fn(),
    subscribe: vi.fn(() => chatSubject.asObservable()),
    connected: connectedSubject.asObservable(),
    _emit: (event: ChatWsEvent) => chatSubject.next(event),
    _setConnected: (v: boolean) => connectedSubject.next(v),
  };
}

describe('ChatStore — US1: leer la conversación', () => {
  let store: InstanceType<typeof ChatStore>;
  let httpMock: HttpTestingController;
  let wsMock: ReturnType<typeof makeWsService>;

  beforeEach(() => {
    wsMock = makeWsService();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ChatApiService,
        { provide: WebSocketService, useValue: wsMock },
        { provide: AudioPlaybackService, useValue: { play: vi.fn(), preload: vi.fn() } },
        ChatStore,
      ],
    });
    store = TestBed.inject(ChatStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('estado inicial: available=false, panelOpen=false, messages vacío', () => {
    expect(store.available()).toBe(false);
    expect(store.panelOpen()).toBe(false);
    expect(store.messages()).toEqual([]);
  });

  it('enterMatch: bootstrap 200 puebla chatId, messages y sendState', () => {
    const view = makeChatView({
      messages: [{ messageId: 'msg-1', sender: 'juan', content: 'Hola', sentAt: 1000 }],
      sendState: { canSendNow: true, nextMessageAllowedAt: null },
    });
    store.enterMatch(MATCH_ID);

    const req = httpMock.expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`);
    req.flush(view);

    expect(store.chatId()).toBe(CHAT_ID);
    expect(store.messages()).toHaveLength(1);
    expect(store.available()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('enterMatch: bootstrap 404 deja available=false sin error visible', () => {
    store.enterMatch(MATCH_ID);
    const req = httpMock.expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`);
    req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    expect(store.available()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('enterMatch idempotente: segunda llamada con mismo matchId no repite bootstrap', () => {
    store.enterMatch(MATCH_ID);
    store.enterMatch(MATCH_ID);
    httpMock.expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`);
  });

  it('togglePanel invierte panelOpen', () => {
    expect(store.panelOpen()).toBe(false);
    store.togglePanel();
    expect(store.panelOpen()).toBe(true);
    store.togglePanel();
    expect(store.panelOpen()).toBe(false);
  });

  it('leave() resetea el store', () => {
    store.enterMatch(MATCH_ID);
    const req = httpMock.expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`);
    req.flush(makeChatView());

    store.togglePanel();
    store.leave();

    expect(store.matchId()).toBeNull();
    expect(store.chatId()).toBeNull();
    expect(store.panelOpen()).toBe(false);
    expect(store.available()).toBe(false);
  });
});

describe('ChatStore — US2: recibir mensajes en vivo', () => {
  let store: InstanceType<typeof ChatStore>;
  let httpMock: HttpTestingController;
  let wsMock: ReturnType<typeof makeWsService>;

  beforeEach(() => {
    wsMock = makeWsService();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ChatApiService,
        { provide: WebSocketService, useValue: wsMock },
        { provide: AudioPlaybackService, useValue: { play: vi.fn(), preload: vi.fn() } },
        ChatStore,
      ],
    });
    store = TestBed.inject(ChatStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  function enterAndBootstrap(view: ChatView = makeChatView()): void {
    store.enterMatch(MATCH_ID);
    httpMock.expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`).flush(view);
  }

  it('CHAT_CREATED con parentId del match actual disponibiliza el chat (available=true)', () => {
    // Empezar sin chatId (bootstrap sin chatId)
    store.enterMatch(MATCH_ID);
    httpMock
      .expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`)
      .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    expect(store.available()).toBe(false);

    const chatCreated: ChatWsEvent = {
      chatId: CHAT_ID,
      eventType: 'CHAT_CREATED',
      timestamp: 1000,
      payload: { parentType: 'MATCH', parentId: MATCH_ID },
    };
    wsMock._emit(chatCreated);

    expect(store.chatId()).toBe(CHAT_ID);
    expect(store.available()).toBe(true);
  });

  it('CHAT_CREATED con parentId de otro match se ignora', () => {
    enterAndBootstrap();

    wsMock._emit({
      chatId: 'other-chat',
      eventType: 'CHAT_CREATED',
      timestamp: 0,
      payload: { parentType: 'MATCH', parentId: 'other-match' },
    });

    expect(store.chatId()).toBe(CHAT_ID);
  });

  it('MESSAGE_SENT del chatId actual hace append', () => {
    enterAndBootstrap();

    wsMock._emit({
      chatId: CHAT_ID,
      eventType: 'MESSAGE_SENT',
      timestamp: 2000,
      payload: { sender: 'juan', content: '¡Truco!', sentAt: 2000 },
    });

    expect(store.messages()).toHaveLength(1);
    expect(store.messages()[0].content).toBe('¡Truco!');
  });

  it('MESSAGE_SENT deduplica por sentAt (no agrega si sentAt <= último conocido)', () => {
    const view = makeChatView({
      messages: [{ messageId: 'm1', sender: 'juan', content: 'Hola', sentAt: 1000 }],
    });
    enterAndBootstrap(view);

    wsMock._emit({
      chatId: CHAT_ID,
      eventType: 'MESSAGE_SENT',
      timestamp: 1000,
      payload: { sender: 'juan', content: 'Hola', sentAt: 1000 },
    });

    expect(store.messages()).toHaveLength(1);
  });

  it('reconexión dispara re-bootstrap', () => {
    enterAndBootstrap();
    httpMock.expectNone(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`);

    wsMock._setConnected(true);

    httpMock.expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`).flush(makeChatView());
  });

  it('MESSAGE_SENT ajeno con panel cerrado marca unread', () => {
    enterAndBootstrap();
    expect(store.unread()).toBe(false);

    wsMock._emit({
      chatId: CHAT_ID,
      eventType: 'MESSAGE_SENT',
      timestamp: 2000,
      payload: { sender: 'juan', content: '¡Truco!', sentAt: 2000 },
    });

    expect(store.unread()).toBe(true);
  });

  it('MESSAGE_SENT con panel abierto NO marca unread', () => {
    enterAndBootstrap();
    store.togglePanel();
    expect(store.panelOpen()).toBe(true);

    wsMock._emit({
      chatId: CHAT_ID,
      eventType: 'MESSAGE_SENT',
      timestamp: 2000,
      payload: { sender: 'juan', content: '¡Truco!', sentAt: 2000 },
    });

    expect(store.unread()).toBe(false);
  });

  it('MESSAGE_SENT propio (mismo username) no marca unread', () => {
    const auth = TestBed.inject(AuthStore);
    auth.updateIdentity('p1', 'yo', 'user');
    enterAndBootstrap();

    wsMock._emit({
      chatId: CHAT_ID,
      eventType: 'MESSAGE_SENT',
      timestamp: 2000,
      payload: { sender: 'yo', content: 'mío', sentAt: 2000 },
    });

    expect(store.unread()).toBe(false);
  });

  it('MESSAGE_SENT ajeno reproduce el SFX de mensaje', () => {
    const audio = TestBed.inject(AudioPlaybackService);
    enterAndBootstrap();

    wsMock._emit({
      chatId: CHAT_ID,
      eventType: 'MESSAGE_SENT',
      timestamp: 2000,
      payload: { sender: 'juan', content: 'hola', sentAt: 2000 },
    });

    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('MESSAGE_SENT propio no reproduce el SFX', () => {
    const auth = TestBed.inject(AuthStore);
    auth.updateIdentity('p1', 'yo', 'user');
    const audio = TestBed.inject(AudioPlaybackService);
    enterAndBootstrap();

    wsMock._emit({
      chatId: CHAT_ID,
      eventType: 'MESSAGE_SENT',
      timestamp: 2000,
      payload: { sender: 'yo', content: 'mío', sentAt: 2000 },
    });

    expect(audio.play).not.toHaveBeenCalled();
  });

  it('abrir el panel limpia unread', () => {
    enterAndBootstrap();
    wsMock._emit({
      chatId: CHAT_ID,
      eventType: 'MESSAGE_SENT',
      timestamp: 2000,
      payload: { sender: 'juan', content: 'hola', sentAt: 2000 },
    });
    expect(store.unread()).toBe(true);

    store.togglePanel();

    expect(store.panelOpen()).toBe(true);
    expect(store.unread()).toBe(false);
  });
});

describe('ChatStore — US3: enviar mensajes con cooldown', () => {
  let store: InstanceType<typeof ChatStore>;
  let httpMock: HttpTestingController;
  let wsMock: ReturnType<typeof makeWsService>;

  beforeEach(() => {
    vi.useFakeTimers();
    wsMock = makeWsService();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ChatApiService,
        { provide: WebSocketService, useValue: wsMock },
        { provide: AudioPlaybackService, useValue: { play: vi.fn(), preload: vi.fn() } },
        ChatStore,
      ],
    });
    store = TestBed.inject(ChatStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
    vi.restoreAllMocks();
  });

  function enterAndBootstrap(sendState: SendState = { canSendNow: true, nextMessageAllowedAt: null }): void {
    store.enterMatch(MATCH_ID);
    httpMock
      .expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`)
      .flush(makeChatView({ sendState }));
  }

  it('send() aplica sendState del response (arranca cooldown)', () => {
    enterAndBootstrap();
    store.send('Hola');

    const req = httpMock.expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}/messages`);
    expect(req.request.body).toEqual({ content: 'Hola' });
    req.flush({ chatId: CHAT_ID, sendState: { canSendNow: false, nextMessageAllowedAt: Date.now() + 2000 } });

    expect(store.canSend()).toBe(false);
  });

  it('send() NO hace echo optimista — messages no cambia hasta MESSAGE_SENT', () => {
    enterAndBootstrap();
    const before = store.messages().length;
    store.send('Nuevo mensaje');

    httpMock
      .expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}/messages`)
      .flush({ chatId: CHAT_ID, sendState: { canSendNow: true, nextMessageAllowedAt: null } });

    expect(store.messages()).toHaveLength(before);
  });

  it('send() con contenido vacío no llama a la API', () => {
    enterAndBootstrap();
    store.send('   ');
    httpMock.expectNone(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}/messages`);
  });

  it('send() con más de 500 caracteres no llama a la API', () => {
    enterAndBootstrap();
    store.send('a'.repeat(501));
    httpMock.expectNone(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}/messages`);
  });

  it('422 rate limit (ChatRateLimitExceededException) reconcilia vía GET', () => {
    enterAndBootstrap();
    store.send('Hola');

    httpMock
      .expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}/messages`)
      .flush(
        { errorCode: 'ChatRateLimitExceededException' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    httpMock
      .expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`)
      .flush(
        makeChatView({ sendState: { canSendNow: false, nextMessageAllowedAt: Date.now() + 2000 } }),
      );

    expect(store.sendError()).toBeNull();
  });

  it('cooldown se libera al vencer nextMessageAllowedAt', () => {
    const now = Date.now();
    enterAndBootstrap({ canSendNow: false, nextMessageAllowedAt: now + 2000 });

    expect(store.canSend()).toBe(false);
    vi.advanceTimersByTime(2100);
    expect(store.canSend()).toBe(true);
  });

  it('cooldown reconstruido desde bootstrap (sobrevive refresh)', () => {
    const now = Date.now();
    store.enterMatch(MATCH_ID);

    httpMock
      .expectOne(`${BASE}/chats/by-parent/MATCH/${MATCH_ID}`)
      .flush(
        makeChatView({ sendState: { canSendNow: false, nextMessageAllowedAt: now + 3000 } }),
      );

    expect(store.canSend()).toBe(false);
    vi.advanceTimersByTime(3100);
    expect(store.canSend()).toBe(true);
  });
});
