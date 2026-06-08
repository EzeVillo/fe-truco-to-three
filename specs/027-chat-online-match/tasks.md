---
description: "Task list — Chat en vivo para partidas online (027)"
---

# Tasks: Chat en vivo para partidas online

**Input**: Design documents from `/specs/027-chat-online-match/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/chat-api.md](contracts/chat-api.md)

**Tests**: Incluidos. El proyecto exige contract tests (constitución principio II) y `pnpm test`
es gate de calidad; las features existentes tienen `.spec.ts` por convención.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles`.
> - **Contrato**: verificar campos contra `docs/CONTRATOS_API.md §7/§9.6` antes de tipar DTOs.
> - **Copy de errores**: usar `getErrorCopy('CHAT', err)`, nunca `ApiError.message` crudo.
> - **`:hover`** gateado tras `@media (hover: hover)`; sin `mat-flat-button`/`color="primary"`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias incompletas).
- **[Story]**: a qué user story pertenece (US1, US2, US3).

## Path Conventions

Single project Angular: raíz `src/app/`, tests de contrato en `src/tests/contract/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: estructura de la feature.

- [X] T001 Crear la estructura de carpetas de la feature: `src/app/features/chat/services/` y
  `src/app/features/chat/components/chat-panel/` (carpetas vacías; los archivos se crean en fases
  posteriores).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tipos, contrato, capa REST y copy de error. **Bloquea todas las user stories.**

**⚠️ CRITICAL**: ninguna user story puede empezar hasta completar esta fase.

DONE [P] Crear los DTOs del chat en `src/app/core/models/chat.models.ts`: `ChatParentType`,
  `SendState`, `ChatMessage`, `ChatView`, `SendMessageRequest`, `SendMessageResponse` — campo a campo
  según [data-model.md](data-model.md) §2 y `docs/CONTRATOS_API.md §7`.
DONE Agregar `ChatWsEvent` (unión `CHAT_CREATED` | `MESSAGE_SENT`) a
  `src/app/core/models/ws.models.ts` y sumarlo a la unión `WsEvent`, según [data-model.md](data-model.md)
  §3 y `docs/CONTRATOS_API.md §9.6`. (Mismo archivo que `WsEvent`, por eso no es [P] con T002.)
DONE [P] Contract test en `src/tests/contract/chat.contract.spec.ts`: paridad de `ChatView`,
  `ChatMessage`, `SendState`, `SendMessageResponse` y de los payloads de `ChatWsEvent`
  (`CHAT_CREATED = { parentType, parentId }`, `MESSAGE_SENT = { sender, content, sentAt }` sin
  `messageId`), según [contracts/chat-api.md](contracts/chat-api.md) §4. Debe fallar hasta que
  T002/T003 estén correctos.
DONE [P] Agregar el scope `'CHAT'` a `ErrorCopyScope` y su rama en `getErrorCopy()` en
  `src/app/shared/error-copy/error-copy.ts` (mapeo de [data-model.md](data-model.md) §8: 401→'',
  404, 422 rate-limit vs genérico, 0/5xx, fallback). NO exponer `ApiError.message`.
DONE [P] Casos de `'CHAT'` en `src/app/shared/error-copy/error-copy.spec.ts`.
DONE Implementar `ChatApiService` en `src/app/features/chat/services/chat-api.service.ts`:
  `getByParentMatch(matchId): Observable<ChatView>` (`GET /api/chats/by-parent/MATCH/{matchId}`) y
  `sendToParentMatch(matchId, content): Observable<SendMessageResponse>`
  (`POST /api/chats/by-parent/MATCH/{matchId}/messages`). `parentType` literal `MATCH`,
  `encodeURIComponent(matchId)`. Espejo de `SocialApiService`.
DONE [P] Test de `ChatApiService` en
  `src/app/features/chat/services/chat-api.service.spec.ts` (URLs, método, body `{ content }`).

**Checkpoint**: tipos + contrato + REST + copy listos. Las user stories pueden empezar.

---

## Phase 3: User Story 1 - Leer la conversación de la partida (Priority: P1) 🎯 MVP

**Goal**: ver el historial (hasta 50) de la partida en un panel lateral derecho abrible desde el
hamburguesa, con autor y orden; cerrar/reabrir sin perder la conversación.

**Independent Test**: en una partida online con mensajes previos (chat ya existente), abrir "Chat"
desde el hamburguesa y verificar la lista con autor y orden correctos; cerrar y reabrir conserva la
conversación; sin mensajes → estado vacío.

### Implementation for User Story 1

DONE [US1] Crear `ChatStore` (`signalStore({ providedIn: 'root' })`) en
  `src/app/features/chat/services/chat.store.ts` con el estado de [data-model.md](data-model.md) §4
  (`matchId, chatId, messages, sendState, panelOpen, loading, error, sendError`), `INITIAL`, y los
  computed `available` y `canSend`. En esta fase: `enterMatch(matchId)` (set matchId + bootstrap GET),
  `leave()` (reset), `togglePanel()`/`closePanel()`, y el bootstrap vía
  `ChatApiService.getByParentMatch` que setea `chatId/messages/sendState` en 200 y trata el 404 como
  "sin chat" en silencio (log, sin error visible). Append con orden por `sentAt` y tope de 50.
DONE [P] [US1] Crear el componente `ChatPanelComponent` (standalone) en
  `src/app/features/chat/components/chat-panel/chat-panel.component.ts` + `.html`: drawer lateral
  derecho con cabecera (título + botón cerrar), lista de `messages()` (autor + hora) y estado vacío.
  Inyecta `ChatStore` y `AuthStore` (para distinguir mensajes propios visualmente). Sin composer aún.
DONE [P] [US1] Estilos del panel en
  `src/app/features/chat/components/chat-panel/chat-panel.component.scss`: drawer derecho, solo
  `var(--t3-…)`, responsive (ancho completo en mobile ≥360px, lateral en desktop ≥1024px). `:hover`
  (si aplica) dentro de `@media (hover: hover)`.
DONE [US1] Integrar el acceso en el menú hamburguesa: en
  `src/app/shared/components/global-header/global-header.component.ts` inyectar `ChatStore` y exponer
  `showChat = computed(() => chatStore.available())`; agregar `openChat()` (cierra menú + abre panel).
  En `...global-header.component.html` agregar el ítem "Chat" (`@if (showChat())`) dentro del
  `nav.global-header__menu-panel`.
DONE [US1] Montar el panel y el ciclo de vida del store en la pantalla de partida:
  en `src/app/features/match/pages/match-screen/match-screen.component.ts` llamar
  `chatStore.enterMatch(matchId)` cuando se resuelve el `matchId` (y al navegar a revancha) y
  `chatStore.leave()` en `ngOnDestroy`; en `...match-screen.component.html` renderizar
  `<app-chat-panel>` cuando `chatStore.panelOpen()`.
DONE [P] [US1] Tests del `ChatStore` para US1 en
  `src/app/features/chat/services/chat.store.spec.ts`: bootstrap 200 puebla messages/chatId/sendState;
  404 deja `available=false` sin error; `togglePanel`/`leave` resetea.

**Checkpoint**: se puede leer el historial y abrir/cerrar el panel de forma independiente.

---

## Phase 4: User Story 2 - Recibir mensajes en vivo (Priority: P1)

**Goal**: el chat se disponibiliza por `CHAT_CREATED` y los `MESSAGE_SENT` aparecen en tiempo real
(panel abierto o cerrado), con reconciliación en reconexión.

**Independent Test**: con dos sesiones en la misma partida, un mensaje enviado por una aparece en la
otra en segundos sin recargar; con el panel cerrado, al abrirlo el mensaje ya está.

### Implementation for User Story 2

DONE [US2] Suscripción WS en `ChatStore` (`src/app/features/chat/services/chat.store.ts`):
  en `enterMatch` suscribir `WebSocketService.subscribe<ChatWsEvent>('/user/queue/chat')` (idempotente)
  y `ws.connect()`; `leave()` desuscribe. `applyEvent`: `CHAT_CREATED` con `payload.parentId ===
  matchId` setea `chatId` (disponibiliza); `MESSAGE_SENT` del `chatId` actual hace append con dedup
  por `sentAt` (descartar `sentAt ≤` último conocido). Sin echo optimista.
DONE [US2] Re-bootstrap en reconexión: suscribir `ws.connected` y, al volver a `true` estando
  en un match, re-ejecutar el GET de bootstrap y reconciliar por `sentAt` (§11.1), en el mismo
  `chat.store.ts`.
DONE [P] [US2] Tests del `ChatStore` para US2 en `chat.store.spec.ts`: `CHAT_CREATED` del match
  actual disponibiliza (`available()` true) y de otro match se ignora; `MESSAGE_SENT` appendea y
  deduplica por `sentAt`; reconexión re-bootstrapea.

**Checkpoint**: US1 + US2 funcionan; el botón aparece al llegar `CHAT_CREATED` y los mensajes
llegan en vivo.

---

## Phase 5: User Story 3 - Enviar mensajes con cooldown (Priority: P2)

**Goal**: redactar y enviar mensajes con validación (no vacío, ≤500) y cooldown derivado de
`sendState`, que sobrevive a un refresh; reconciliar cooldown ante rate limit.

**Independent Test**: enviar un mensaje deja el botón en cooldown hasta el instante del servidor;
recargar durante el cooldown lo mantiene bloqueado el tiempo restante; >500 o vacío no se puede
enviar.

### Implementation for User Story 3

DONE [US3] Acción de envío en `ChatStore` (`src/app/features/chat/services/chat.store.ts`):
  `send(content)` valida (trim no vacío, ≤500), llama `ChatApiService.sendToParentMatch`, aplica el
  `sendState` del response (arranca cooldown) **sin** append optimista; en `422` rate-limit
  (`ChatRateLimitExceededException`) reconcilia llamando al GET de bootstrap; otros errores →
  `sendError = getErrorCopy('CHAT', err)`.
DONE [US3] Cooldown reactivo en `ChatStore`: timer que recalcula `canSend` a partir de
  `sendState.nextMessageAllowedAt - Date.now()` y libera el botón al llegar a 0; basado en el epoch
  absoluto del servidor (sobrevive refresh porque el bootstrap trae `sendState`).
DONE [US3] Composer en `ChatPanelComponent`
  (`src/app/features/chat/components/chat-panel/chat-panel.component.ts` + `.html`): textarea
  (maxlength 500 + contador), botón enviar deshabilitado mientras `!canSend()` o contenido inválido,
  mostrar tiempo restante de cooldown y `sendError()`. Botón temático del producto (no
  `mat-flat-button`).
DONE [P] [US3] Estilos del composer en `chat-panel.component.scss` (solo `var(--t3-…)`;
  `:active`/`:focus-visible` permitidos; `:hover` gateado). Input con `font-size ≥ 16px` en mobile.
DONE [P] [US3] Tests del `ChatStore` para US3 en `chat.store.spec.ts`: `send` aplica sendState
  y no hace echo; validaciones bloquean envío; `422` rate-limit reconcilia vía GET; cooldown libera
  al vencer `nextMessageAllowedAt`.

**Checkpoint**: las tres user stories funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: pulido responsive, accesibilidad y gates.

DONE [P] Revisar accesibilidad del panel: `aria-label`/roles del drawer y del botón "Chat",
  foco al abrir, cierre con `Escape` (consistente con el patrón del menú en `global-header`).
DONE [P] Verificar responsive en 360px y ≥1024px del panel (no tapar acciones críticas del
  tablero en mobile); ajustar `chat-panel.component.scss` si hace falta.
DONE Correr los gates: `pnpm lint`, `pnpm lint:styles`, `pnpm lint:hover`, `pnpm lint:themes`,
  `pnpm test`, `pnpm build`. Resolver hallazgos.
DONE Validar el flujo de [quickstart.md](quickstart.md) de punta a punta (online, bot, refresh,
  rate limit, 500 chars, fin de partida).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **Bloquea** todas las user stories.
- **User Stories (Phase 3–5)**: dependen de Foundational.
  - US2 y US3 amplían el mismo `chat.store.ts` que US1 → en la práctica se implementan en orden
    (US1 → US2 → US3) por compartir archivo, aunque cada una es testeable de forma independiente.
- **Polish (Phase 6)**: depende de las user stories deseadas.

### Within Each User Story

- Store/servicio antes que el componente que lo consume.
- US1: `ChatStore` (T009) antes del panel (T010) y de la integración (T012/T013).
- US3: acción+cooldown del store (T018/T019) antes del composer (T020).

### Parallel Opportunities

- Foundational: T002, T004, T005, T006 en paralelo; T007 tras T002; T008 [P] tras T007; T003 tras
  T002 (mismo archivo `ws.models.ts`, distinto de `chat.models.ts`).
- US1: T010 y T011 en paralelo tras T009; T014 [P] junto a la implementación.
- Tests [P] (T004, T006, T008, T014, T017, T022) corren en paralelo con su implementación asociada.

---

## Parallel Example: Foundational

```bash
# Tras crear la estructura (T001), lanzar en paralelo:
Task: "Crear DTOs en src/app/core/models/chat.models.ts"            # T002
Task: "Contract test en src/tests/contract/chat.contract.spec.ts"   # T004
Task: "Scope CHAT en src/app/shared/error-copy/error-copy.ts"       # T005
Task: "Casos CHAT en error-copy.spec.ts"                            # T006
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Dado que US1 y US2 son ambas **P1** y juntas constituyen "un chat real" (leer + recibir en vivo):
1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1) → validar lectura + panel.
3. Phase 4 (US2) → validar disponibilización por `CHAT_CREATED` + mensajes en vivo.
4. **STOP & VALIDATE**: MVP demostrable (leer + recibir).

### Incremental Delivery

5. Phase 5 (US3) → enviar con cooldown. Demo/deploy.
6. Phase 6 (Polish) → accesibilidad, responsive y gates.

---

## Notes

- [P] = archivos distintos, sin dependencias incompletas.
- US2/US3 tocan el mismo `chat.store.ts` que US1 → coordinar para evitar conflictos de archivo.
- Sin echo optimista de mensajes (evita duplicar el propio `MESSAGE_SENT`).
- `404` del bootstrap = "sin chat" (bot / no creado), silencioso.
- Commit por tarea o grupo lógico. Validar cada checkpoint antes de avanzar.
