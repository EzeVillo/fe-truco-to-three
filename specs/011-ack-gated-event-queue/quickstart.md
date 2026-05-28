# Quickstart — Verificación manual de la feature 011

**Feature**: ACK del usuario gobierna el avance de la cola tras eventos que disparan modales

**Fecha**: 2026-05-27

---

## Pre-requisitos

- Backend corriendo localmente o stub con WS habilitado.
- `pnpm install` ejecutado.
- Branch `011-ack-gated-event-queue` con la feature implementada.

---

## Comandos

```bash
pnpm test                # Vitest — debe pasar (incluye los nuevos casos de match-event-queue.service.spec.ts)
pnpm lint                # ESLint
pnpm start               # Servidor en http://localhost:4200
```

---

## Escenario 1 — Resultado de envido pausa la cola (US1)

1. Iniciar una partida contra bot.
2. Cantar envido y aceptar con el bot (forzar `QUIERO`).
3. Observar el modal "Resultado de envido".
4. **Esperar 2-3 segundos sin cerrar el modal** mientras el bot juega su siguiente carta (debería llegar un `CARD_PLAYED` por WS).
5. **Verificación**: la mesa NO muestra la carta del rival mientras el modal está abierto.
6. Tocar **"Aceptar"** en el modal.
7. **Verificación**: el modal se cierra y, recién entonces, la carta del rival aparece (con el delay temporal configurado).

**Resultado esperado**: cumple SC-001 y AC-1/AC-2 de US1.

---

## Escenario 2 — Fin de partida pausa la cola (US2)

1. Jugar una serie "mejor de 3" hasta llegar al final de la primera partida.
2. Al cerrarse la partida, observar el modal "Partida ganada".
3. **Verificación**: aunque el backend ya envió eventos del inicio de la siguiente partida (reparto), la mesa permanece en el estado del cierre de la partida anterior.
4. Tocar **"Aceptar"**.
5. **Verificación**: el modal se cierra y la mesa transiciona a la nueva partida.

**Resultado esperado**: cumple AC-2 de US2.

---

## Escenario 3 — Eventos no bloqueantes siguen con delay temporal (US3)

1. En una partida en curso, esperar a que el rival juegue dos cartas seguidas (sin canto de por medio).
2. **Verificación**: las cartas se renderizan con el delay configurado (≈ 600 ms entre una y otra), sin pedir clicks.

**Resultado esperado**: cumple SC-003 (no se degrada el ritmo del flujo común).

---

## Escenario 4 — Doble click en "Aceptar" es idempotente (FR-006)

1. Forzar un modal de resultado de envido (como en Escenario 1).
2. Hacer doble click rápido sobre **"Aceptar"**.
3. **Verificación**: el modal se cierra una sola vez; no se procesan eventos adicionales; no aparece un segundo modal espurio.

---

## Escenario 5 — Abandono de pantalla con modal abierto (FR-008)

1. Forzar un modal de resultado de envido.
2. Sin tocar "Aceptar", navegar manualmente al lobby (cambiar URL o usar el botón del navegador).
3. **Verificación**: el modal se cierra solo, la cola se descarta, no quedan timers colgados.
4. Volver a la pantalla de match (si la URL lo permite) o reingresar a la partida: el estado se carga desde snapshot del backend.

---

## Escenario 6 — Encadenado de modales bloqueantes (FR-010)

Setup más complejo: requiere reproducir una mano donde el envido cierra los puntos de la partida (caso de borde real).

1. Reproducir la secuencia o usar el mock state switcher (`MockEnvidoResultSwitcherComponent` + `MockGameWonSwitcherComponent`) para encolar `ENVIDO_RESOLVED` seguido de `GAME_SCORE_CHANGED` que dispare `gameWon$`.
2. Observar que aparece el modal de envido.
3. Tocar **"Aceptar"** en el modal de envido.
4. **Verificación**: el modal de envido se cierra e inmediatamente (sin delay temporal extra) se abre el modal de "Partida ganada".
5. Tocar **"Aceptar"** en el modal de partida.
6. **Verificación**: la cola sigue procesando los eventos posteriores.

---

## Escenario 7 — `ENVIDO_RESOLVED` con `NO_QUIERO` no bloquea

1. Forzar canto de envido y rechazarlo (`NO_QUIERO`).
2. **Verificación**: NO aparece modal de resultado de envido; los eventos siguientes (puntos al rival, próxima carta) siguen aplicándose con su delay temporal habitual.

**Resultado esperado**: la cola no queda pausada (el handler llama `resumeAck()` síncronamente).

---

## Checklist de verificación

- [ ] `pnpm test` pasa, incluyendo los nuevos specs de pausa/resume.
- [ ] `pnpm lint` y `pnpm lint:styles` y `pnpm lint:themes` sin errores.
- [ ] Escenarios 1-7 verificados manualmente o con mocks.
- [ ] El catálogo `BLOCKING_MATCH_EVENT_TYPES` está documentado y centralizado.
- [ ] `MatchScreenComponent.ngOnDestroy` cierra los diálogos abiertos.
