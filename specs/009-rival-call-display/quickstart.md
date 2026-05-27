# Quickstart: Verificación manual de cantos del rival

**Feature**: 009-rival-call-display  
**Date**: 2026-05-26

---

## Prerrequisitos

1. Backend corriendo en `http://localhost:8080`.
2. Frontend compilado y corriendo en `http://localhost:4200`.
3. Usuario autenticado en el lobby.

---

## Flujo de verificación paso a paso

### 1. Crear una partida contra bot

1. Ir al lobby (`/`).
2. Seleccionar un bot y formato de serie (recomendado: "Mejor de 3").
3. Hacer clic en "Crear partida".
4. Verificar que la navegación lleva a `/match/:matchId`.

### 2. Verificar canto del rival (bot)

1. Esperar a que el bot cante "Truco" (puede requerir jugar una carta primero).
2. **Esperado**: debajo del nombre del rival (columna derecha, etiqueta "RIVAL") aparece el texto "¡Truco!" en color dorado (`--t3-gold-500`).

### 3. Verificar canto propio

1. Realizar un canto desde la interfaz propia (ej. "Envido").
2. **Esperado**: debajo del nombre propio (columna izquierda, etiqueta "VOS") aparece el texto "¡Envido!".

### 4. Verificar reemplazo de cantos

1. Con un canto visible del rival, esperar o provocar un nuevo canto (ej. "Retruco").
2. **Esperado**: el texto anterior desaparece y se reemplaza por el nuevo (nunca hay dos textos simultáneos del mismo jugador).

### 5. Verificar auto-limpieza de aceptación

1. Provocar que el bot responda "Quiero" a un canto (puede requerir un segundo cliente o manipular WS).
2. **Esperado**: el texto "¡Quiero!" aparece y desaparece automáticamente entre 2.5 y 3.5 segundos.

### 6. Verificar reset al iniciar nueva ronda

1. Finalizar la ronda actual (jugar hasta que alguien gane la mano o se vaya al mazo).
2. Cuando el servidor envíe `ROUND_STARTED`, observar el panel.
3. **Esperado**: cualquier texto de canto desaparece inmediatamente antes de que se repartan las nuevas cartas.

### 7. Verificar reset al finalizar partida

1. Jugar hasta que un jugador llegue a 3 puntos exactos (o el otro se pase).
2. Al aparecer el diálogo de fin de partida, observar el panel.
3. **Esperado**: los textos de canto ya no están visibles (el panel puede estar oculto por el diálogo).

---

## Verificación en móvil (360 px)

1. Abrir DevTools → Toggle device toolbar → 360 × 780.
2. Repetir los pasos 2–4.
3. **Esperado**:
   - El texto de canto cabe en una sola línea debajo del nombre.
   - El panel de estado no excede 96 px de altura total.
   - No hay overflow ni wrap indeseado.

---

## Comandos de verificación automatizada

```bash
# Lint
pnpm lint
pnpm lint:styles
pnpm lint:themes

# Tests unitarios del mapper y del panel
pnpm test

# Build de producción
pnpm build
```

---

## Notas de edge cases

- **Canto inesperado sin ronda activa**: Si llega un evento de canto cuando `roundGame` es `null`, el reducer no altera el estado y `MatchScreenComponent` no actualiza el texto (protección implícita).
- **Reconexión**: Al reconectar, `MatchStateService` hace re-bootstrap. Los textos de canto se pierden (se resetean a `null`), que es el comportamiento correcto según el edge case de reconexión del spec.
