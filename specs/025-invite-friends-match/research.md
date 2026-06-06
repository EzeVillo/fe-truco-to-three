# Research: Invitar a partida a los amigos

**Feature**: 025-invite-friends-match
**Fecha**: 2026-06-06

No quedaron marcadores `NEEDS CLARIFICATION` en la Technical Context. Las decisiones abiertas
se resolvieron en las sesiones de `/speckit-clarify` y se consolidan acá con su fundamento.

## D1 — Reutilizar `SocialStore` en vez de crear un store nuevo

- **Decisión**: Extender `src/app/features/social/services/social.store.ts` para manejar
  disponibilidad de amigos, invitaciones enviadas y el toast de invitación recibida.
- **Rationale**: Los eventos `RESOURCE_INVITATION_*` y `FRIEND_AVAILABILITY_*` llegan por el
  **mismo** canal `/user/queue/social` que ya consume el store, con una sola suscripción y un
  único `applyEvent`. La disponibilidad es un atributo de cada amigo (vive en la lista de
  amigos). Duplicar la suscripción en otro store generaría doble bootstrap, doble re-bootstrap
  al reconectar y posibles condiciones de carrera de orden de eventos.
- **Alternativas consideradas**: (a) Store dedicado `MatchInviteStore` con su propia
  suscripción → rechazado por doble suscripción al mismo destino y por tener que sincronizar
  disponibilidad entre dos stores. (b) Servicio sin estado + signals sueltos → rechazado por
  perder las garantías de reconciliación idempotente ya probadas en el store social.

## D2 — Origen del `targetId` de la partida propia: presencia

- **Decisión**: Obtener la partida objetivo del remitente desde
  `PresenceCoordinatorService.presence()` (ya inyectable, `providedIn: 'root'`), usando
  `presence.match` cuando su `status === 'WAITING_FOR_PLAYERS'`.
- **Rationale**: El contrato exige que el recurso aún admita `join`. Como la partida es 1v1,
  sólo es invitable mientras espera rival (`WAITING_FOR_PLAYERS`); en `READY`/`IN_PROGRESS`
  ya está completa. La presencia ya se bootstrapea y se mantiene en vivo por WS
  (`PRESENCE_UPDATED`), así que el front conoce el `match.id` sin pedir que el usuario tipee
  su propio código.
- **Alternativas consideradas**: Pedir el `joinCode`/matchId manualmente → contradice la UX
  (FR-002b). Releer `GET /api/me/presence` en cada apertura → innecesario, el coordinador ya
  expone la señal `presence()`.

## D3 — Aceptar invitación: el backend hace el join; la navegación la maneja la presencia

- **Decisión**: Al aceptar (`POST /api/social/invitations/{id}/accept`, 204) no navegar
  manualmente; dejar que el push `PRESENCE_UPDATED` derive a `/match/:matchId` vía
  `PresenceCoordinatorService` (que ya redirige a `derivePresenceDestination`). Como fallback
  defensivo ante demora del push, navegar al `targetId` de la invitación tras el 204 si sigue
  siendo `MATCH`.
- **Rationale**: El contrato dice "el backend hace `join` directo sobre el recurso destino".
  Una vez unido, la presencia del aceptante cambia y el coordinador ya sabe llevar a la
  pantalla de juego — reutiliza un mecanismo probado (feature 022) en vez de duplicar lógica
  de navegación.
- **Alternativas consideradas**: Navegar siempre manualmente al `targetId` → duplica la
  responsabilidad del coordinador y puede competir con su navegación; se deja sólo como
  fallback idempotente (mismo destino, navegación deduplicada por `lastDestinationKey`).

## D4 — Disponibilidad: optimista en el front, autoridad en el backend

- **Decisión**: Habilitar/deshabilitar la acción de invitar combinando `online` y
  `availability` del amigo (snapshot REST + `FRIEND_AVAILABILITY_STATE` + deltas
  `FRIEND_AVAILABILITY_CHANGED`), pero tratar el envío como optimista: si el backend rechaza
  (amigo ocupado, partida no joinable, duplicada), mostrar copy del catálogo y dejar que el
  delta corrija la lista.
- **Rationale**: Invitar a un amigo offline es ruido: el destinatario no va a ver el toast en
  vivo y la invitación expira a los 10 min (default del backend). El gate combinado
  (`online === true && availability === 'AVAILABLE'`) evita ese caso y mantiene el flujo
  reactivo: cuando el amigo vuelve a `online`, el delta `FRIEND_AVAILABILITY_CHANGED`
  habilita el botón sin recargar. La reconciliación es idempotente y resistente al orden
  (igual que el resto del store social). El backend sigue siendo la autoridad ante carreras
  (D del spec).
- **Alternativas consideradas**:
  - Bloquear la UI hasta confirmar disponibilidad server-side antes de cada envío → agrega
    latencia y un round-trip extra innecesario.
  - Permitir invitar offline (gate sólo por `availability`) → habilitaba envíos que el
    destinatario rara vez ve a tiempo; descartada en la sesión de clarify.

## D5 — Invitación recibida: sólo toast, re-surface en reconexión

- **Decisión**: Surfacing exclusivamente por toast/notificación con aceptar/rechazar (sin
  lista persistente). En bootstrap/reconexión se consulta
  `GET /api/social/invitations/incoming` y, si hay una pendiente, se re-muestra como toast.
- **Rationale**: Decisión de producto (clarify Q3). El re-fetch en reconexión evita perder
  por completo una invitación pendiente sin introducir una superficie de UI nueva (lista),
  alineado con el patrón de re-bootstrap del store social.
- **Alternativas consideradas**: Lista persistente de recibidas → descartada por el usuario.
  Sólo toast efímero sin re-fetch → perdería invitaciones vigentes tras recargar.

## D6 — Invitaciones enviadas: lista en la sala de espera + cancelar (US3)

- **Decisión**: Mantener la lista de invitaciones enviadas pendientes en el store
  (bootstrap `GET /api/social/invitations/outgoing` + reconciliación por eventos) y mostrarla
  en la sala de espera del remitente, con acción cancelar
  (`POST /api/social/invitations/{id}/cancel`).
- **Rationale**: La sala de espera es donde el remitente está esperando rival y donde tiene
  sentido ver "a quién invité" y poder cancelar. Reusa el patrón optimista del store.
- **Alternativas consideradas**: Mostrar enviadas también en la página de amigos → posible a
  futuro, pero el MVP las concentra en la sala para no recargar la página de amigos.

## D7 — Entrada desde la página de amigos sin partida joinable → crear partida

- **Decisión**: Si `presence().match` no existe o no está `WAITING_FOR_PLAYERS`, la acción
  "Invitar a partida" navega a `/lobby/online` (flujo de crear partida privada existente,
  feature 015/021). La invitación se envía recién con la partida ya creada y esperando.
- **Rationale**: Clarify Q1. Evita bundlear creación de partida dentro de esta feature y
  reutiliza el flujo probado. El usuario completa la creación y luego invita desde la sala de
  espera (US1) o vuelve a intentar desde amigos con la partida ya activa.
- **Alternativas consideradas**: Crear la partida al vuelo desde el modal de amigos →
  rechazada por acoplar creación de partida a esta feature y por requerir elegir formato de
  serie en un flujo que pretende ser corto.

## D8 — `busyReason` → copy del front; spectate fuera de alcance

- **Decisión**: Mapear cada `busyReason` (`IN_MATCH`, `IN_LEAGUE`, `IN_CUP`, `OPEN_REMATCH`,
  `IN_QUICK_QUEUE`, `PENDING_INVITATION`, `PENDING_FRIEND_REQUEST`, `UNKNOWN`) a copy del
  catálogo del front; `UNKNOWN`/no catalogado → copy genérico "no disponible". Ignorar
  `spectatableMatch` y no suscribir `/user/queue/match-spectate`.
- **Rationale**: Guardarraíl de copy de errores/estados (constitución). Spectate fue excluido
  explícitamente por el usuario (FR-018).
- **Alternativas consideradas**: Mostrar el código crudo del enum → viola el guardarraíl de
  copy.

## Resumen de endpoints/eventos del contrato usados

- REST: `GET /api/social/friendships` (extendido con disponibilidad),
  `POST /api/social/invitations`, `POST /api/social/invitations/{id}/accept`,
  `…/{id}/decline`, `…/{id}/cancel`, `GET /api/social/invitations/incoming`,
  `GET /api/social/invitations/outgoing`. Reuso: `GET /api/me/presence`,
  `POST /api/matches` (crear partida).
- WS `/user/queue/social`: `RESOURCE_INVITATION_RECEIVED|ACCEPTED|DECLINED|CANCELLED|EXPIRED`,
  `FRIEND_AVAILABILITY_STATE`, `FRIEND_AVAILABILITY_CHANGED`. Reuso: `/user/queue/presence`
  (`PRESENCE_UPDATED`).
- Fuera de alcance: `spectatableMatch`, `/user/queue/match-spectate`, invitaciones a
  `LEAGUE`/`CUP`.
