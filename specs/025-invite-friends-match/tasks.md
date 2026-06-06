---
description: "Task list — Invitar a partida a los amigos"
---

# Tasks: Invitar a partida a los amigos

**Input**: Design documents from `/specs/025-invite-friends-match/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/social-invitations.md

**Tests**: Se incluye el **contract test** (obligatorio por constitución) y los `.spec.ts`
co-locados que exige la convención del repo (cada componente/servicio/store tiene su spec).

**Organization**: Tareas agrupadas por user story para implementación/test independiente.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles`.
> - **Contrato**: verificar campos contra `docs/CONTRATOS_API.md` antes de tipar DTOs.
> - **CTAs tematizados**: usar `t3-btn`, nunca `mat-flat-button` / `color="primary"`.
> - **Copy de errores**: `getErrorCopy()` + `busyReasonCopy()`, nunca `ApiError.message`.
> - **`:hover`**: gateado tras `@media (hover: hover)`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1 (sala de espera), US1b (página de amigos), US2 (recibir/aceptar), US3 (enviadas)

## Path Conventions

App Angular única: código en `src/app/...`, contract tests en `src/tests/contract/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar contexto y fuentes autoritativas antes de tipar.

- [X] T001 Releer las secciones del contrato relevantes en `docs/CONTRATOS_API.md` (§7.4.5,
  §7.4.7–7.4.13, §8.1–8.2, §9.5e/§9.6) y confirmar que la rama activa es
  `025-invite-friends-match`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelos, capa REST, copy y store compartidos por TODAS las user stories.

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

- [X] T002 [P] Extender modelos sociales en `src/app/core/models/social.models.ts`: enums
  `FriendAvailability`, `FriendBusyReason`, `ResourceInvitationTargetType`,
  `ResourceInvitationStatus`; extender `FriendSummary` con `online`/`availability`/`busyReason`
  (ignorar `spectatableMatch`); agregar `CreateResourceInvitationPayload`,
  `CreateResourceInvitationResponse`, `IncomingResourceInvitation`,
  `OutgoingResourceInvitation` (ver data-model.md §1–§3).
- [X] T003 [P] Extender `SocialWsEvent` en `src/app/core/models/ws.models.ts` con los 7
  eventos nuevos (`RESOURCE_INVITATION_RECEIVED|ACCEPTED|DECLINED|CANCELLED|EXPIRED`,
  `FRIEND_AVAILABILITY_STATE`, `FRIEND_AVAILABILITY_CHANGED`) y los tipos
  `FriendAvailabilitySnapshotItem` / `FriendAvailabilityDelta` (ver data-model.md §4).
- [X] T004 Escribir el contract test en
  `src/tests/contract/social-invitations.contract.spec.ts`: paridad de enums, DTOs y payloads
  de eventos contra `docs/CONTRATOS_API.md` vía `satisfies` (depende de T002, T003).
- [X] T005 [P] Agregar `busyReasonCopy(reason)` (mapa español) y los casos de error de
  invitación al catálogo en `src/app/shared/error-copy/error-copy.ts` (reusar scope `SOCIAL`);
  actualizar `src/app/shared/error-copy/error-copy.spec.ts` (ver data-model.md §7).
- [X] T006 [P] Agregar a `src/app/features/social/services/social-api.service.ts` los métodos
  `createInvitation`, `acceptInvitation`, `declineInvitation`, `cancelInvitation`,
  `listIncomingInvitations`, `listOutgoingInvitations`; actualizar
  `social-api.service.spec.ts` (paths en contracts/social-invitations.md §1) (depende de T002).
- [X] T007 Extender el estado y la reconciliación en
  `src/app/features/social/services/social.store.ts`: campos `outgoingInvitations`,
  `incomingInvitationToast`, `inviteActionError`; sumar `listOutgoingInvitations` +
  `listIncomingInvitations` al `forkJoin` de `bootstrap`; manejar los 7 eventos nuevos en
  `applyEvent` (merge de disponibilidad idempotente + upsert/remove de invitaciones, sólo
  `targetType === 'MATCH'`); métodos `inviteFriend`, `acceptInvitation`, `declineInvitation`,
  `cancelInvitation`, `dismissInvitationToast`; computed `canInvite(friend)` (ver data-model
  §5–§6) (depende de T002, T003, T006).
- [X] T008 Actualizar `src/app/features/social/services/social.store.spec.ts` cubriendo
  reconciliación de disponibilidad (snapshot+delta), upsert/remove de invitaciones, toast
  recibido y re-surface en reconexión, e idempotencia/orden (depende de T007).

**Checkpoint**: Modelos, REST, copy y store listos — las user stories pueden empezar.

---

## Phase 3: User Story 1 - Invitar desde la sala de espera (Priority: P1) 🎯 MVP

**Goal**: Estando en la sala de espera de una partida propia (`WAITING_FOR_PLAYERS`), elegir
un amigo disponible y enviarle la invitación.

**Independent Test**: Crear partida privada → en la sala de espera abrir "Invitar amigo" →
elegir un amigo `AVAILABLE` → la invitación se envía y queda como pendiente; un `BUSY` aparece
con la acción deshabilitada y su motivo.

- [X] T009 [P] [US1] Crear el componente reutilizable de selección en
  `src/app/features/social/components/invite-friend-picker/` (`.ts/.html/.scss`): lista TODOS
  los amigos del store; por amigo, acción "Invitar a partida" (`t3-btn`) habilitada sólo si
  `canInvite`; si `BUSY`, acción deshabilitada + chip de `busyReasonCopy`; estado vacío si no
  hay amigos. Input `targetId`; emite `invite(friendUsername)`. SCSS sólo con `var(--t3-…)` y
  `:hover` gateado.
- [X] T010 [US1] Spec del picker en
  `src/app/features/social/components/invite-friend-picker/invite-friend-picker.component.spec.ts`
  (habilitación por disponibilidad, chip de motivo, emisión de `invite`, estado vacío).
- [X] T011 [US1] Agregar la entrada "Invitar amigo" en
  `src/app/features/match/components/waiting-room/waiting-room.component.{ts,html,scss}`: botón
  que abre el picker con `targetId = matchId` actual y llama `store.inviteFriend(...)`;
  feedback de `inviteActionError` con copy del front.
- [X] T012 [US1] Actualizar
  `src/app/features/match/components/waiting-room/waiting-room.component.spec.ts` (apertura del
  picker, envío, manejo de error).

**Checkpoint**: US1 funcional — se puede invitar desde la sala de espera (MVP).

---

## Phase 4: User Story 1b - Invitar desde la página de amigos (Priority: P1)

**Goal**: Desde la página de amigos, "Invitar a partida" por amigo; si no hay partida propia
joinable, llevar a crear partida; con partida en espera, enviar la invitación.

**Independent Test**: En la página de amigos sin partida → "Invitar a partida" navega a
`/lobby/online`. Con una partida propia en `WAITING_FOR_PLAYERS` → invita a ese amigo.

- [X] T013 [US1b] Agregar el indicador `online` y la acción "Invitar a partida"
  por amigo en
  `src/app/features/social/components/friend-row/friend-row.component.{ts,html,scss}`
  (deshabilitar la acción si está offline mostrando "Desconectado" o si está `BUSY` con el
  motivo; no atenuar la fila completa).
- [X] T014 [US1b] En `src/app/features/social/pages/friends-page/friends-page.component.ts`
  inyectar `PresenceCoordinatorService`; al "Invitar a partida": si
  `presence().match?.status === 'WAITING_FOR_PLAYERS'` → `store.inviteFriend(username, match.id)`;
  si no → `router.navigateByUrl('/lobby/online')` (crear partida). Reflejar `inviteActionError`.
- [X] T015 [US1b] Actualizar
  `src/app/features/social/components/friend-row/friend-row.component.spec.ts` y
  `src/app/features/social/pages/friends-page/friends-page.component.spec.ts` (gating por
  presencia, navegación a crear, envío directo).

**Checkpoint**: US1 y US1b funcionan de forma independiente.

---

## Phase 5: User Story 2 - Recibir y aceptar una invitación (Priority: P1)

**Goal**: Recibir la invitación como toast en vivo y poder aceptar (unirse + ir al juego) o
rechazar.

**Independent Test**: Con un segundo usuario amigo, recibir el toast en ≤2s; aceptar → entra a
`/match/:id`; rechazar → toast se descarta y el remitente se entera.

- [X] T016 [US2] Crear el componente de toast en
  `src/app/features/social/components/invitation-toast/` (`.ts/.html/.scss`): se muestra cuando
  `store.incomingInvitationToast()` no es null; nombre del remitente + acciones aceptar/rechazar
  (`t3-btn`). SCSS sólo `var(--t3-…)`, `:hover` gateado.
- [X] T017 [US2] Montar el host del toast a nivel app en `src/app/app.html` (y arrancar
  `SocialStore.start()` si no está ya iniciado en `src/app/app.ts`) para que el toast aparezca
  en cualquier pantalla.
- [X] T018 [US2] Cablear acciones en el toast vía store: `acceptInvitation(id, targetId)`
  (dejar que `PresenceCoordinatorService` navegue por `PRESENCE_UPDATED`; fallback: navegar a
  `/match/:targetId` tras el 204) y `declineInvitation(id)`; limpiar toast en ambos casos y al
  recibir `RESOURCE_INVITATION_CANCELLED/EXPIRED` que matchee.
- [X] T019 [US2] Spec del toast en
  `src/app/features/social/components/invitation-toast/invitation-toast.component.spec.ts`
  (render condicional, aceptar/rechazar, limpieza por cancelación/expiración, re-surface en
  reconexión).

**Checkpoint**: Flujo extremo a extremo (invitar → recibir → aceptar/rechazar) operativo.

---

## Phase 6: User Story 3 - Gestionar invitaciones enviadas (Priority: P2)

**Goal**: Ver las invitaciones enviadas pendientes y cancelarlas desde la sala de espera.

**Independent Test**: Con una invitación enviada pendiente, verla listada; cancelarla →
desaparece y el destinatario ya no puede aceptarla.

- [X] T020 [US3] Mostrar `store.outgoingInvitations()` (pendientes) con acción cancelar
  (`store.cancelInvitation(id)`, optimista con rollback) en
  `src/app/features/match/components/waiting-room/waiting-room.component.{ts,html,scss}`.
- [X] T021 [US3] Actualizar
  `src/app/features/match/components/waiting-room/waiting-room.component.spec.ts` (listado de
  enviadas, cancelar, reconciliación al aceptar/rechazar/expirar).

**Checkpoint**: Todas las user stories funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de calidad y verificación.

- [X] T022 [P] Verificar accesibilidad/responsive del picker y el toast en mobile (360–599px)
  y desktop (1024px+); ajustar SCSS con tokens si hace falta.
- [X] T023 Correr los gates: `pnpm lint`, `pnpm lint:styles`, `pnpm lint:themes`,
  `pnpm lint:hover`, `pnpm test`, `pnpm build` y resolver hallazgos.
- [X] T024 Ejecutar la verificación manual de `specs/025-invite-friends-match/quickstart.md`
  (SC-001, SC-002, SC-006, US1/US1b/US2/US3 y edge cases).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **BLOQUEA** todas las user stories.
- **User Stories (Phase 3–6)**: dependen de Foundational. US1 es el MVP.
- **Polish (Phase 7)**: depende de las stories deseadas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Crea el picker reutilizable.
- **US1b (P1)**: tras Foundational; **reutiliza el picker/flow de envío de US1** (T009). Si se
  hace US1b sin US1, incluir antes el picker (T009/T010).
- **US2 (P1)**: tras Foundational; independiente de US1/US1b.
- **US3 (P2)**: tras Foundational; comparte el archivo `waiting-room` con US1 (T011/T020 en el
  mismo componente → ejecutar en serie, no en paralelo).

### Within Each User Story

- Modelos/REST/store (Foundational) antes que UI.
- Componente antes que su cableado en páginas/host.
- Specs junto con su unidad.

### Parallel Opportunities

- Foundational: T002, T003 en paralelo; luego T004; T005 y T006 en paralelo; T007 tras T006;
  T008 tras T007.
- US1: T009 [P] (archivo nuevo) puede arrancar apenas termina Foundational.
- US2: T016 [P] (archivo nuevo) en paralelo con US1/US1b.
- **Conflicto de archivo**: T011 (US1) y T020 (US3) tocan `waiting-room` → no paralelizar.

---

## Parallel Example: Foundational

```bash
# En paralelo (archivos distintos):
Task: "T002 Extender social.models.ts"
Task: "T003 Extender ws.models.ts"
# Luego:
Task: "T004 Contract test social-invitations.contract.spec.ts"
# En paralelo:
Task: "T005 busyReasonCopy + errores en error-copy.ts"
Task: "T006 Métodos REST en social-api.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational, crítico) → 3. Phase 3 (US1) →
4. **STOP y VALIDAR**: invitar desde la sala de espera funciona de punta a punta con un
   segundo usuario → 5. Demo.

### Incremental Delivery

Foundation → US1 (MVP) → US1b (segunda entrada) → US2 (recibir/aceptar) → US3 (gestionar
enviadas). Cada story agrega valor sin romper las anteriores.

---

## Notes

- Una sola suscripción a `/user/queue/social`: extender `SocialStore.applyEvent`, no crear
  otra suscripción.
- `expiresAt` en epochMillis; el gate de invitar es `online && availability === 'AVAILABLE'`;
  sólo `targetType: 'MATCH'`.
- Spectate (`spectatableMatch`, `/user/queue/match-spectate`) fuera de alcance.
- Commit por tarea o grupo lógico; detenerse en cada checkpoint para validar la story.
