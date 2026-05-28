# Quickstart: Action bar bloqueada durante delay de eventos

**Feature**: 012-delay-gated-action-bar
**Date**: 2026-05-28

## Resumen rápido

Deshabilitar el action bar y las cartas del jugador durante el procesamiento de eventos remotos con delay temporal.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `match-event-queue.service.ts` | Agregar signal `isProcessingDelay` |
| `available-actions-panel.component.ts` | Consumir signal, colapsar a action bar |
| `available-actions-panel.component.html` | Modificar template para modo deshabilitado |
| `action-bar.component.ts` | Agregar input `isProcessingDelay`, forzar disabled |
| `action-bar.component.html` | Aplicar disabled a botones |
| `player-hand.component.ts` | Consumir signal, deshabilitar cartas |
| `game-board.component.ts` | Pasar signal a componentes hijos |
| `match-screen.component.ts` | Pasar signal al GameBoard |

## Implementación paso a paso

### Paso 1: Agregar signal en MatchEventQueueService

```typescript
// En match-event-queue.service.ts
private readonly _isProcessingDelay = signal<boolean>(false);
readonly isProcessingDelay = this._isProcessingDelay.asReadonly();
```

Actualizar `schedule()`:
```typescript
private schedule(): void {
  if (this.processing || this.pendingTimerId !== null || this.queue.length === 0) {
    return;
  }
  if (this.pausedForAck) {
    return;
  }

  const item = this.queue[0];
  this.processing = true;

  if (item.delayMs === 0) {
    this.queue.shift();
    this.applyItem(item);
    this.processing = false;
    this.schedule();
    return;
  }

  // Activar signal cuando hay delay
  this._isProcessingDelay.set(true);

  this.pendingTimerId = setTimeout(() => {
    this.pendingTimerId = null;
    const current = this.queue.shift();
    if (current) {
      this.applyItem(current);
    }
    this.processing = false;
    // Desactivar signal si no hay más items con delay
    this.updateProcessingDelayState();
    this.schedule();
  }, item.delayMs);
}

private updateProcessingDelayState(): void {
  const hasPendingDelay = this.queue.some(item => item.delayMs > 0);
  this._isProcessingDelay.set(hasPendingDelay || this.processing);
}
```

Actualizar `clear()`:
```typescript
clear(): void {
  this.cancelTimer();
  this.queue = [];
  this.processing = false;
  this.pausedForAck = false;
  this._isProcessingDelay.set(false);
}
```

### Paso 2: Modificar AvailableActionsPanelComponent

```typescript
// Agregar input o inyección
readonly isProcessingDelay = input<boolean>(false);

// Agregar computed
readonly shouldCollapseToActionBar = computed(() => this.isProcessingDelay());
```

```html
<!-- Modificar template -->
@if (shouldCollapseToActionBar()) {
  <app-action-bar
    [availableActions]="availableActions()"
    [currentTrucoCall]="currentTrucoCall()"
    [envidoCallOptions]="envidoCallOptions()"
    [isProcessingDelay]="isProcessingDelay()"
    (actionClicked)="onAction($event)"
    (envidoClicked)="onEnvidoClick()"
  />
} @else if (envidoSubmenuOpen()) {
  <!-- ... resto del template existente ... -->
```

### Paso 3: Modificar ActionBarComponent

```typescript
// Agregar input
readonly isProcessingDelay = input<boolean>(false);

// Modificar computed items
readonly items = computed<ActionBarItem[]>(() => {
  const actions = this.availableActions();
  const envidoOpts = this.envidoCallOptions();
  const isDelay = this.isProcessingDelay();
  
  // Si hay delay, todos los botones deshabilitados
  if (isDelay) {
    return [
      { label: trucoLabel(this.currentTrucoCall()), actionType: 'CALL_TRUCO', enabled: false },
      { label: 'Envido', actionType: 'CALL_ENVIDO', enabled: false },
      { label: 'Mazo', actionType: 'FOLD', enabled: false },
    ];
  }

  // Lógica existente...
});
```

### Paso 4: Modificar PlayerHandComponent

```typescript
// Agregar input
readonly isProcessingDelay = input<boolean>(false);

// Modificar computed de disabled
readonly isCardDisabled = computed(() => {
  return !this.playCardsEnabled() || this.isPlayingCard() || this.isProcessingDelay();
});
```

### Paso 5: Propagar signal desde MatchScreenComponent

```typescript
// En match-screen.component.html
<app-game-board
  [matchView]="matchView()"
  [matchId]="matchId()"
  [isProcessingDelay]="eventQueue.isProcessingDelay()"
/>
```

## Verificación

1. **Test manual**: Forzar un evento remoto con delay (ej. carta del rival). Verificar que durante el delay, el action bar muestra botones deshabilitados.
2. **Test unitario**: Verificar que `isProcessingDelay` se activa/desactiva correctamente en la cola.
3. **Test visual**: Verificar que no hay flickering al finalizar el delay.
4. **Lint**: Ejecutar `pnpm lint:styles` para verificar que no se introdujeron colores hardcodeados.

## Comandos útiles

```bash
# Verificar estilos
pnpm lint:styles

# Ejecutar tests
pnpm test

# Verificar lint general
pnpm lint

# Build completo
pnpm build
```
