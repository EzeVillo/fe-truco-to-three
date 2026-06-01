# Research: Sección de reglas de variante

## Decisión 1: Contenido local en el frontend

**Decision**: La sección usará contenido local versionado en `src/app/features/lobby/models/variant-rules.ts`, basado en `docs/REGLAS_VARIANTE.md`.

**Rationale**: El usuario decidió no depender del backend. La información es editorial, de solo lectura y específica de esta variante. Mantenerla local reduce complejidad, evita estados de carga/error y permite renderizar la sección junto con el lobby.

**Alternatives considered**:

- Endpoint de reglas desde backend: rechazado por decisión de producto y porque agregaría contrato remoto innecesario.
- Markdown renderizado directamente desde `docs/`: rechazado porque el bundle frontend no debería depender de leer archivos de documentación en runtime y porque dificulta controlar estructura, accesibilidad y tests.

## Decisión 2: CTA en lobby y página dedicada

**Decision**: Integrar en `LobbyPageComponent` un CTA que navega a `/lobby/reglas`, donde se muestra el contenido completo.

**Rationale**: La intención de producto era que el lobby tenga una entrada hacia reglas, igual que los otros modos. Una página dedicada evita que el lobby quede demasiado largo y permite leer el contenido con más aire.

**Alternatives considered**:

- Sección embebida en el lobby: rechazada porque no era la intención del CTA solicitado.
- Ruta global `/rules`: rechazada porque la entrada debe pertenecer al contexto de lobby.
- Modal reutilizable invocado desde varias páginas: rechazada porque no deja una página clara para lectura.

## Decisión 3: Componente presentacional separado

**Decision**: Crear `RulesSectionComponent` bajo `features/lobby/components/rules-section`.

**Rationale**: Separa el contenido de reglas del layout de modos de juego, mantiene `LobbyPageComponent` simple y permite testear la sección de forma aislada. Sigue el patrón existente de componentes de lobby como `bot-card` y `series-format-selector`.

**Alternatives considered**:

- Pegar todo el markup en `lobby-page.component.html`: rechazado porque mezcla CTAs de navegación con contenido informativo largo.
- Crear componente compartido en `shared`: rechazado porque el contenido pertenece al contexto de lobby.

## Decisión 4: Estructura escaneable por grupos

**Decision**: Modelar reglas como grupos con título, resumen opcional y items, usando bloques temáticos: objetivo, formato de match, falta envido, quiero y me voy al mazo, ancho de espada y restricción de fold.

**Rationale**: Cumple el requisito de escaneo por temas y evita un bloque único de texto. Además facilita verificar cobertura contra `docs/REGLAS_VARIANTE.md`.

**Alternatives considered**:

- Texto plano completo: rechazado por baja escaneabilidad.
- Acordeones obligatorios: diferido a implementación si el layout lo necesita, pero no requerido para cumplir la spec.

## Decisión 5: Validación mediante tests de contenido y ubicación

**Decision**: Agregar tests que verifiquen que la sección renderiza valores críticos y que `LobbyPageComponent` la incluye.

**Rationale**: La feature no tiene integración externa ni lógica compleja. El riesgo principal es divergencia de copy/reglas o aparición fuera de lobby. Tests de componente cubren ese comportamiento con bajo costo.

**Alternatives considered**:

- Tests end-to-end: no necesarios para esta feature documental y más costosos de mantener.
- Solo revisión manual: insuficiente para proteger valores críticos como `3`, Falta envido y ancho de espada.
