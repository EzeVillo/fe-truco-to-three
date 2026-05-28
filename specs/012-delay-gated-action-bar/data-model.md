# Data Model: Action bar bloqueada durante delay de eventos

**Feature**: 012-delay-gated-action-bar
**Date**: 2026-05-28

## Entidades modificadas

### MatchEventQueueService (servicio existente)

**Cambios**:
- Agregar signal `isProcessingDelay: Signal<boolean>` (solo lectura para consumidores)
- Agregar signal interno `_isProcessingDelay: WritableSignal<boolean>`
- Actualizar `schedule()` para activar el signal cuando un item con `delayMs > 0` comienza a procesarse
- Actualizar callback de `setTimeout` para desactivar el signal cuando termina de procesarse
- Actualizar `clear()` para resetear el signal

**Campos existentes relevantes**:
```typescript
private queue: QueuedMatchEvent[] = [];
private pendingTimerId: ReturnType<typeof setTimeout> | null = null;
private processing = false;
private pausedForAck = false;
```

**Campo nuevo**:
```typescript
private readonly _isProcessingDelay = signal<boolean>(false);
readonly isProcessingDelay = this._isProcessingDelay.asReadonly();
```

### AvailableActionsPanelComponent (componente existente)

**Cambios**:
- Agregar input `isProcessingDelay: Signal<boolean>` (o inyectar MatchEventQueueService)
- Agregar computed `shouldCollapseToActionBar` que retorna `true` cuando `isProcessingDelay` es `true`
- Modificar template para colapsar a ActionBarComponent cuando `shouldCollapseToActionBar` es `true`

**Inputs existentes**:
```typescript
readonly availableActions = input.required<AvailableAction[]>();
readonly currentTrucoCall = input<TrucoCall | null>(null);
readonly matchId = input.required<string>();
```

**Campo nuevo** (input o inyección):
```typescript
// Opción A: Input
readonly isProcessingDelay = input<boolean>(false);

// Opción B: Inyección (preferida - ya existe el patrón)
private readonly eventQueue = inject(MatchEventQueueService);
readonly isProcessingDelay = this.eventQueue.isProcessingDelay;
```

### ActionBarComponent (componente existente)

**Cambios**:
- Agregar input `isProcessingDelay: Signal<boolean>` (o recibir como input)
- Modificar computed `items` para forzar `enabled: false` en todos los botones cuando `isProcessingDelay` es `true`

**Inputs existentes**:
```typescript
readonly availableActions = input.required<ReadonlyArray<{ type: AvailableActionType }>>();
readonly currentTrucoCall = input<TrucoCall | null>(null);
readonly envidoCallOptions = input<EnvidoCallOptions | null>(null);
```

**Campo nuevo**:
```typescript
readonly isProcessingDelay = input<boolean>(false);
```

### PlayerHandComponent (componente existente)

**Cambios**:
- Agregar input `isProcessingDelay: Signal<boolean>` (o inyectar MatchEventQueueService)
- Modificar computed `isCardBlocked` para retornar `true` cuando `isProcessingDelay` es `true`

**Inputs existentes**:
```typescript
readonly hand = input.required<Card[]>();
readonly playCardsEnabled = input<boolean>(true);
readonly isPlayingCard = input<boolean>(false);
```

**Campo nuevo**:
```typescript
readonly isProcessingDelay = input<boolean>(false);
```

### GameBoardComponent (componente existente)

**Cambios**:
- Agregar input `isProcessingDelay: Signal<boolean>` (o inyectar MatchEventQueueService)
- Pasar `isProcessingDelay` como input a PlayerAreaComponent → PlayerHandComponent
- Pasar `isProcessingDelay` como input a AvailableActionsPanelComponent

### MatchScreenComponent (componente existente)

**Cambios**:
- Inyectar `MatchEventQueueService` (ya existe)
- Pasar `eventQueue.isProcessingDelay` al GameBoardComponent

## Relaciones

```
MatchScreenComponent
  └─ GameBoardComponent
       ├─ AvailableActionsPanelComponent  ← isProcessingDelay
       │    └─ ActionBarComponent         ← isProcessingDelay
       ├─ PlayerAreaComponent
       │    └─ PlayerHandComponent        ← isProcessingDelay
       └─ (otros componentes sin cambios)
```

## Transiciones de estado

### Signal isProcessingDelay

| Estado actual | Evento | Nuevo estado |
|---------------|--------|--------------|
| `false` | schedule() procesa item con delayMs > 0 | `true` |
| `true` | setTimeout callback termina de procesar | `false` (si no hay más items con delay > 0) |
| `true` | clear() llamado | `false` |
| `true` | Otro item con delayMs > 0 se encola | `true` (sin cambio) |

### Estado visual del panel de acciones

| isProcessingDelay | Acciones disponibles | Estado visual |
|-------------------|---------------------|---------------|
| `true` | Cualquiera | ActionBar colapsado, todos los botones disabled |
| `false` | CALL_TRUCO, CALL_ENVIDO, FOLD | ActionBar principal con botones habilitados según acciones |
| `false` | RESPOND_TRUCO | TrucoResponsePanel + ActionBar |
| `false` | RESPOND_ENVIDO | EnvidoResponsePanel |
| `false` | Envido submenu abierto | EnvidoSubmenuComponent |

## Reglas de validación

1. `isProcessingDelay` solo puede ser `true` cuando la cola tiene items con `delayMs > 0` pendientes o en proceso.
2. `isProcessingDelay` se resetea a `false` en `clear()` (al abandonar la pantalla).
3. El signal es de solo lectura para consumidores — solo la cola puede modificarlo.
4. No hay validación de `isProcessingDelay` en el template — el computed `shouldCollapseToActionBar` encapsula la lógica.
