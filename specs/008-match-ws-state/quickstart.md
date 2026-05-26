# Quickstart: Estado de partida en tiempo real vía WebSocket

**Feature**: `008-match-ws-state` | **Fecha**: 2026-05-26

---

## Prerrequisitos

- Backend corriendo en `http://localhost:8080`
- WS en `http://localhost:8080/ws-sockjs`
- Tener un match activo (`IN_PROGRESS`) con el jugador autenticado
- `pnpm install` ejecutado

---

## Correr la app en desarrollo

```bash
pnpm start
```

Navegar a `/match/<matchId>`. La pantalla debe:
1. Mostrar un spinner mientras carga
2. Mostrar el estado real del tablero (puntaje, cartas, turno)
3. Actualizarse en tiempo real ante cada acción del oponente

---

## Verificar el flujo de bootstrap

Para debuggear el bootstrap abrí el DevTools → Network → WS. Deberías ver:
- `SUBSCRIBE` a `/user/queue/match`
- `SUBSCRIBE` a `/user/queue/match-derived`
- GET `http://localhost:8080/api/matches/<matchId>`
- Eventos llegando por WS mientras la partida avanza

---

## Correr tests

```bash
pnpm test
```

Los tests del reducer están en:
```
src/app/features/match/reducers/match-event.reducer.spec.ts
```

Los tests del servicio están en:
```
src/app/features/match/services/match-state.service.spec.ts
```

---

## Cómo probar el diálogo de fin de partida

1. Abrir dos pestañas del navegador (dos jugadores distintos autenticados en la misma partida).
2. En la pestaña del jugador que va a abandonar, llamar al endpoint REST:
   ```
   POST /api/matches/<matchId>/abandon
   Authorization: Bearer <jwt>
   ```
3. Verificar que en **ambas** pestañas aparece el diálogo de resultado.
4. Verificar que al cerrar el diálogo, la pantalla navega al lobby.

---

## Reproducir un gap en la secuencia (testing manual avanzado)

En el `MatchStateService`, temporalmente aumentar el `lastApplied` en 1 antes de iniciar el live mode. El siguiente evento transaccional debería disparar un re-fetch GET. Revertir el cambio antes de commitear.

---

## Linting y guardarraíles

```bash
pnpm lint           # ESLint
pnpm lint:styles    # Colores hardcodeados en SCSS
pnpm lint:themes    # Botones Material crudos en templates
pnpm build          # Verificar compilación
```
