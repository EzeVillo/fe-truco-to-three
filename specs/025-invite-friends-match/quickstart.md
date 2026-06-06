# Quickstart: Invitar a partida a los amigos

**Feature**: 025-invite-friends-match

Guía rápida para implementar y verificar la feature. Asume el stack del repo (Angular 21,
NgRx Signals, STOMP) y los guardarraíles de `AGENTS.md` / constitución.

## Orden de implementación sugerido

1. **Modelos y contrato** (`core/models`)
   - Extender `FriendSummary` con `online` / `availability` / `busyReason` y agregar los enums
     (`FriendAvailability`, `FriendBusyReason`, `ResourceInvitationStatus`,
     `ResourceInvitationTargetType`) en `social.models.ts`.
   - Agregar DTOs de invitación (`CreateResourceInvitationPayload`/`Response`,
     `IncomingResourceInvitation`, `OutgoingResourceInvitation`).
   - Extender `SocialWsEvent` en `ws.models.ts` con los 7 eventos nuevos.
   - Escribir `src/tests/contract/social-invitations.contract.spec.ts`.

2. **Capa REST** (`features/social/services/social-api.service.ts`)
   - Agregar `createInvitation`, `acceptInvitation`, `declineInvitation`, `cancelInvitation`,
     `listIncomingInvitations`, `listOutgoingInvitations`.

3. **Catálogo de copy** (`shared/error-copy/error-copy.ts`)
   - Agregar `busyReasonCopy(reason)` (mapa español). Reusar scope `'SOCIAL'` para errores de
     acción.

4. **Store** (`features/social/services/social.store.ts`)
   - Estado nuevo: `outgoingInvitations`, `incomingInvitationToast`, `inviteActionError`.
   - Bootstrap: sumar `listFriends` (ya trae disponibilidad), `listOutgoingInvitations`,
     `listIncomingInvitations` al `forkJoin`.
   - `applyEvent`: manejar los 7 eventos nuevos (ver data-model §6). Mantener idempotencia.
   - Métodos: `inviteFriend(recipientUsername, targetId)`, `acceptInvitation(id, targetId)`,
     `declineInvitation(id)`, `cancelInvitation(id)`, `dismissInvitationToast()`.
   - Computed: `availableFriends` / helper `canInvite(friend)` =
     `friend.online && friend.availability === 'AVAILABLE'`.

5. **UI — selector reutilizable** (`features/social/components/invite-friend-picker`)
   - Lista de **todos** los amigos; por amigo, acción "Invitar a partida" deshabilitada si
     está offline o `BUSY` con chip de motivo ("Desconectado" si offline; `busyReasonCopy`
     si online + BUSY). Estado vacío si no hay amigos.
   - Input `targetId`; emite `invite(friendUsername)`.

6. **Entrada US1 — sala de espera** (`features/match/components/waiting-room`)
   - Botón "Invitar amigo" (`t3-btn`) que abre el picker con `targetId = matchId` actual.
   - Mostrar `outgoingInvitations` pendientes con acción cancelar.

7. **Entrada US1b — página de amigos** (`features/social/pages/friends-page` + `friend-row`)
   - Acción "Invitar a partida" por amigo. Si `presence().match?.status !== 'WAITING_FOR_PLAYERS'`
     → navegar a `/lobby/online` (crear partida). Si hay match joinable → invitar con su id.
   - Indicador `online` en `friend-row`: además de mostrar el dot, gatea (junto con
     `availability`) la acción "Invitar a partida".

8. **Toast de invitación recibida** (`features/social/components/invitation-toast`)
   - Host a nivel app (donde ya se inicia la suscripción social) que renderiza el toast cuando
     `incomingInvitationToast` no es null, con aceptar/rechazar. Al aceptar, llamar al store y
     dejar que `PresenceCoordinatorService` navegue (fallback: navegar a `targetId`).

## Verificación manual (mapa a Success Criteria)

- **SC-001 / US1**: crear partida privada → en la sala de espera, "Invitar amigo" → elegir
  amigo `AVAILABLE` + online → se envía en ≤3 toques; aparece en "enviadas".
- **US1b**: en página de amigos sin partida → "Invitar a partida" lleva a crear partida; con
  partida en espera → invita.
- **SC-002 / US2**: con un segundo usuario amigo, recibir el toast en ≤2s; aceptar → entra a
  `/match/:id` (vía presencia); rechazar → toast se descarta y el remitente lo ve.
- **SC-006 / disponibilidad**: con el picker abierto, que el amigo entre/salga de una partida
  o cambie su presencia (online ↔ offline) → su acción se deshabilita/habilita en ≤2s sin
  recargar.
- **US3**: cancelar una invitación enviada → desaparece y el destinatario no puede aceptarla.
- **Edge**: invitar a amigo offline → acción deshabilitada con "Desconectado"; invitar a
  amigo `BUSY` (online) → acción deshabilitada con motivo; aceptar invitación ya
  expirada/cancelada → copy claro, sin estado inconsistente.

## Gates antes de PR

```bash
pnpm lint          # ESLint TS/HTML
pnpm lint:styles   # SCSS sólo tokens var(--t3-…)
pnpm lint:themes   # sin mat-flat-button / color="primary"
pnpm lint:hover    # :hover gateado
pnpm test          # unit + contract (incluye social-invitations.contract.spec)
pnpm build         # compila Angular
```

## Notas / trampas

- **Una sola suscripción** a `/user/queue/social`: NO crear otra; extender el `applyEvent`
  del `SocialStore`.
- `expiresAt` llega en **epochMillis** (WS y REST de invitación).
- `online` gatea invitar junto con `availability` (el gate es
  `online && availability === 'AVAILABLE'`); si está offline se muestra "Desconectado".
- Ignorar `spectatableMatch` y no suscribir `/user/queue/match-spectate` (fuera de alcance).
- Sólo `targetType: 'MATCH'`; ignorar eventos/invitaciones de `LEAGUE`/`CUP`.
- Guests excluidos (la suscripción social ya está gateada a registrados).
