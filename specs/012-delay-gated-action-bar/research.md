# Research: Action bar bloqueada durante delay de eventos

**Feature**: 012-delay-gated-action-bar
**Date**: 2026-05-28

## Decisiones de investigación

### R-001: ¿Cómo exponer el estado de "processing delay" desde la cola de eventos?

**Decisión**: Agregar un signal `isProcessingDelay` en `MatchEventQueueService` que se active cuando un item con `delayMs > 0` comienza a procesarse y se desactive cuando termina de procesarse.

**Razón**: La cola de eventos ya tiene la lógica de procesamiento secuencial con delays. El signal se actualiza en el método `schedule()` cuando un item con `delayMs > 0` comienza su timer, y se desactiva en el callback del `setTimeout` cuando termina. Esto es más preciso que intentar inferir el estado desde fuera de la cola.

**Alternativas consideradas**:
1. *Signal en MatchStateService*: Requeriría que el state service conociera los detalles de la cola. Menos cohesivo.
2. *Computed signal basado en `pendingCount()`*: No distinguiría entre items con delay = 0 y delay > 0. Un item con delay = 0 se aplica inmediatamente pero técnicamente está "pending" durante un frame.
3. *Evento dedicado `QUEUE_DELAY_STARTED` / `QUEUE_DELAY_COMPLETED`*: Más complejo de lo necesario. Un signal booleano es suficiente.

### R-002: ¿Cómo se propaga el signal a los componentes afectados?

**Decisión**: El signal se inyecta directamente desde `MatchEventQueueService` (que ya está providenciado en `MatchScreenComponent`) en cada componente que lo necesite. Dado que el servicio está scoped al componente (`providers: [MatchStateService, MatchEventQueueService]`), todos los componentes hijos pueden inyectarlo.

**Razón**: El patrón ya existe — `MatchScreenComponent` inyecta `MatchEventQueueService` y lo pasa como dependencia. Los componentes hijos (GameBoardComponent, PlayerAreaComponent, PlayerHandComponent) pueden inyectarlo directamente o recibir el signal como input.

**Alternativas consideradas**:
1. *Input desde MatchScreenComponent*: Requeriría pasar el signal a través de 3 niveles de componentes (GameBoard → PlayerArea → PlayerHand). Más boilerplate.
2. *Output event desde la cola*: Más complejo y menos reactivo que un signal.

### R-003: ¿Cómo se maneja la transición entre estado deshabilitado y habilitado sin flickering?

**Decisión**: El signal `isProcessingDelay` se desactiva recién cuando el último item con `delayMs > 0` termina de procesarse. Si hay múltiples eventos en ráfaga, el signal permanece `true` hasta que se procesen todos. La transición `true → false` ocurre una sola vez al final.

**Razón**: El método `schedule()` de la cola ya maneja la secuencia correcta — procesa items uno a uno y solo llama a `schedule()` recursivamente después de aplicar cada item. El signal se actualiza al inicio y al final del procesamiento de items con delay.

**Alternativas consideradas**:
1. *Debounce en el signal*: Agregaría latencia innecesaria. La cola ya maneja la secuencia.
2. *Timer visual separado*: Duplicaría la lógica de timing. Innecesario.

### R-004: ¿Cómo afecta esto al patrón ACK (feature 011)?

**Decisión**: Los eventos bloqueantes (ACK) ya tienen `pausedForAck = true` en la cola. Cuando la cola está pausada por ACK, `isProcessingDelay` seguirá siendo `true` (porque hay items pendientes con delay > 0 que no se están procesando). Esto es correcto: el action bar debe permanecer deshabilitado tanto durante el delay temporal como durante la pausa por ACK.

**Razón**: La cola de eventos tiene dos estados de "pausa": delay temporal y ACK. Ambos deben mantener el action bar deshabilitado. El signal `isProcessingDelay` captura ambos casos porque la cola tiene items pendientes en ambos escenarios.

**Alternativas consideradas**:
1. *Signals separados para delay y ACK*: Más complejo de manejo. El comportamiento visual es el mismo (action bar deshabilitado).
2. *Signal `isPaused` que incluya ambos casos*: Equivalente a `isProcessingDelay` propuesto.

## Resumen de decisiones

| ID | Decisión | Implementación |
|----|----------|----------------|
| R-001 | Signal `isProcessingDelay` en MatchEventQueueService | Signal<boolean> actualizado en schedule() y setTimeout callback |
| R-002 | Inyección directa del signal | Cada componente inyecta MatchEventQueueService y lee el signal |
| R-003 | Sin flickering - signal se mantiene true durante ráfaga | Lógica existente de schedule() ya maneja la secuencia |
| R-004 | Compatible con ACK gating | pausedForAck mantiene isProcessingDelay = true |
