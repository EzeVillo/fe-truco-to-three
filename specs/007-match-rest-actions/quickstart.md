# Quickstart — Feature 007: Acciones de match REST

Esta guía describe cómo verificar manualmente que la feature está bien implementada una vez completada.

## Pre-requisitos

- Backend corriendo en `http://localhost:8080`.
- Frontend con `pnpm start` (http://localhost:4200).
- Usuario logueado (cualquier user válido).
- DevTools del navegador abierto en Network + Console.

## Flujo principal

### 1. Crear partida vs bot y navegar al match

1. Ir a `/lobby` → "Vs bots".
2. Elegir un bot y un formato de serie (ej. "Mejor de 3").
3. Confirmar creación.

**Esperado**:
- En Network: una llamada `POST /api/matches/bot` con `{ botId, gamesToPlay: 3 }`.
- Si responde `200`: la URL cambia a `/match/<uuid>` y se renderiza la pantalla de match con el mock por defecto.
- Si responde error: el usuario permanece en `/lobby/vs-bots` sin mensaje de error.
- **En Network: ninguna conexión `ws://` o `sockjs/`**.

### 2. Disparar las 6 acciones desde la pantalla de match

Desde `/match/<uuid>?fixture=common` (o el fixture que mejor exponga cada acción):

| Acción de UI | Esperado en Network |
|---|---|
| Click en "Truco" | `POST /api/matches/<uuid>/truco` sin body |
| Click en "Envido" → submenú abre → click en "Real envido" | `POST /api/matches/<uuid>/envido` con `{ "call": "REAL_ENVIDO" }` |
| (con fixture de truco rival) Click en "Quiero" | `POST /api/matches/<uuid>/truco/respond` con `{ "response": "QUIERO" }` |
| (con fixture de envido rival) Click en "No quiero" | `POST /api/matches/<uuid>/envido/respond` con `{ "response": "NO_QUIERO" }` |
| Click en "Mazo" / "Irse al mazo" | `POST /api/matches/<uuid>/fold` sin body |
| Click en cualquier carta de la mano | `POST /api/matches/<uuid>/play-card` con `{ "suit": "...", "number": N }` |

**Esperado adicional**:
- Cada acción dispara exactamente 1 request. Click repetido rápido = 1 sola request.
- Al hacer click en una carta, la carta NO se mueve a la mesa: la mano permanece igual.
- Cualquier 4xx/5xx en la pestaña Network NO se traduce en mensaje al usuario.
- En la consola pueden aparecer `console.warn('[match-actions] ...')` con el error; eso es esperado.

### 3. Disponibilidad según el mock

1. Cambiar al fixture con `?fixture=onlyFold`.

   **Esperado**: sólo el botón "Mazo" está activo. Las opciones de envido/truco no existen o están desactivadas; tocar el espacio no produce request.

2. Cambiar al fixture `?fixture=empty`.

   **Esperado**: no hay botones de acción. Ningún click genera request.

3. Cambiar al fixture con envido no disponible.

   **Esperado**: la opción "Envido" del menú default NO está marcada/habilitada; tocar no abre submenú ni dispara request.

## Smoke tests automáticos

```bash
pnpm lint
pnpm lint:styles
pnpm lint:themes
pnpm test    # incluye contract tests + unit tests
pnpm build
```

Todos deben pasar en verde.

## Criterios de éxito (alineados a SC del spec)

- [ ] **SC-001**: las 6 acciones disparan exactamente 1 request cada una.
- [ ] **SC-002**: crear bot match → pantalla de match ≤ 2 s en red local.
- [ ] **SC-003**: 0 mensajes de error visibles ante 4xx/5xx/timeout.
- [ ] **SC-004**: opción "envido" del menú default sólo activa cuando hay `CALL_ENVIDO` en `availableActions` del mock.
- [ ] **SC-005**: click repetido rápido → ≤ 1 request por acción por segundo.
- [ ] **SC-006**: ninguna conexión `ws://` ni `sockjs/` durante el flujo (verificado en pestaña Network).
