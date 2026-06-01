# Feature Specification: Sección de reglas de variante

**Feature Branch**: `017-rules-section-fe`

**Created**: 2026-05-31

**Status**: Draft

**Input**: User description: "Prefiero hacerlo todo en el FE directamente. Agregar una sección de reglas que use la información de `docs/REGLAS_VARIANTE.md`, mostrando solo las reglas especiales de la variante a 3 puntos."

## Clarifications

### Session 2026-05-31

- Q: ¿Dónde debe aparecer la sección de reglas de la variante? → A: El lobby debe tener un CTA que navegue a una página dedicada de reglas bajo `/lobby/reglas`.
- Q: ¿Debe mostrarse el bloque visual "Claves"? → A: No; la página debe mostrar las reglas sin la sección de claves.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar reglas de la variante (Priority: P1)

Como jugador, quiero encontrar en el lobby un botón de reglas de la variante a 3 puntos para abrir una página dedicada y entender rápidamente qué cambia respecto del truco tradicional antes de jugar.

**Why this priority**: Es el valor principal de la feature: evitar confusión sobre la regla de punto exacto y las condiciones especiales que afectan el resultado de una partida.

**Independent Test**: Se puede probar accediendo al lobby, abriendo el CTA de reglas y verificando que una persona encuentre allí las condiciones especiales de la variante sin necesitar documentación externa.

**Acceptance Scenarios**:

1. **Given** un usuario en el lobby, **When** activa el CTA de reglas, **Then** navega a `/lobby/reglas` y ve una explicación clara de que el game se gana llegando exactamente a `3` puntos y que pasarse de `3` hace perder.
2. **Given** un usuario en la página de reglas, **When** revisa el contenido disponible, **Then** encuentra solo reglas propias o adaptadas de la variante a 3 puntos, sin el reglamento completo del truco base.

---

### User Story 2 - Entender situaciones especiales de puntuación (Priority: P2)

Como jugador, quiero ver las reglas especiales que pueden cambiar quién gana puntos o quién pierde el game para tomar decisiones informadas durante la partida.

**Why this priority**: Las reglas especiales de puntuación tienen impacto directo en decisiones de juego como falta envido, irse al mazo o responder al truco.

**Independent Test**: Se puede probar revisando que la sección explique todas las reglas especiales de puntuación y cierre incluidas en el documento de variante.

**Acceptance Scenarios**:

1. **Given** un usuario en la página de reglas, **When** busca información sobre Falta envido, **Then** ve que otorga los puntos que le faltan al rival para llegar exactamente a `3`.
2. **Given** un usuario en la página de reglas, **When** busca información sobre "quiero y me voy al mazo", **Then** ve que el rival gana el truco cantado en ese momento.
3. **Given** un usuario en la sección de reglas del lobby, **When** busca información sobre el ancho de espada, **Then** ve en qué casos cierra automáticamente la round y que después no se puede cantar truco.

---

### User Story 3 - Acceder a reglas en mobile y desktop (Priority: P3)

Como usuario, quiero que la sección de reglas del lobby sea legible y navegable tanto en mobile como en desktop para poder consultarla desde cualquier pantalla soportada.

**Why this priority**: La sección debe estar disponible en los tamaños soportados por el producto, pero depende de que el contenido principal ya esté definido.

**Independent Test**: Se puede probar abriendo la sección en los tamaños soportados y verificando que el contenido se lea sin solapamientos, cortes ni desplazamientos incómodos.

**Acceptance Scenarios**:

1. **Given** un usuario con una pantalla mobile soportada, **When** abre la sección de reglas desde el lobby, **Then** puede leer todos los títulos, párrafos y listas sin texto superpuesto.
2. **Given** un usuario con una pantalla desktop soportada, **When** abre la sección de reglas desde el lobby, **Then** puede escanear las reglas por bloques con jerarquía visual clara.

---

### Edge Cases

- Si el usuario accede al lobby sin estar en una partida activa, debe poder leer las reglas igualmente.
- La página de reglas debe estar accesible desde el CTA del lobby y permitir volver al lobby.
- La página de reglas no debe mostrar un bloque visual de "Claves".
- Si el contenido de una regla es largo, debe mantenerse legible sin tapar otras secciones ni romper el layout.
- Si una regla incluye valores críticos como `3`, `1`, `5` o nombres de cantos, esos valores deben mostrarse exactamente como están definidos en la documentación de variante.
- Si en el futuro cambia `docs/REGLAS_VARIANTE.md`, la sección debe poder revisarse contra ese documento para evitar divergencias de contenido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El lobby DEBE ofrecer un CTA visible de reglas de la variante a 3 puntos.
- **FR-001a**: El CTA de reglas DEBE navegar a `/lobby/reglas`.
- **FR-002**: La sección DEBE basar su contenido en `docs/REGLAS_VARIANTE.md` como fuente editorial inicial.
- **FR-003**: La sección DEBE mostrar únicamente reglas especiales de la variante, no el reglamento completo del truco argentino.
- **FR-004**: La sección DEBE explicar que cada game se gana llegando exactamente a `3` puntos y que superar `3` hace perder el game.
- **FR-007**: La sección DEBE explicar la adaptación de Falta envido: si se quiere, otorga los puntos que le faltan al rival para llegar exactamente a `3`.
- **FR-008**: La sección DEBE explicar la respuesta "quiero y me voy al mazo" como que el rival gana el truco cantado en ese momento.
- **FR-009**: La sección DEBE explicar los casos de cierre automático por ancho de espada y que después de ese cierre no se puede cantar truco.
- **FR-010**: La sección DEBE explicar la restricción especial del jugador mano para irse al mazo en la primera mano.
- **FR-011**: La sección DEBE mantener nombres de cantos, valores numéricos y términos de dominio de forma consistente con la documentación del juego.
- **FR-012**: La sección DEBE ser accesible y legible en los tamaños soportados del producto, con ancho mínimo de `360 px`.
- **FR-013**: La sección NO DEBE depender de una respuesta de un sistema externo para mostrar el contenido inicial de reglas.
- **FR-014**: La sección DEBE permitir que un usuario escanee las reglas por temas sin leer un bloque único de texto continuo.
- **FR-015**: La página de reglas NO DEBE mostrar un bloque visual de "Claves".

### Key Entities *(include if feature involves data)*

- **Regla de variante**: Condición especial que modifica o adapta el comportamiento del truco base para la modalidad a 3 puntos. Incluye título, descripción y, cuando corresponde, valores críticos.
- **Página de reglas**: Pantalla dedicada bajo `/lobby/reglas`, accesible desde el CTA de reglas del lobby.
- **Valor crítico de regla**: Número, canto o condición que no debe divergir de la documentación de variante, como `3`, Falta envido o "ancho de espada".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede llegar desde el lobby hasta la regla de punto exacto en menos de 30 segundos.
- **SC-002**: El 100% de las reglas listadas en `docs/REGLAS_VARIANTE.md` están representadas en la sección sin agregar reglas del truco base que no sean específicas de la variante.
- **SC-003**: En una revisión de contenido, el 100% de los valores críticos visibles coinciden con `docs/REGLAS_VARIANTE.md`.
- **SC-004**: La sección puede leerse en mobile de `360 px` de ancho sin texto superpuesto ni controles inaccesibles.
- **SC-005**: Al menos el 90% de usuarios de prueba identifica correctamente que pasarse de `3` puntos hace perder el game después de leer la sección.
- **SC-006**: En una revisión visual, la página de reglas no muestra el bloque "Claves".

## Assumptions

- La sección mostrará contenido local dentro de la aplicación, sin solicitar reglas a sistemas externos.
- `docs/REGLAS_VARIANTE.md` es la fuente editorial inicial para esta feature.
- La sección apunta a usuarios finales que necesitan entender la modalidad, no a desarrolladores que buscan el contrato técnico.
- La sección no reemplaza `docs/REGLAS_JUEGO.md`; solo presenta las diferencias y condiciones especiales de la variante.
- La entrada a reglas pertenece al lobby mediante un CTA; el contenido se muestra en una página dedicada bajo `/lobby/reglas`.
