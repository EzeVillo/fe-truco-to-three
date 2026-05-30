# Behavior & Edge-Case Requirements Checklist: Temporizador de turno en partida

**Purpose**: Gate pre-implementación — validar la **calidad de los requisitos** (completitud,
claridad, consistencia, medibilidad y cobertura) del comportamiento temporal/sync y de los casos
límite/fallos, antes de `/speckit-tasks` y `/speckit-implement`.
**Created**: 2026-05-29
**Feature**: [spec.md](../spec.md)

**Note**: Este checklist testea los REQUISITOS escritos, no la implementación. Cada ítem pregunta si
algo está bien especificado, no si "funciona".

## Comportamiento temporal / sincronización — Completitud

- [x] CHK001 ¿Está definido qué fuente determina el tiempo restante mostrado (plazo del backend) y se excluye explícitamente un valor fijo del cliente? [Completeness, Spec §FR-003]
- [x] CHK002 ¿Se especifica el momento en que la cuenta regresiva debe iniciarse (aparición de asiento obligado a actuar)? [Completeness, Spec §FR-001]
- [x] CHK003 ¿Están definidos todos los disparadores de reinicio del plazo (cambio de turno, canto truco/envido, respuesta que devuelve el juego, nueva ronda)? [Completeness, Spec §FR-004]
- [x] CHK004 ¿Se especifica el comportamiento de la cuenta regresiva cuando el asiento obligado es una respuesta a canto y no el turno de jugar carta? [Coverage, Spec §US1, §FR-002]
- [x] CHK005 ¿Está documentado el requisito de recuperar el tiempo restante correcto (no el total) tras reconexión/recarga a mitad de turno? [Completeness, Spec §FR-009, Edge Cases]
- [x] CHK006 ¿Se especifica cómo el cliente obtiene la referencia temporal del servidor para corregir el desfase de reloj? [Completeness, Spec §FR-010]

## Comportamiento temporal / sincronización — Claridad y medibilidad

- [x] CHK007 ¿Está cuantificado el umbral de urgencia con un valor específico y no con un adjetivo vago ("se acerca a cero")? [Clarity, Spec §FR-006]
- [x] CHK008 ¿Es medible la tolerancia de diferencia entre el tiempo mostrado y el plazo real del backend? [Measurability, Spec §SC-002]
- [x] CHK009 ¿Está acotado en cuánto tiempo debe reflejarse el tiempo restante correcto tras restablecer el estado en una reconexión? [Measurability, Spec §SC-003]
- [x] CHK010 ¿Se define qué significa "robusto frente al desfase de reloj" en términos objetivos/verificables y no como cualidad genérica? [Ambiguity, Spec §FR-010]
- [x] CHK011 ¿El criterio "0 falsos positivos de derrota originados en el cliente" es objetivamente verificable? [Measurability, Spec §SC-004]

## Comportamiento temporal / sincronización — Consistencia

- [x] CHK012 ¿El concepto "asiento obligado a actuar" se usa de forma consistente y se distingue explícitamente de "turno" (`currentTurn`) en toda la spec? [Consistency, Spec §Key Entities]
- [x] CHK013 ¿La regla de "aplica a ambos lados" es consistente entre el Resumen, US1/US2 y los FR-002? [Consistency, Spec §FR-002, §US2]
- [x] CHK014 ¿La representación "sólo indicador visual sin número" es consistente entre Clarifications y FR-001 (sin requisitos contradictorios que pidan mostrar segundos)? [Consistency, Spec §FR-001, §Clarifications]
- [x] CHK015 ¿Las unidades de tiempo (segundos vs milisegundos) están expresadas de forma consistente en los criterios y supuestos? [Consistency, Spec §SC-002, §SC-003]

## Cobertura de escenarios y casos límite

- [x] CHK016 ¿Hay requisitos para el estado "sin asiento obligado a actuar" (mano resuelta, animaciones de cierre, transición entre rondas/partidas)? [Coverage, Spec §FR-005, Edge Cases]
- [x] CHK017 ¿Está especificado el comportamiento al alcanzar 0 antes de la confirmación del backend (estado "tiempo agotado" + deshabilitar controles)? [Coverage, Spec §FR-008, §Clarifications]
- [x] CHK018 ¿Se establece explícitamente que el cliente NO declara la derrota y espera la resolución del backend? [Completeness, Spec §FR-007]
- [x] CHK019 ¿Hay requisitos para ocultar el indicador cuando la partida finaliza o se cancela? [Coverage, Spec §FR-012, Edge Cases]
- [x] CHK020 ¿Se especifica el comportamiento del indicador en partidas contra bot (resolución casi instantánea del lado del bot)? [Edge Case, Spec §Edge Cases, §Assumptions]
- [x] CHK021 ¿Está cubierto el caso de cambio de plazo a mitad de mano (nuevo asiento obligado) como reinicio, sin ambigüedad sobre el valor previo? [Coverage, Spec §FR-004, Edge Cases]
- [x] CHK022 ¿Hay requisito para el caso en que la partida termina mientras la cuenta regresiva está activa? [Edge Case, Spec §Edge Cases, §FR-012]

## Recuperación y resiliencia de estado

- [x] CHK023 ¿Se especifica el comportamiento del temporizador ante una desconexión/reconexión del canal en tiempo real (no sólo recarga de página)? [Recovery, Gap]
- [x] CHK024 ¿Está definido qué ocurre con la cuenta regresiva si no llega un evento de limpieza esperado (p. ej. el plazo expira sin recibir el evento de fin)? [Exception Flow, Gap]
- [x] CHK025 ¿Se documenta el comportamiento esperado si el backend no envía el plazo (campos del plazo ausentes/null) durante una partida en curso? [Edge Case, Gap]

## Comportamiento ante datos inválidos / inconsistentes (calidad de requisitos)

- [x] CHK026 ¿Hay requisitos sobre cómo tratar un plazo ya vencido al recibir el estado (deadline en el pasado) en la carga inicial? [Edge Case, Gap]
- [x] CHK027 ¿Se define el comportamiento si el "asiento obligado" informado no corresponde a ningún jugador conocido o es inconsistente con el estado de la partida? [Exception Flow, Gap] — RESUELTO: edge case "Asiento obligado inconsistente" agregado (sin reloj, espera corrección del backend).

## Dependencias y supuestos

- [x] CHK028 ¿Está documentado y validado el supuesto de que el backend expone el plazo (instante límite, duración total y asiento) por estado y por eventos en tiempo real? [Assumption, Spec §Assumptions]
- [x] CHK029 ¿Se documenta explícitamente la exclusión de la vista de espectador como límite de alcance? [Assumption, Spec §Assumptions, §Clarifications]
- [x] CHK030 ¿Se acota que el alcance es sólo representación/lógica de tiempo en el cliente y no la duración del plazo ni la mecánica de forfeit (backend)? [Assumption, Spec §Assumptions]

## Trazabilidad y acceptance criteria

- [x] CHK031 ¿Cada user story (US1, US2) tiene escenarios de aceptación que cubren inicio, acción antes de expirar y reinicio? [Acceptance Criteria, Spec §US1, §US2] — RESUELTO: escenario de reinicio agregado a US1 (sc5).
- [x] CHK032 ¿Cada FR de comportamiento temporal tiene un criterio de éxito medible asociado (mapeo FR → SC)? [Traceability, Spec §Requirements, §Success Criteria] — RESUELTO: tabla de trazabilidad FR ↔ SC agregada en §Success Criteria.
- [x] CHK033 ¿Los escenarios de aceptación son verificables objetivamente sin referirse a detalles de implementación? [Measurability, Spec §US1]

## Notes

- Marcar `[x]` al validar. Anotar hallazgos inline (p. ej. "Gap: falta requisito para CHK024").
- Ítems con `[Gap]` señalan requisitos potencialmente faltantes; resolver antes del gate de
  implementación (actualizar `spec.md`).
- Foco de esta corrida: comportamiento temporal/sync + edge cases/fallos, profundidad gate
  pre-implementación.
