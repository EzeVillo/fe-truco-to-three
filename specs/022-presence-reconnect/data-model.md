# Data Model: Presencia y reconexion de usuario

## UserPresenceResponse

Foto completa de ocupacion del usuario autenticado.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `busy` | `boolean` | `true` si al menos uno de `match`, `league`, `cup` o `rematch` no es `null`. |
| `match` | `PresenceMatch \| null` | Partida no finalizada del usuario. Prioridad maxima para navegacion. |
| `league` | `PresenceTournament \| null` | Fuera de alcance para navegacion en v1; se tipa para paridad de contrato. |
| `cup` | `PresenceTournament \| null` | Fuera de alcance para navegacion en v1; se tipa para paridad de contrato. |
| `rematch` | `PresenceRematch \| null` | Sesion de revancha abierta. Se usa si no hay `match`. |

### Validaciones

- Todas las claves deben existir, aunque su valor sea `null`.
- `busy: false` implica `match`, `league`, `cup` y `rematch` en `null`.
- `busy: true` implica al menos un dominio no nulo.
- La navegacion de v1 solo considera `match` y `rematch`; ignora `league` y `cup`.

## PresenceMatch

Partida no finalizada que ocupa al usuario.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `string` | UUID del match. |
| `status` | `WAITING_FOR_PLAYERS \| READY \| IN_PROGRESS` | Nunca `FINISHED` ni `CANCELLED`. |

## PresenceTournament

Torneo que ocupa al usuario, incluido en el DTO por contrato aunque v1 no navegue a torneos.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `string` | UUID de liga o copa. |
| `status` | `WAITING_FOR_PLAYERS \| READY \| IN_PROGRESS` | Estado reconectable del torneo segun contrato. |
| `currentMatchId` | `string \| null` | Solo no nulo cuando el torneo esta en progreso. En v1 se ignora. |

## PresenceRematch

Sesion de revancha abierta que ocupa al usuario.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `string` | UUID de la sesion de revancha. |
| `originMatchId` | `string` | UUID del match de origen desde donde se resuelve la revancha. |

## PresenceWsEvent

Evento push que sincroniza todas las sesiones del usuario.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `eventType` | `PRESENCE_UPDATED` | Unico event type de esta cola para v1. |
| `timestamp` | `number` | epoch millis emitido por backend. |
| `payload` | `UserPresenceResponse` | Mismo shape que el endpoint de presencia. |

## PresenceDestination

Destino derivado internamente por el frontend.

| Variante | Campos | Regla |
|----------|--------|-------|
| `match` | `matchId` | Se usa cuando `presence.match` existe. |
| `rematch` | `originMatchId` | Se usa cuando no hay match y `presence.rematch` existe. |
| `none` | ninguno | Se usa cuando no hay ocupacion navegable en v1. |

## Transiciones de estado

```text
Libre -> Match ocupado -> Libre
Libre -> Revancha abierta -> Libre
Libre -> Revancha abierta -> Match ocupado
```

Reglas:

- `Match ocupado` siempre gana sobre `Revancha abierta`.
- `Libre` no causa navegacion.
- Torneos pueden aparecer en la foto de presencia, pero no cambian el destino en esta feature.
