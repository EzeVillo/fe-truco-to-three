# Implementation Plan: Chat en vivo para partidas online

**Branch**: `027-chat-online-match` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/027-chat-online-match/spec.md`

## Summary

Chat de texto en tiempo real para partidas online (humano vs humano), accesible desde el menú
hamburguesa y desplegado en un panel lateral derecho. El chat se **disponibiliza por el evento
`CHAT_CREATED`** (`/user/queue/chat`) cuando su `parentId` coincide con el `matchId` en curso —sin
GET especulativo, por lo que las partidas vs bot (que nunca emiten ese evento) nunca ofrecen chat.
Los mensajes llegan en vivo por `MESSAGE_SENT`; el envío usa `POST by-parent/MATCH/{matchId}/messages`
y el botón aplica un cooldown derivado de `sendState.nextMessageAllowedAt` (epoch millis), que
sobrevive a un refresh. El historial (hasta 50) se recupera con `GET by-parent` sólo en el bootstrap
de reconexión (§11.1); un `404` ahí significa "sin chat" y se trata en silencio (caso refresh en
partida vs bot, decisión de producto confirmada). Arquitectura espejo de `features/social`.

## Technical Context

**Language/Version**: TypeScript 5.x / Angular 21 (componentes standalone, sin NgModules)

**Primary Dependencies**: NgRx Signals (`signalStore`), `@stomp/stompjs` + SockJS
(`WebSocketService`), Angular Material (base), RxJS

**Storage**: N/A en cliente (estado en memoria del `ChatStore`; cooldown reconstruido desde el
servidor vía `sendState`). El BE mantiene buffer circular de 50 mensajes.

**Testing**: Vitest (unit + contract en `src/tests/contract/`)

**Target Platform**: Web (mobile desde 360px y desktop ≥1024px; un único breakpoint)

**Project Type**: Single project — frontend Angular (`src/app`)

**Performance Goals**: historial visible < 2s (SC-001); mensaje en vivo < 2s (SC-002); cooldown con
≤ 1s de error vs servidor tras refresh (SC-004)

**Constraints**: 500 caracteres/mensaje, 50 mensajes/chat, rate limit 2s (servidor); nunca exponer
`ApiError.message`; SCSS sólo con `var(--t3-…)`; `:hover` gateado; sin botones Material crudos

**Scale/Scope**: 1 panel + 1 ítem de menú + 1 feature (`features/chat`) ~ store + api service +
panel component + tipos + contract test. Sólo `parentType = MATCH`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio (truco-to-three)**:
> - [x] **Tokens CSS**: el SCSS del panel (`features/chat/**/*.scss`) usará sólo `var(--t3-…)`.
>   Verificable con `pnpm lint:styles`. (Si falta un token, se agrega primero en `src/styles.scss`.)
> - [x] **Validación de contrato**: DTOs (`ChatView`, `ChatMessage`, `SendState`,
>   `SendMessageResponse`) y `ChatWsEvent` verificados campo a campo contra `docs/CONTRATOS_API.md
>   §7/§9.6`. Test de paridad en `src/tests/contract/chat.contract.spec.ts`.
> - [x] **CTAs verticales**: el composer usa un botón de envío simple (sin título+subtítulo), no
>   aplica el patrón de CTA apilado; no se usa `mat-flat-button`.
> - [x] **Copy de errores**: nuevo scope `'CHAT'` en `getErrorCopy()`; ningún path muestra
>   `ApiError.message`. El `404` de bootstrap es silencioso (log).
> - [x] **Reglas de juego**: la feature no toca scoring ni formato de serie. Sin impacto.

**Adicionales del repo** (guardarraíles AGENTS.md):
- [x] `:hover` que cambie apariencia va dentro de `@media (hover: hover)` (`pnpm lint:hover`).
- [x] Sin `mat-flat/raised-button` ni `color="primary|accent|warn"` (`pnpm lint:themes`).

**Resultado**: PASS. Sin violaciones → sección Complexity Tracking no aplica.

## Project Structure

### Documentation (this feature)

```text
specs/027-chat-online-match/
├── plan.md              # Este archivo
├── spec.md              # Especificación funcional
├── research.md          # Decisiones D1–D5
├── data-model.md        # DTOs, estado del store, transiciones
├── quickstart.md        # Verificación E2E + gates
├── contracts/
│   └── chat-api.md      # Subconjunto de contrato consumido + test de paridad
└── checklists/
    └── requirements.md  # Checklist de calidad del spec
```

### Source Code (repository root)

```text
src/app/
├── core/
│   └── models/
│       ├── chat.models.ts          # NUEVO: ChatParentType, SendState, ChatMessage,
│       │                           #        ChatView, SendMessageRequest, SendMessageResponse
│       └── ws.models.ts            # EDIT: agregar ChatWsEvent + sumarlo a WsEvent
├── features/
│   └── chat/                       # NUEVA feature (espejo de features/social)
│       ├── services/
│       │   ├── chat-api.service.ts        # GET/POST by-parent
│       │   ├── chat-api.service.spec.ts
│       │   ├── chat.store.ts              # signalStore: WS + gating + cooldown + panel
│       │   └── chat.store.spec.ts
│       └── components/
│           └── chat-panel/
│               ├── chat-panel.component.ts      # drawer derecho: lista + composer
│               ├── chat-panel.component.html
│               ├── chat-panel.component.scss    # sólo var(--t3-…)
│               └── chat-panel.component.spec.ts
├── shared/
│   ├── components/global-header/
│   │   ├── global-header.component.html   # EDIT: ítem "Chat" (gateado por available())
│   │   └── global-header.component.ts     # EDIT: inyectar ChatStore; toggle panel
│   └── error-copy/
│       ├── error-copy.ts                  # EDIT: scope 'CHAT'
│       └── error-copy.spec.ts             # EDIT: casos 'CHAT'
└── features/match/pages/match-screen/
    ├── match-screen.component.ts          # EDIT: enterMatch(matchId)/leave() + montar panel
    └── match-screen.component.html        # EDIT: render <app-chat-panel> si panelOpen()

src/tests/contract/
└── chat.contract.spec.ts            # NUEVO: paridad de tipos vs contrato §7/§9.6
```

**Structure Decision**: single project Angular. La feature se aísla en `src/app/features/chat/`
siguiendo el patrón de `features/social` (store `providedIn: 'root'`, api service REST, componentes
standalone). Los tipos de dominio van a `core/models/` (consistente con `social.models.ts` /
`ws.models.ts`). La integración UI toca `global-header` (acceso), `match-screen` (montaje del panel
y ciclo de vida del store) y `error-copy` (copy controlado).

## Enfoque de implementación por User Story

### US1 — Leer la conversación (P1)
- `ChatStore.enterMatch(matchId)`: setea `matchId`, suscribe `/user/queue/chat`, dispara bootstrap.
- `chat-panel` renderiza `messages()` con autor + hora; estado vacío cuando no hay mensajes.
- Panel = drawer lateral derecho; abrir/cerrar via `panelOpen` sin perder el estado del store.

### US2 — Recibir en vivo (P1)
- Suscripción a `/user/queue/chat`; `CHAT_CREATED` (parentId==matchId) → `chatId` + `available`.
- `MESSAGE_SENT` (chatId actual) → append con dedup por `sentAt`. Funciona con panel abierto/cerrado.
- Re-bootstrap al reconectar (`ws.connected`), reconciliando por `sentAt` (§11.1).

### US3 — Enviar con cooldown (P2)
- Composer con validación (no vacío, ≤ 500). `ChatApiService.sendMessage(matchId, content)`.
- Sin echo optimista: el mensaje aparece por `MESSAGE_SENT`.
- Cooldown derivado de `sendState.nextMessageAllowedAt`; timer reevalúa `canSend`; sobrevive refresh
  porque el bootstrap trae `sendState`.
- `422` rate limit → reconciliar `sendState` con `GET by-parent`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| `MESSAGE_SENT` sin `messageId` complica dedup | Dedup por `sentAt` (epoch); patrón §11.1 |
| Refresh en partida vs bot genera `404` | Tratado como "sin chat" silencioso (decisión de producto) |
| Doble suscripción al re-entrar al match | `enterMatch` idempotente; `leave()` desuscribe (patrón social) |
| Cooldown desfasado por reloj del cliente | Usar epoch absoluto del servidor, no deltas locales |
| Panel tapando el tablero en mobile | Drawer responsive; cubrir ancho en mobile, lateral en desktop |

## Phase 2 (NO ejecutada aquí)
`/speckit-tasks` generará `tasks.md` con el desglose dependency-ordered (tipos → api service →
store → panel → integración header/match-screen → contract test → gates).
