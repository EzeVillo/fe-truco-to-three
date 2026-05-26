# Research: Visualización de cantos del rival en panel de estado

**Feature**: 009-rival-call-display  
**Date**: 2026-05-26

---

## 1. Dónde almacenar el estado transiente de cantos

**Decision**: El texto del último canto vive en `MatchScreenComponent` como señales (`selfCallText` / `opponentCallText`), no en `MatchState` ni en el reducer.

**Rationale**:
- El texto de canto es **estado de presentación** (transiente, no persistente, no afecta la lógica de juego).
- `MatchState` representa el estado de dominio de la partida; agregar campos de UI rompería la separación de responsabilidades.
- El reducer (`match-event.reducer.ts`) es puro; introducir timers o texto de display lo contaminaría.
- `MatchScreenComponent` ya tiene acceso a `MatchStateService` y es el propietario natural del ciclo de vida del panel.

**Alternativas consideradas**:
- Extender `MatchState` con `lastCallText` → Rechazada: contaminaría el modelo de dominio con datos de UI.
- Crear un servicio dedicado `MatchCallDisplayService` → Rechazada: la lógica es breve (< 40 líneas); un servicio adicional sería over-engineering para esta feature.
- Inyectar en `MatchStatusPanelComponent` directamente → Rechazada: el componente de panel recibe `MatchView` por input y no tiene acceso al servicio WS; rompería el patrón de input unidireccional.

---

## 2. Cómo exponer los eventos WS al componente

**Decision**: Agregar `matchEvent$ = new Subject<MatchWsEvent>()` en `MatchStateService`, emitiendo en `applyAndIncrement` después de aplicar el evento.

**Rationale**:
- Mantiene una única suscripción al WebSocket (la de `MatchStateService`), preservando el buffer y la lógica de reconexión.
- Evita duplicar suscripciones al canal `/user/queue/match` desde otro servicio o componente.
- Los componentes downstream reciben los eventos ya validados y aplicados, reduciendo la superficie de error.

**Alternativas consideradas**:
- Re-suscribirse al WS desde `MatchScreenComponent` → Rechazada: duplicaría lógica de buffer, ordenamiento por `stateVersion`, y manejo de gaps.
- Observar cambios del signal `state()` y derivar eventos por diff → Rechazada: compleja, frágil y no detectaría eventos que no cambian estado relevante (ej. respuesta `QUIERO` que no cambia `roundStatus`).

---

## 3. Implementación del timer de auto-limpieza

**Decision**: Usar `setTimeout` nativo con tracking manual de `timeoutId` por `Seat`, cancelando timers previos al recibir un nuevo evento y al destruir el componente (`DestroyRef`).

**Rationale**:
- Angular no proporciona una abstracción de timer integrada más simple que `setTimeout` para este caso (no es un intervalo ni un Observable recurrente).
- `DestroyRef` permite limpiar timers cuando el componente se destruye sin depender de `ngOnDestroy` explícito (aunque `MatchScreenComponent` ya implementa `OnDestroy`).
- El tracking por `Map<Seat, number>` asegura que un timer viejo no borre un texto nuevo si llega un segundo evento rápido.

**Alternativas consideradas**:
- `rxjs timer` → Rechazada: requiere gestionar suscripciones adicionales y `takeUntil` con un `Subject` de destrucción. Para un timer simple de 3 segundos, `setTimeout` es más directo y legible.
- `@angular/core/testing` fakeAsync → Solo aplica a tests, no a producción.

---

## 4. Design tokens para el texto de canto

**Decision**: Usar `var(--t3-gold-500)` como color del texto de canto, con `font-weight: 600`.

**Rationale**:
- `var(--t3-gold-500)` es el token de acento principal de la aplicación (usado en puntajes, indicadores de turno activo). Aplicarlo al texto de canto lo hace visualmente distintivo frente a los datos estáticos del panel (`--t3-text` para nombres, `--t3-text-muted` para etiquetas).
- `font-weight: 600` (semibold) diferencia el canto del nombre del jugador (`font-weight: 500`).
- No se agrega fondo ni borde adicional para mantener la altura del panel dentro del límite de 96 px en mobile.

**Alternativas consideradas**:
- Color `--t3-danger` (rojo) para textos de rechazo (`NO_QUIERO`) → Rechazada: el spec pide un estilo distintivo general para todos los cantos, no semántica por tipo de respuesta. Mantener un único estilo simplifica la implementación y evita sobrecarga visual.
- Badge con fondo y borde → Rechazada: aumentaría la altura del panel y podría romper el layout en 360 px de ancho.

---

## 5. Posicionamiento del texto debajo del nombre

**Decision**: Insertar un `<span>` debajo del `<span class="status-panel__player-name">` dentro de cada columna `.status-panel__player-col`, aprovechando el `flex-direction: column` ya existente.

**Rationale**:
- El layout actual usa `flex-direction: column` en `.status-panel__player-col`, por lo que agregar un nuevo elemento hijo se apila naturalmente debajo del nombre.
- No requiere cambios en el layout general del panel ni en las media queries de desktop.
- La alineación heredada (`align-items: flex-start` para self, `flex-end` para rival) posiciona el texto correctamente en cada lado.

**Alternativas consideradas**:
- Posicionar el texto absolutamente sobre el panel → Rechazada: complicaría el responsive y el flujo del documento.
- Agregar una nueva fila debajo de `.status-panel__players-row` → Rechazada: desacoplaría el texto del jugador correspondiente y rompería la relación visual requerida.
