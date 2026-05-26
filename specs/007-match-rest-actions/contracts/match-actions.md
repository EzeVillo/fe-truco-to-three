# Contratos consumidos por la feature 007 — Acciones de match REST

Snapshot del contrato extraído de `docs/CONTRATOS_API.md` (fuente autoritativa). Esta página existe para que `/speckit-tasks` y los contract tests tengan una referencia inmediata sin tener que recargar el doc principal completo.

> Cualquier divergencia entre este snapshot y `docs/CONTRATOS_API.md` se resuelve a favor del doc principal. Si el backend cambia, **se actualiza primero `docs/CONTRATOS_API.md`** y luego este snapshot.

---

## §4.6 Jugar carta

**Endpoint**: `POST /api/matches/{matchId}/play-card`

**Auth**: Bearer requerido.

**Request body**:

```json
{
  "suit": "ESPADA",
  "number": 1
}
```

**Reglas**:
- `suit` debe ser uno de: `ESPADA`, `BASTO`, `COPA`, `ORO` (case-sensitive).
- `number` entero positivo (rango funcional 1..12).

**Response**: `204 No Content` — sin body.

**Errores**:
- `400` si `suit` no coincide exactamente con el enum.

---

## §4.7 Cantar truco

**Endpoint**: `POST /api/matches/{matchId}/truco`

**Auth**: Bearer requerido.

**Request body**: sin body.

**Response**: `204 No Content`.

---

## §4.8 Responder truco

**Endpoint**: `POST /api/matches/{matchId}/truco/respond`

**Auth**: Bearer requerido.

**Request body**:

```json
{ "response": "QUIERO" }
```

**Reglas**:
- `response` debe ser uno de: `QUIERO`, `NO_QUIERO`, `QUIERO_Y_ME_VOY_AL_MAZO`.

**Response**: `204 No Content`.

**Errores**:
- `400` si `response` no coincide exactamente con el enum.

---

## §4.9 Cantar envido

**Endpoint**: `POST /api/matches/{matchId}/envido`

**Auth**: Bearer requerido.

**Request body**:

```json
{ "call": "ENVIDO" }
```

**Reglas**:
- `call` debe ser uno de: `ENVIDO`, `REAL_ENVIDO`, `FALTA_ENVIDO`.

**Response**: `204 No Content`.

**Errores**:
- `400` si `call` no coincide exactamente con el enum.

---

## §4.10 Responder envido

**Endpoint**: `POST /api/matches/{matchId}/envido/respond`

**Auth**: Bearer requerido.

**Request body**:

```json
{ "response": "NO_QUIERO" }
```

**Reglas**:
- `response` debe ser uno de: `QUIERO`, `NO_QUIERO`.

**Response**: `204 No Content`.

**Errores**:
- `400` si `response` no coincide exactamente con el enum.

---

## §4.11 Irse al mazo (fold)

**Endpoint**: `POST /api/matches/{matchId}/fold`

**Auth**: Bearer requerido.

**Request body**: sin body.

**Response**: `204 No Content`.

---

## Crear partida vs bot (referencia)

Cubierto por `specs/003-lobby-bots/contracts/POST_api_matches_bot.md` y `src/tests/contract/create-bot-match.contract.spec.ts`. Esta feature sólo lo **consume**: tras un `200 OK` con `matchId`, navega a `/match/:matchId`. No se modifica el shape de request/response.

---

## Enums consumidos (§8.1)

```text
PlayCardRequest.suit:            ESPADA | BASTO | COPA | ORO
CallEnvidoRequest.call:          ENVIDO | REAL_ENVIDO | FALTA_ENVIDO
RespondEnvidoRequest.response:   QUIERO | NO_QUIERO
RespondTrucoRequest.response:    QUIERO | NO_QUIERO | QUIERO_Y_ME_VOY_AL_MAZO
```

Todos los enums son **case-sensitive**. El backend responde `400 InvalidEnumValueException` ante divergencias.
